import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import {
  createExtraction,
  findExtractionOrderNumberForUser,
  findAnyVideoCacheByVideoId,
  findVideoCacheByVideoId,
  getAppSetting,
  getPromptOverride,
  upsertVideoCache,
} from '@/lib/db'
import { persistAiUsageLogsInBackground, type PendingAiUsageLogInput } from '@/lib/ai-usage-log'
import { classifyModelError, classifyTranscriptError, retryWithBackoff } from '@/lib/extract-resilience'
import {
  buildExtractionUserPrompt,
  buildExtractionSystemPrompt,
  estimateTime,
  EXTRACTION_MODEL as EXTRACTION_MODEL_DEFAULT,
  extractVideoId,
  getExtractionPromptVersion,
  parseExtractionModelText,
} from '@/lib/extract-core'
import { AI_PRICING_VERSION, type AiProvider, callAi, estimateCostUsd, isProviderAvailable } from '@/lib/ai-client'
import { normalizeExtractionMode } from '@/lib/extraction-modes'
import {
  normalizeExtractionOutputLanguage,
  resolveExtractionOutputLanguage,
  type ResolvedExtractionOutputLanguage,
} from '@/lib/output-language'
import {
  buildExtractionRateLimitMessage,
  consumeUserExtractionRateLimit,
  type UserExtractionRateLimitResult,
} from '@/lib/rate-limit'
import { resolveVideoPreview } from '@/lib/video-preview'
import { detectSourceType } from '@/lib/source-detector'
import { extractWebContent, truncateForAi } from '@/lib/content-extractor'
import { flattenItemsAsText, normalizePlaybookPhases } from '@/lib/playbook-tree'
import { resolveYoutubeTranscriptWithFallback } from '@/lib/youtube-transcript-fallback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXTRACTION_MAX_TOKENS = 4096
const JSON_REPAIR_MAX_TOKENS = 4096
const JSON_REPAIR_SYSTEM_PROMPT =
  'Eres un normalizador de JSON. Convierte contenido en JSON válido estricto. Devuelve solo JSON, sin markdown ni texto adicional.'

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function buildTranscriptFallbackFromCachedExtraction(cachedVideo: {
  objective: string
  phases_json: string
  pro_tip: string
}) {
  const phases = normalizePlaybookPhases(safeParse<unknown>(cachedVideo.phases_json, []))
  const phaseLines = phases
    .map((phase, index) => {
      const title = typeof phase.title === 'string' && phase.title.trim() ? phase.title.trim() : `Fase ${index + 1}`
      const items = flattenItemsAsText(phase.items).slice(0, 5)
      if (items.length === 0) {
        return `- ${title}`
      }
      return [`- ${title}`, ...items.map((item) => `  - ${item}`)].join('\n')
    })
    .join('\n')

  return [
    'Resumen previo del mismo video:',
    `Objetivo: ${cachedVideo.objective}`,
    phaseLines,
    `Consejo Pro: ${cachedVideo.pro_tip}`,
  ]
    .filter((line) => line.trim().length > 0)
    .join('\n')
}

function createRateLimitResponse(rateLimit: UserExtractionRateLimitResult) {
  return NextResponse.json(
    {
      error: buildExtractionRateLimitMessage(rateLimit.limit),
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(rateLimit.retryAfterSeconds),
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': rateLimit.resetAt,
      },
    }
  )
}

function buildJsonRepairUserPrompt(rawText: string) {
  return `Convierte el siguiente contenido en JSON VÁLIDO con esta estructura exacta:

{
  "objective": "string",
  "phases": [
    {
      "id": 1,
      "title": "string",
      "items": ["string"]
    }
  ],
  "proTip": "string",
  "metadata": {
    "difficulty": "string",
    "readingTime": "string"
  }
}

Reglas:
- Mantén el contenido original lo más fiel posible.
- Si falta algún campo, completa con valor vacío razonable ("" o []).
- No agregues markdown.
- No uses comentarios.

CONTENIDO A NORMALIZAR:
${rawText}`
}

function buildCompactJsonRepairUserPrompt(rawText: string, modeLabel: string) {
  return `Convierte el siguiente contenido en JSON VÁLIDO y COMPACTO para el modo "${modeLabel}" con esta estructura exacta:

{
  "objective": "string",
  "phases": [
    {
      "id": 1,
      "title": "string",
      "items": ["string"]
    }
  ],
  "proTip": "string",
  "metadata": {
    "difficulty": "string",
    "readingTime": "string"
  }
}

Reglas de compresión:
- Máximo 4 fases.
- Máximo 4 items por fase.
- Cada item con máximo 20 palabras.
- objective en máximo 2 líneas.
- proTip en máximo 1 línea.
- Mantén la esencia del contenido y elimina relleno.
- Si falta algún campo, completa con valor vacío razonable ("" o []).
- Devuelve solo JSON, sin markdown.

CONTENIDO A NORMALIZAR:
${rawText}`
}

