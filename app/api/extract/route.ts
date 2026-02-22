import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { YoutubeTranscript } from '@danielxceron/youtube-transcript'
import { getUserFromRequest } from '@/lib/auth'
import {
  createExtraction,
  findAnyVideoCacheByVideoId,
  findVideoCacheByVideoId,
  upsertVideoCache,
} from '@/lib/db'
import { classifyModelError, classifyTranscriptError, retryWithBackoff } from '@/lib/extract-resilience'
import {
  buildExtractionUserPrompt,
  buildExtractionSystemPrompt,
  estimateTime,
  EXTRACTION_MODEL,
  extractVideoId,
  getExtractionPromptVersion,
  parseExtractionModelText,
} from '@/lib/extract-core'
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
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
  const phases = safeParse<Array<{ title?: unknown; items?: unknown }>>(cachedVideo.phases_json, [])
  const phaseLines = phases
    .map((phase, index) => {
      const title = typeof phase.title === 'string' && phase.title.trim() ? phase.title.trim() : `Fase ${index + 1}`
      const items = Array.isArray(phase.items)
        ? phase.items
            .filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0
            )
            .slice(0, 5)
        : []
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
  mode: ReturnType<typeof normalizeExtractionMode>
  resolvedOutputLanguage: ResolvedExtractionOutputLanguage
  originalTime: string
  savedTime: string
}) {
  const { modelText, mode, resolvedOutputLanguage, originalTime, savedTime } = params

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
        const repairResponse = await retryWithBackoff(
          () =>
            anthropic.messages.create({
              model: EXTRACTION_MODEL,
              max_tokens: JSON_REPAIR_MAX_TOKENS,
              system: JSON_REPAIR_SYSTEM_PROMPT,
              messages: [
                {
                  role: 'user',
                  content: repairPrompt,
                },
              ],
            }),
          {
            maxAttempts: 2,
            shouldRetry: (repairError) => classifyModelError(repairError).retryable,
          }
        )

        const repairBlock = repairResponse.content[0]
        if (repairBlock.type !== 'text') {
          lastError = new Error('No se pudo normalizar la respuesta del modelo.')
          continue
        }

        return parseWithTime(repairBlock.text)
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
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const body = await req.json()
    const url: string = body?.url ?? ''
    const mode = normalizeExtractionMode(body?.mode)
    const outputLanguage = normalizeExtractionOutputLanguage(body?.outputLanguage)
    const promptVersion = getExtractionPromptVersion(mode, outputLanguage)

    if (!url.trim()) {
      return NextResponse.json({ error: 'URL requerida.' }, { status: 400 })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json(
        { error: 'URL de YouTube inválida. Usa el formato https://youtube.com/watch?v=...' },
        { status: 400 }
      )
    }

    const cachedVideo = await findVideoCacheByVideoId({
      videoId,
      promptVersion,
      model: EXTRACTION_MODEL,
    })
    const fallbackVideoCache = cachedVideo ?? (await findAnyVideoCacheByVideoId(videoId))

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
        videoId,
        titleHint: cachedVideo.video_title,
        thumbnailHint: cachedVideo.thumbnail_url,
      })

      if (!cachedVideo.video_title || !cachedVideo.thumbnail_url) {
        await upsertVideoCache({
          videoId,
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
        url,
        videoId,
        videoTitle: videoPreview.videoTitle,
        thumbnailUrl: videoPreview.thumbnailUrl,
        extractionMode: mode,
        objective: responsePayload.objective,
        phasesJson: JSON.stringify(responsePayload.phases),
        proTip: responsePayload.proTip,
        metadataJson: JSON.stringify(responsePayload.metadata),
      })

      return NextResponse.json({
        ...responsePayload,
        url,
        videoId,
        videoTitle: videoPreview.videoTitle,
        thumbnailUrl: videoPreview.thumbnailUrl,
        outputLanguageRequested: outputLanguage,
        outputLanguageResolved: outputLanguage === 'auto' ? null : outputLanguage,
        id: saved.id,
        createdAt: saved.created_at,
        cached: true,
      })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Servicio de IA no configurado.' },
        { status: 503 }
      )
    }

    const rateLimit = await consumeUserExtractionRateLimit(user.id)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    // Fetch transcript con retry automático, con fallback a transcripción cacheada
    let transcriptText = fallbackVideoCache?.transcript_text?.trim() ?? ''
    let transcriptSource: 'cache_transcript' | 'youtube' | 'cache_result' = transcriptText
      ? 'cache_transcript'
      : 'youtube'
    const transcriptFallbackFromCache = fallbackVideoCache
      ? buildTranscriptFallbackFromCachedExtraction(fallbackVideoCache)
      : ''
    if (!transcriptText) {
      try {
        const segments = await retryWithBackoff(() => YoutubeTranscript.fetchTranscript(videoId), {
          maxAttempts: 3,
          shouldRetry: (transcriptError) => classifyTranscriptError(transcriptError).retryable,
        })

        if (!segments.length) {
          if (transcriptFallbackFromCache) {
            transcriptText = transcriptFallbackFromCache
            transcriptSource = 'cache_result'
          } else {
            return NextResponse.json(
              {
                error: 'No se encontró transcripción utilizable para este video. Prueba con otro enlace.',
              },
              { status: 422 }
            )
          }
        } else {
          transcriptText = segments.map((segment) => segment.text).join(' ')
          transcriptSource = 'youtube'
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

    if (!transcriptText.trim()) {
      return NextResponse.json(
        { error: 'La transcripción está vacía. Prueba con otro video.' },
        { status: 422 }
      )
    }

    // Truncate to avoid exceeding context limits (~50k chars ≈ 12k tokens)
    const MAX_CHARS = 50_000
    const truncated = transcriptText.length > MAX_CHARS
    const finalTranscript = truncated
      ? transcriptText.slice(0, MAX_CHARS) + '\n[Transcripción truncada]'
      : transcriptText

    const wordCount = transcriptText.split(/\s+/).length
    const { originalTime, savedTime } = estimateTime(wordCount)
    const resolvedOutputLanguage = resolveExtractionOutputLanguage(outputLanguage, finalTranscript)
    const previewPromise = resolveVideoPreview({ videoId })

    let message: Awaited<ReturnType<typeof anthropic.messages.create>>
    try {
      message = await retryWithBackoff(
        () =>
          anthropic.messages.create({
            model: EXTRACTION_MODEL,
            max_tokens: EXTRACTION_MAX_TOKENS,
            system: buildExtractionSystemPrompt(mode, resolvedOutputLanguage),
            messages: [
              {
                role: 'user',
                content: buildExtractionUserPrompt(finalTranscript, mode, resolvedOutputLanguage),
              },
            ],
          }),
        {
          maxAttempts: 3,
          shouldRetry: (modelError) => classifyModelError(modelError).retryable,
        }
      )
    } catch (error: unknown) {
      const modelError = classifyModelError(error)
      return NextResponse.json({ error: modelError.message }, { status: modelError.status })
    }

    const block = message.content[0]
    if (block.type !== 'text') {
      return NextResponse.json(
        {
          error:
            'La IA devolvió una respuesta inesperada. Intenta nuevamente y, si persiste, prueba con otro video.',
        },
        { status: 502 }
      )
    }

    let responsePayload: Awaited<ReturnType<typeof parseExtractionWithRepair>>
    try {
      responsePayload = await parseExtractionWithRepair({
        modelText: block.text,
        originalTime,
        savedTime,
        mode,
        resolvedOutputLanguage,
      })
    } catch (error: unknown) {
      const modelError = classifyModelError(error)
      return NextResponse.json({ error: modelError.message }, { status: modelError.status })
    }

    const videoPreview = await previewPromise

    await upsertVideoCache({
      videoId,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      objective: responsePayload.objective,
      phasesJson: JSON.stringify(responsePayload.phases),
      proTip: responsePayload.proTip,
      metadataJson: JSON.stringify(responsePayload.metadata),
      transcriptText: transcriptSource === 'cache_result' ? null : transcriptText,
      promptVersion,
      model: EXTRACTION_MODEL,
    })

    const saved = await createExtraction({
      userId: user.id,
      url,
      videoId,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      extractionMode: mode,
      objective: responsePayload.objective,
      phasesJson: JSON.stringify(responsePayload.phases),
      proTip: responsePayload.proTip,
      metadataJson: JSON.stringify(responsePayload.metadata),
    })

    return NextResponse.json({
      ...responsePayload,
      url,
      videoId,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      outputLanguageRequested: outputLanguage,
      outputLanguageResolved: resolvedOutputLanguage,
      id: saved.id,
      createdAt: saved.created_at,
      cached: false,
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
