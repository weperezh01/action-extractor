import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from '@danielxceron/youtube-transcript'
import { getUserFromRequest } from '@/lib/auth'
import {
  createExtraction,
  findExtractionOrderNumberForUser,
  findAnyVideoCacheByVideoId,
  findVideoCacheByVideoId,
  getAppSetting,
  logAiUsage,
  upsertVideoCache,
} from '@/lib/db'
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
import { type AiProvider, callAi, streamAi, estimateCostUsd, isProviderAvailable, PROVIDER_MODELS } from '@/lib/ai-client'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
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

function formatSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
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
  provider: AiProvider
  model: string
  mode: ReturnType<typeof normalizeExtractionMode>
  resolvedOutputLanguage: ResolvedExtractionOutputLanguage
  originalTime: string
  savedTime: string
  onRepair?: () => void
}) {
  const { modelText, provider, model, mode, resolvedOutputLanguage, originalTime, savedTime, onRepair } = params

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

    onRepair?.()

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

        void logAiUsage({
          provider,
          model,
          useType: 'repair',
          inputTokens: repairResult.inputTokens,
          outputTokens: repairResult.outputTokens,
          costUsd: estimateCostUsd(model, repairResult.inputTokens, repairResult.outputTokens),
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
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const url = typeof (body as { url?: unknown })?.url === 'string' ? (body as { url: string }).url : ''
  const mode = normalizeExtractionMode((body as { mode?: unknown })?.mode)
  const outputLanguage = normalizeExtractionOutputLanguage((body as { outputLanguage?: unknown })?.outputLanguage)
  const modeLabel = getExtractionModeLabel(mode)
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

  const [dbExtractionProvider, dbExtractionModel] = await Promise.all([
    getAppSetting('extraction_provider').catch(() => null),
    getAppSetting('extraction_model').catch(() => null),
  ])
  const EXTRACTION_PROVIDER: AiProvider =
    (dbExtractionProvider as AiProvider | null) ?? 'anthropic'
  const EXTRACTION_MODEL = dbExtractionModel || EXTRACTION_MODEL_DEFAULT

  const cachedVideo = await findVideoCacheByVideoId({
    videoId,
    promptVersion,
    model: EXTRACTION_MODEL,
  })
  const fallbackVideoCache = cachedVideo ?? (await findAnyVideoCacheByVideoId(videoId))

  if (!cachedVideo) {
    if (!isProviderAvailable(EXTRACTION_PROVIDER)) {
      return NextResponse.json({ error: 'Servicio de IA no configurado. Falta la API key del proveedor seleccionado.' }, { status: 503 })
    }

    const rateLimit = await consumeUserExtractionRateLimit(user.id)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }
  }

  const encoder = new TextEncoder()
  const abortController = new AbortController()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(formatSseEvent(event, payload)))
        } catch {
          closed = true
        }
      }

      const close = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // noop
        }
      }

      try {
        send('status', {
          step: 'cache',
          message: 'Verificando caché del video...',
        })

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
          const orderNumber = await findExtractionOrderNumberForUser({ id: saved.id, userId: user.id })

          send('status', {
            step: 'cached',
            message: 'Resultado obtenido desde caché.',
          })
          send('result', {
            ...responsePayload,
            url,
            videoId,
            videoTitle: videoPreview.videoTitle,
            thumbnailUrl: videoPreview.thumbnailUrl,
            outputLanguageRequested: outputLanguage,
            outputLanguageResolved: outputLanguage === 'auto' ? null : outputLanguage,
            id: saved.id,
            orderNumber: orderNumber ?? undefined,
            shareVisibility: saved.share_visibility,
            createdAt: saved.created_at,
            cached: true,
          })
          send('done', { ok: true })
          close()
          return
        }

        send('status', {
          step: 'transcript',
          message: 'Obteniendo transcripción de YouTube...',
        })
        const previewPromise = resolveVideoPreview({ videoId })

        let transcriptText = fallbackVideoCache?.transcript_text?.trim() ?? ''
        let transcriptSource: 'cache_transcript' | 'youtube' | 'cache_result' = transcriptText
          ? 'cache_transcript'
          : 'youtube'
        const transcriptFallbackFromCache = fallbackVideoCache
          ? buildTranscriptFallbackFromCachedExtraction(fallbackVideoCache)
          : ''
        if (transcriptText) {
          send('status', {
            step: 'transcript-cache',
            message: 'Usando transcripción en caché del video...',
          })
        } else {
          try {
            const segments = await retryWithBackoff(() => YoutubeTranscript.fetchTranscript(videoId), {
              maxAttempts: 3,
              shouldRetry: (transcriptError) => classifyTranscriptError(transcriptError).retryable,
              onRetry: ({ nextAttempt, maxAttempts, delayMs }) =>
                send('status', {
                  step: 'transcript-retry',
                  message: `Fallo al obtener la transcripción. Reintentando (${nextAttempt}/${maxAttempts}) en ${Math.ceil(
                    delayMs / 1000
                  )}s...`,
                }),
            })

            if (!segments.length) {
              if (transcriptFallbackFromCache) {
                transcriptText = transcriptFallbackFromCache
                transcriptSource = 'cache_result'
                send('status', {
                  step: 'transcript-fallback',
                  message:
                    'No se pudieron leer subtítulos en este momento. Usando una extracción previa del mismo video como respaldo.',
                })
              } else {
                send('error', {
                  message: 'No se encontró transcripción utilizable para este video. Prueba con otro enlace.',
                })
                send('done', { ok: false })
                close()
                return
              }
            } else {
              transcriptText = segments.map((segment) => segment.text).join(' ')
              transcriptSource = 'youtube'
            }
          } catch (error: unknown) {
            if (transcriptFallbackFromCache) {
              transcriptText = transcriptFallbackFromCache
              transcriptSource = 'cache_result'
              send('status', {
                step: 'transcript-fallback',
                message:
                  'No se pudieron leer subtítulos en este momento. Usando una extracción previa del mismo video como respaldo.',
              })
            } else {
              const transcriptError = classifyTranscriptError(error)
              send('error', { message: transcriptError.message })
              send('done', { ok: false })
              close()
              return
            }
          }
        }

        if (!transcriptText.trim()) {
          send('error', { message: 'La transcripción está vacía. Prueba con otro video.' })
          send('done', { ok: false })
          close()
          return
        }

        const MAX_CHARS = 50_000
        const truncated = transcriptText.length > MAX_CHARS
        const finalTranscript = truncated
          ? `${transcriptText.slice(0, MAX_CHARS)}\n[Transcripción truncada]`
          : transcriptText

        if (truncated) {
          send('status', {
            step: 'transcript-truncated',
            message: 'Transcripción larga detectada. Se procesará una versión resumida.',
          })
        }

        const wordCount = transcriptText.split(/\s+/).length
        const { originalTime, savedTime } = estimateTime(wordCount)
        const resolvedOutputLanguage = resolveExtractionOutputLanguage(outputLanguage, finalTranscript)

        send('status', {
          step: 'language',
          message:
            resolvedOutputLanguage === 'en'
              ? 'Idioma detectado: inglés.'
              : 'Idioma detectado: español.',
        })

        send('status', {
          step: 'analyzing',
          message: `Analizando contenido con IA (${modeLabel})...`,
        })

        let modelText = ''
        try {
          const aiResult = await retryWithBackoff(
            () =>
              streamAi(
                {
                  provider: EXTRACTION_PROVIDER,
                  model: EXTRACTION_MODEL,
                  system: buildExtractionSystemPrompt(mode, resolvedOutputLanguage),
                  messages: [
                    {
                      role: 'user',
                      content: buildExtractionUserPrompt(finalTranscript, mode, resolvedOutputLanguage),
                    },
                  ],
                  maxTokens: EXTRACTION_MAX_TOKENS,
                },
                {
                  onChunk: (chunk) => send('text', { chunk }),
                  signal: abortController.signal,
                }
              ),
            {
              maxAttempts: 3,
              shouldRetry: (modelError) => classifyModelError(modelError).retryable,
              onRetry: ({ nextAttempt, maxAttempts, delayMs }) =>
                send('status', {
                  step: 'ai-retry',
                  message: `La IA falló en el intento anterior. Reintentando (${nextAttempt}/${maxAttempts}) en ${Math.ceil(
                    delayMs / 1000
                  )}s...`,
                }),
            }
          )
          modelText = aiResult.text
          void logAiUsage({
            provider: EXTRACTION_PROVIDER,
            model: EXTRACTION_MODEL,
            useType: 'extraction',
            userId: user.id,
            inputTokens: aiResult.inputTokens,
            outputTokens: aiResult.outputTokens,
            costUsd: estimateCostUsd(EXTRACTION_MODEL, aiResult.inputTokens, aiResult.outputTokens),
          })
        } catch (error: unknown) {
          const modelError = classifyModelError(error)
          send('error', { message: modelError.message })
          send('done', { ok: false })
          close()
          return
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
            onRepair: () =>
              send('status', {
                step: 'repair-json',
                message: 'Corrigiendo formato de respuesta...',
              }),
          })
        } catch (error: unknown) {
          const modelError = classifyModelError(error)
          send('error', { message: modelError.message })
          send('done', { ok: false })
          close()
          return
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
        const orderNumber = await findExtractionOrderNumberForUser({ id: saved.id, userId: user.id })

        send('result', {
          ...responsePayload,
          url,
          videoId,
          videoTitle: videoPreview.videoTitle,
          thumbnailUrl: videoPreview.thumbnailUrl,
          outputLanguageRequested: outputLanguage,
          outputLanguageResolved: resolvedOutputLanguage,
          id: saved.id,
          orderNumber: orderNumber ?? undefined,
          shareVisibility: saved.share_visibility,
          createdAt: saved.created_at,
          cached: false,
        })
        send('done', { ok: true })
      } catch (error: unknown) {
        console.error('[ActionExtractor] extract stream error:', error)
        send('error', {
          message:
            'No se pudo completar la extracción por un error interno. Intenta nuevamente en unos minutos.',
        })
        send('done', { ok: false })
      } finally {
        close()
      }
    },
    cancel() {
      abortController.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