async function parseExtractionWithRepair(params: {
  modelText: string
  provider: AiProvider
  model: string
  mode: ReturnType<typeof normalizeExtractionMode>
  resolvedOutputLanguage: ResolvedExtractionOutputLanguage
  originalTime: string
  savedTime: string
  userId?: string | null
  sourceType?: string | null
  onUsage?: (usage: PendingAiUsageLogInput) => Promise<void> | void
}) {
  const {
    modelText,
    provider,
    model,
    mode,
    resolvedOutputLanguage,
    originalTime,
    savedTime,
    userId,
    sourceType,
    onUsage,
  } = params

  const parseWithTime = (text: string) =>
    parseExtractionModelText(
      text,
      {
        originalTime,
        savedTime,
      },
      mode,
      resolvedOutputLanguage
    )

  try {
    return parseWithTime(modelText)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('JSON inválido')) {
      throw error
    }

    const repairPrompts = [
      buildJsonRepairUserPrompt(modelText),
      buildCompactJsonRepairUserPrompt(modelText, mode),
    ]

    let lastError: unknown = error
    for (const repairPrompt of repairPrompts) {
      try {
        const repairResult = await retryWithBackoff(
          () =>
            callAi({
              provider,
              model,
              system: JSON_REPAIR_SYSTEM_PROMPT,
              messages: [{ role: 'user', content: repairPrompt }],
              maxTokens: JSON_REPAIR_MAX_TOKENS,
            }),
          {
            maxAttempts: 2,
            shouldRetry: (repairError) => classifyModelError(repairError).retryable,
          }
        )

        if (!repairResult.text.trim()) {
          lastError = new Error('No se pudo normalizar la respuesta del modelo.')
          continue
        }

        await onUsage?.({
          provider,
          model,
          useType: 'repair',
          userId,
          sourceType,
          inputTokens: repairResult.inputTokens,
          outputTokens: repairResult.outputTokens,
          costUsd: estimateCostUsd(model, repairResult.inputTokens, repairResult.outputTokens),
          pricingVersion: AI_PRICING_VERSION,
        })

        return parseWithTime(repairResult.text)
      } catch (repairError: unknown) {
        lastError = repairError
      }
    }

    if (lastError instanceof Error) {
      throw lastError
    }

    throw new Error('El modelo devolvió JSON inválido. Intenta de nuevo.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    const isAdminUser = Boolean(user?.email && isAdminEmail(user.email))
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const body = await req.json()
    const rawUrl: string = (body?.url ?? '').trim()
    const rawText: string = (body?.text ?? '').trim()
    const bodySourceType = body?.sourceType
    const bodySourceLabel: string | null =
      typeof body?.sourceLabel === 'string' ? body.sourceLabel : null
    const bodySourceFileUrl: string | null =
      typeof body?.sourceFileUrl === 'string' &&
      (body.sourceFileUrl.startsWith('https://') || body.sourceFileUrl.startsWith('/api/uploads/'))
        ? body.sourceFileUrl : null
    const bodySourceFileName: string | null =
      typeof body?.sourceFileName === 'string' ? body.sourceFileName.slice(0, 500) : null
    const bodySourceFileSizeBytes: number | null =
      typeof body?.sourceFileSizeBytes === 'number' && body.sourceFileSizeBytes > 0 ? body.sourceFileSizeBytes : null
    const bodySourceFileMimeType: string | null =
      typeof body?.sourceFileMimeType === 'string' ? body.sourceFileMimeType.slice(0, 200) : null

    const mode = normalizeExtractionMode(body?.mode)
    const outputLanguage = normalizeExtractionOutputLanguage(body?.outputLanguage)
    const promptVersion = getExtractionPromptVersion(mode, outputLanguage)

    const sourceType = typeof bodySourceType === 'string' && bodySourceType
      ? bodySourceType as 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text'
      : detectSourceType(rawUrl || rawText)

    if (sourceType === 'youtube' || sourceType === 'web_url') {
      if (!rawUrl) {
        return NextResponse.json({ error: 'URL requerida.' }, { status: 400 })
      }
    } else {
      if (!rawText) {
        return NextResponse.json({ error: 'Contenido de texto requerido.' }, { status: 400 })
      }
    }

    const videoId = sourceType === 'youtube' ? extractVideoId(rawUrl) : null
    if (sourceType === 'youtube' && !videoId) {
      return NextResponse.json(
        { error: 'URL de YouTube inválida. Usa el formato https://youtube.com/watch?v=...' },
        { status: 400 }
      )
    }

    const [dbExtractionProvider, dbExtractionModel, systemOverride, userOverride] = await Promise.all([
      getAppSetting('extraction_provider').catch(() => null),
      getAppSetting('extraction_model').catch(() => null),
      getPromptOverride(`extraction:${mode}:system`).catch(() => null),
      getPromptOverride(`extraction:${mode}:user`).catch(() => null),
    ])
    const EXTRACTION_PROVIDER: AiProvider =
      (dbExtractionProvider as AiProvider | null) ?? 'anthropic'
    const EXTRACTION_MODEL = dbExtractionModel || EXTRACTION_MODEL_DEFAULT

    const cachedVideo = sourceType === 'youtube' && videoId
      ? await findVideoCacheByVideoId({ videoId, promptVersion, model: EXTRACTION_MODEL })
      : null
    const fallbackVideoCache = sourceType === 'youtube' && videoId
      ? (cachedVideo ?? (await findAnyVideoCacheByVideoId(videoId)))
      : null

    if (cachedVideo) {
      const cachedMetadata = safeParse(cachedVideo.metadata_json, {
        readingTime: '3 min',
        difficulty: 'Media',
        originalTime: '0m',
        savedTime: '0m',
      })

      const responsePayload = {
        mode,
        objective: cachedVideo.objective,
        phases: safeParse(cachedVideo.phases_json, []),
        proTip: cachedVideo.pro_tip,
        metadata: {
          readingTime:
            typeof cachedMetadata.readingTime === 'string' ? cachedMetadata.readingTime : '3 min',
          difficulty:
            typeof cachedMetadata.difficulty === 'string' ? cachedMetadata.difficulty : 'Media',
          originalTime:
            typeof cachedMetadata.originalTime === 'string' ? cachedMetadata.originalTime : '0m',
          savedTime: typeof cachedMetadata.savedTime === 'string' ? cachedMetadata.savedTime : '0m',
        },
      }

      const videoPreview = await resolveVideoPreview({
        videoId: videoId!,
        titleHint: cachedVideo.video_title,
        thumbnailHint: cachedVideo.thumbnail_url,
      })

      if (!cachedVideo.video_title || !cachedVideo.thumbnail_url) {
        await upsertVideoCache({
          videoId: videoId!,
          videoTitle: videoPreview.videoTitle,
          thumbnailUrl: videoPreview.thumbnailUrl,
          objective: responsePayload.objective,
          phasesJson: JSON.stringify(responsePayload.phases),
          proTip: responsePayload.proTip,
          metadataJson: JSON.stringify(responsePayload.metadata),
          transcriptText: cachedVideo.transcript_text,
          promptVersion,
          model: EXTRACTION_MODEL,
        })
      }

      const saved = await createExtraction({
        userId: user.id,
        url: rawUrl || null,
        videoId: videoId!,
        videoTitle: videoPreview.videoTitle,
        thumbnailUrl: videoPreview.thumbnailUrl,
        extractionMode: mode,
        objective: responsePayload.objective,
        phasesJson: JSON.stringify(responsePayload.phases),
        proTip: responsePayload.proTip,
        metadataJson: JSON.stringify(responsePayload.metadata),
        sourceType,
        sourceLabel: videoPreview.videoTitle ?? bodySourceLabel,
        transcriptSource: 'cache_exact',
      })
      const orderNumber = await findExtractionOrderNumberForUser({ id: saved.id, userId: user.id })

      return NextResponse.json({
        ...responsePayload,
        url: rawUrl || null,
        videoId: videoId!,
        videoTitle: videoPreview.videoTitle,
        thumbnailUrl: videoPreview.thumbnailUrl,
        outputLanguageRequested: outputLanguage,
        outputLanguageResolved: outputLanguage === 'auto' ? null : outputLanguage,
        id: saved.id,
        orderNumber: orderNumber ?? undefined,
        shareVisibility: saved.share_visibility,
        createdAt: saved.created_at,
        cached: true,
        sourceType,
        transcriptSource: 'cache_exact',
        sourceLabel: saved.source_label,
        folderId: saved.folder_id,
        hasSourceText: false,
      })
    }

    if (!isProviderAvailable(EXTRACTION_PROVIDER)) {
      return NextResponse.json(
        { error: 'Servicio de IA no configurado. Falta la API key del proveedor seleccionado.' },
        { status: 503 }
      )
    }

    if (!isAdminUser) {
      const rateLimit = await consumeUserExtractionRateLimit(user.id)
      if (!rateLimit.allowed) {
        return createRateLimitResponse(rateLimit)
      }
    }

    const pendingExtractionId = randomUUID()
    const pendingAiUsageLogs: PendingAiUsageLogInput[] = []

    // Obtain content based on source type
    let contentText = ''
    let contentTitle: string | null = null
    let transcriptSource:
      | 'cache_transcript'
      | 'cache_result'
      | 'custom_extractor'
      | 'youtube_transcript'
      | 'yt_dlp_subtitles'
      | 'openai_audio_transcription'
      | 'youtube_official_api'
      | 'web'
      | 'file'
      | 'text' = 'youtube_transcript'

    if (sourceType === 'youtube') {
      let transcriptText = fallbackVideoCache?.transcript_text?.trim() ?? ''
      transcriptSource = transcriptText ? 'cache_transcript' : 'youtube_transcript'
      const transcriptFallbackFromCache = fallbackVideoCache
        ? buildTranscriptFallbackFromCachedExtraction(fallbackVideoCache)
        : ''

      if (!transcriptText) {
        try {
          const transcriptResolution = await retryWithBackoff(
            () => resolveYoutubeTranscriptWithFallback(videoId!),
            {
              maxAttempts: 3,
              shouldRetry: (transcriptError) => classifyTranscriptError(transcriptError).retryable,
            }
          )

          if (!transcriptResolution.segments.length) {
            if (transcriptFallbackFromCache) {
              transcriptText = transcriptFallbackFromCache
              transcriptSource = 'cache_result'
            } else {
              return NextResponse.json(
                { error: 'No se encontró transcripción utilizable para este video. Prueba con otro enlace.' },
                { status: 422 }
              )
            }
          } else {
            transcriptText = transcriptResolution.segments.map((segment) => segment.text).join(' ')
            transcriptSource = transcriptResolution.source
            for (const usageEvent of transcriptResolution.usageEvents) {
              pendingAiUsageLogs.push({
                provider: usageEvent.provider,
                model: usageEvent.model,
                useType: usageEvent.useType,
                userId: user.id,
                sourceType,
                inputTokens: 0,
                outputTokens: 0,
                costUsd: usageEvent.costUsd,
                pricingVersion: usageEvent.pricingVersion,
              })
            }
          }
        } catch (error: unknown) {
          if (transcriptFallbackFromCache) {
            transcriptText = transcriptFallbackFromCache
            transcriptSource = 'cache_result'
          } else {
            const transcriptError = classifyTranscriptError(error)
            return NextResponse.json({ error: transcriptError.message }, { status: transcriptError.status })
          }
        }
      }
      contentText = transcriptText
    } else if (sourceType === 'web_url') {
      try {
        const webContent = await extractWebContent(rawUrl)
        contentText = webContent.text
        contentTitle = webContent.title
        transcriptSource = 'web'
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'No se pudo descargar la página.'
        return NextResponse.json({ error: msg }, { status: 422 })
      }
    } else if (sourceType === 'text') {
      contentText = rawText
      contentTitle = bodySourceLabel
      transcriptSource = 'text'
    } else {
      contentText = rawText
      contentTitle = bodySourceLabel
      transcriptSource = 'file'
    }

    if (!contentText.trim()) {
      return NextResponse.json(
        { error: 'El contenido está vacío. Prueba con otra fuente.' },
        { status: 422 }
      )
    }

    const { finalText: finalTranscript } = truncateForAi(contentText)
    const wordCount = contentText.split(/\s+/).length
    const { originalTime, savedTime } = estimateTime(wordCount)
    const resolvedOutputLanguage = resolveExtractionOutputLanguage(outputLanguage, finalTranscript)
    const previewPromise = sourceType === 'youtube' && videoId ? resolveVideoPreview({ videoId }) : null

    let modelText: string
    try {
      const aiResult = await retryWithBackoff(
        () =>
          callAi({
            provider: EXTRACTION_PROVIDER,
            model: EXTRACTION_MODEL,
            system: buildExtractionSystemPrompt(mode, resolvedOutputLanguage, systemOverride),
            messages: [
              {
                role: 'user',
                content: buildExtractionUserPrompt(finalTranscript, mode, resolvedOutputLanguage, userOverride),
              },
            ],
            maxTokens: EXTRACTION_MAX_TOKENS,
          }),
        {
          maxAttempts: 3,
          shouldRetry: (modelError) => classifyModelError(modelError).retryable,
        }
      )
      modelText = aiResult.text
      pendingAiUsageLogs.push({
        provider: EXTRACTION_PROVIDER,
        model: EXTRACTION_MODEL,
        useType: 'extraction',
        userId: user.id,
        sourceType,
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        costUsd: estimateCostUsd(EXTRACTION_MODEL, aiResult.inputTokens, aiResult.outputTokens),
        pricingVersion: AI_PRICING_VERSION,
      })
    } catch (error: unknown) {
      const modelError = classifyModelError(error)
      return NextResponse.json({ error: modelError.message }, { status: modelError.status })
    }

    let responsePayload: Awaited<ReturnType<typeof parseExtractionWithRepair>>
    try {
      responsePayload = await parseExtractionWithRepair({
        modelText,
        provider: EXTRACTION_PROVIDER,
        model: EXTRACTION_MODEL,
        originalTime,
        savedTime,
        mode,
        resolvedOutputLanguage,
        userId: user.id,
        sourceType,
        onUsage: (usage) => {
          pendingAiUsageLogs.push(usage)
        },
      })
    } catch (error: unknown) {
      const modelError = classifyModelError(error)
      return NextResponse.json({ error: modelError.message }, { status: modelError.status })
    }

    const videoPreview = previewPromise ? await previewPromise : { videoTitle: null, thumbnailUrl: null }

    if (sourceType === 'youtube' && videoId) {
      await upsertVideoCache({
        videoId,
        videoTitle: videoPreview.videoTitle,
        thumbnailUrl: videoPreview.thumbnailUrl,
        objective: responsePayload.objective,
        phasesJson: JSON.stringify(responsePayload.phases),
        proTip: responsePayload.proTip,
        metadataJson: JSON.stringify(responsePayload.metadata),
        transcriptText: transcriptSource === 'cache_result' ? null : contentText,
        promptVersion,
        model: EXTRACTION_MODEL,
      })
    }

    const resolvedSourceLabel = sourceType === 'youtube'
      ? (videoPreview.videoTitle ?? bodySourceLabel)
      : (contentTitle ?? bodySourceLabel)

    // Store the full source text for non-YouTube sources (YouTube transcript lives in video_cache)
    const sourceTextToStore = sourceType !== 'youtube' ? contentText || null : null

    const saved = await createExtraction({
      id: pendingExtractionId,
      userId: user.id,
      url: rawUrl || null,
      videoId: videoId ?? null,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      extractionMode: mode,
      objective: responsePayload.objective,
      phasesJson: JSON.stringify(responsePayload.phases),
      proTip: responsePayload.proTip,
      metadataJson: JSON.stringify(responsePayload.metadata),
      sourceType,
      sourceLabel: resolvedSourceLabel,
      sourceText: sourceTextToStore,
      sourceFileUrl: bodySourceFileUrl,
      sourceFileName: bodySourceFileName,
      sourceFileSizeBytes: bodySourceFileSizeBytes,
      sourceFileMimeType: bodySourceFileMimeType,
      transcriptSource,
    })

    persistAiUsageLogsInBackground(pendingAiUsageLogs, saved.id)

    const orderNumber = await findExtractionOrderNumberForUser({ id: saved.id, userId: user.id })

    return NextResponse.json({
      ...responsePayload,
      url: rawUrl || null,
      videoId: videoId ?? null,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      outputLanguageRequested: outputLanguage,
      outputLanguageResolved: resolvedOutputLanguage,
      id: saved.id,
      orderNumber: orderNumber ?? undefined,
      shareVisibility: saved.share_visibility,
      createdAt: saved.created_at,
      cached: false,
      sourceType,
      transcriptSource: saved.transcript_source,
      sourceLabel: saved.source_label,
      folderId: saved.folder_id,
      sourceFileUrl: saved.source_file_url,
      sourceFileName: saved.source_file_name,
      sourceFileSizeBytes: saved.source_file_size_bytes,
      sourceFileMimeType: saved.source_file_mime_type,
      hasSourceText: !!sourceTextToStore,
    })
  } catch (err: unknown) {
    console.error('[ActionExtractor] extract error:', err)
    return NextResponse.json(
      {
        error:
          'No se pudo completar la extracción por un error interno. Intenta nuevamente en unos minutos.',
      },
      { status: 500 }
    )
  }
}
