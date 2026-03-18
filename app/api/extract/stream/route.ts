import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { type PendingAiUsageLogInput } from '@/lib/ai-usage-log'
import { AI_PRICING_VERSION, estimateCostUsd, streamAi } from '@/lib/ai-client'
import { buildExtractionSystemPrompt, buildExtractionUserPrompt, estimateTime } from '@/lib/extract-core'
import { getExtractionModeLabel } from '@/lib/extraction-modes'
import { classifyModelError, retryWithBackoff } from '@/lib/extract-resilience'
import {
  buildCachedExtractionResult,
  createRateLimitResponse,
  ensureExtractionProviderConfigured,
  EXTRACTION_MAX_TOKENS,
  ExtractionRequestError,
  finalizeExtractionResult,
  loadExtractionRequestContext,
  parseExtractionRequestBody,
  parseExtractionWithRepair,
  resolveExtractionSourceContent,
} from '@/lib/extraction-server'
import { prepareContentForExtraction } from '@/lib/long-content-preparation'
import { resolveExtractionOutputLanguage } from '@/lib/output-language'
import { consumeGuestRateLimit, consumeUserExtractionRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatSseEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    const isAdminUser = Boolean(user?.email && isAdminEmail(user.email))
    const isGuest = !user && req.headers.get('X-Guest-Mode') === '1'

    if (!user && !isGuest) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    if (isGuest) {
      const rawGuestId = req.headers.get('X-Guest-ID') ?? ''
      const guestId = /^[0-9a-f-]{20,40}$/i.test(rawGuestId) ? rawGuestId : 'unknown'
      const { allowed } = await consumeGuestRateLimit(guestId)
      if (!allowed) {
        return NextResponse.json(
          { error: 'Ya usaste tu extracción gratuita. Crea una cuenta para continuar.' },
          { status: 429 }
        )
      }
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const input = parseExtractionRequestBody(body)
    const context = await loadExtractionRequestContext(input)
    const modeLabel = getExtractionModeLabel(context.mode)

    if (!context.cachedVideo) {
      ensureExtractionProviderConfigured(context.extractionProvider)

      if (user && !isAdminUser) {
        const rateLimit = await consumeUserExtractionRateLimit(user.id)
        if (!rateLimit.allowed) {
          return createRateLimitResponse(rateLimit)
        }
      }
    }

    const pendingExtractionId = user ? randomUUID() : null

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
          const pendingAiUsageLogs: PendingAiUsageLogInput[] = []

          if (context.sourceType === 'youtube') {
            send('status', {
              step: 'cache',
              message: 'Verificando caché del video...',
            })
          }

          if (context.cachedVideo) {
            const cachedResult = await buildCachedExtractionResult({
              userId: user?.id ?? null,
              rawUrl: context.rawUrl,
              videoId: context.videoId!,
              mode: context.mode,
              outputLanguage: context.outputLanguage,
              sourceType: context.sourceType,
              bodySourceLabel: context.bodySourceLabel,
              cachedVideo: context.cachedVideo,
              promptVersion: context.promptVersion,
              extractionModel: context.extractionModel,
            })

            send('status', {
              step: 'cached',
              message: 'Resultado obtenido desde caché.',
            })
            send('result', {
              ...cachedResult,
              hasSourceText: false,
            })
            send('done', { ok: true })
            close()
            return
          }

          const resolvedContent = await resolveExtractionSourceContent({
            sourceType: context.sourceType,
            rawUrl: context.rawUrl,
            rawText: context.rawText,
            videoId: context.videoId,
            fallbackVideoCache: context.fallbackVideoCache,
            extractionProvider: context.extractionProvider,
            extractionModel: context.extractionModel,
            userId: user?.id ?? null,
            onUsage: (usage) => {
              pendingAiUsageLogs.push(usage)
            },
            onStatus: (update) => send('status', update),
          })

          const preparedContent = await prepareContentForExtraction({
            text: resolvedContent.contentText,
            provider: context.extractionProvider,
            model: context.extractionModel,
            userId: user?.id ?? null,
            sourceType: context.sourceType,
            onUsage: (usage) => {
              pendingAiUsageLogs.push(usage)
            },
            onProgress: (progress) => send('status', progress),
          })
          const finalTranscript = preparedContent.finalText
          const wordCount = resolvedContent.contentText.split(/\s+/).length
          const { originalTime, savedTime } = estimateTime(wordCount)
          const resolvedOutputLanguage = resolveExtractionOutputLanguage(
            context.outputLanguage,
            finalTranscript
          )

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
                    provider: context.extractionProvider,
                    model: context.extractionModel,
                    system: buildExtractionSystemPrompt(
                      context.mode,
                      resolvedOutputLanguage,
                      context.systemOverride
                    ),
                    messages: [
                      {
                        role: 'user',
                        content: buildExtractionUserPrompt(
                          finalTranscript,
                          context.mode,
                          resolvedOutputLanguage,
                          context.userOverride
                        ),
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
            pendingAiUsageLogs.push({
              provider: context.extractionProvider,
              model: context.extractionModel,
              useType: 'extraction',
              userId: user?.id ?? null,
              sourceType: context.sourceType,
              inputTokens: aiResult.inputTokens,
              outputTokens: aiResult.outputTokens,
              costUsd: estimateCostUsd(
                context.extractionModel,
                aiResult.inputTokens,
                aiResult.outputTokens
              ),
              pricingVersion: AI_PRICING_VERSION,
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
              provider: context.extractionProvider,
              model: context.extractionModel,
              originalTime,
              savedTime,
              mode: context.mode,
              resolvedOutputLanguage,
              userId: user?.id ?? null,
              sourceType: context.sourceType,
              onUsage: (usage) => {
                pendingAiUsageLogs.push(usage)
              },
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

          const result = await finalizeExtractionResult({
            userId: user?.id ?? null,
            pendingExtractionId,
            pendingAiUsageLogs,
            responsePayload,
            rawUrl: context.rawUrl,
            videoId: context.videoId,
            mode: context.mode,
            outputLanguage: context.outputLanguage,
            resolvedOutputLanguage,
            sourceType: context.sourceType,
            bodySourceLabel: context.bodySourceLabel,
            bodySourceFileUrl: context.bodySourceFileUrl,
            bodySourceFileName: context.bodySourceFileName,
            bodySourceFileSizeBytes: context.bodySourceFileSizeBytes,
            bodySourceFileMimeType: context.bodySourceFileMimeType,
            contentText: resolvedContent.contentText,
            contentTitle: resolvedContent.contentTitle,
            transcriptSource: resolvedContent.transcriptSource,
            promptVersion: context.promptVersion,
            extractionModel: context.extractionModel,
            previewPromise: resolvedContent.previewPromise,
          })

          send('result', result)
          send('done', { ok: true })
        } catch (error: unknown) {
          if (error instanceof ExtractionRequestError) {
            send('error', { message: error.message })
          } else {
            console.error('[ActionExtractor] extract stream error:', error)
            send('error', {
              message:
                'No se pudo completar la extracción por un error interno. Intenta nuevamente en unos minutos.',
            })
          }
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
  } catch (error: unknown) {
    if (error instanceof ExtractionRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('[ActionExtractor] extract stream setup error:', error)
    return NextResponse.json(
      {
        error:
          'No se pudo completar la extracción por un error interno. Intenta nuevamente en unos minutos.',
      },
      { status: 500 }
    )
  }
}
