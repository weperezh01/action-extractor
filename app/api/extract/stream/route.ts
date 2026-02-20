import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptEmptyError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from '@danielxceron/youtube-transcript'
import { getUserFromRequest } from '@/lib/auth'
import { createExtraction, findVideoCacheByVideoId, upsertVideoCache } from '@/lib/db'
import {
  buildExtractionUserPrompt,
  estimateTime,
  EXTRACTION_MODEL,
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_PROMPT,
  extractVideoId,
  parseExtractionModelText,
} from '@/lib/extract-core'
import { resolveVideoPreview } from '@/lib/video-preview'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

function getTranscriptErrorMessage(error: unknown) {
  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return 'YouTube bloqueó temporalmente la extracción por demasiadas solicitudes desde este servidor. Intenta más tarde.'
  }

  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    return 'El video no está disponible o no puede consultarse desde este servidor.'
  }

  if (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError ||
    error instanceof YoutubeTranscriptNotAvailableLanguageError ||
    error instanceof YoutubeTranscriptEmptyError
  ) {
    return 'No se encontró transcripción para este video. Asegúrate de que tenga subtítulos habilitados (automáticos o manuales).'
  }

  return 'No se pudo obtener la transcripción desde YouTube. Intenta con otro video o vuelve a intentar en unos minutos.'
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Servicio de IA no configurado.' }, { status: 503 })
  }

  const encoder = new TextEncoder()
  let modelStream: ReturnType<typeof anthropic.messages.stream> | null = null
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

        const cachedVideo = await findVideoCacheByVideoId({
          videoId,
          promptVersion: EXTRACTION_PROMPT_VERSION,
          model: EXTRACTION_MODEL,
        })

        if (cachedVideo) {
          const cachedMetadata = safeParse(cachedVideo.metadata_json, {
            readingTime: '3 min',
            difficulty: 'Media',
            originalTime: '0m',
            savedTime: '0m',
          })

          const responsePayload = {
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
              promptVersion: EXTRACTION_PROMPT_VERSION,
              model: EXTRACTION_MODEL,
            })
          }

          const saved = await createExtraction({
            userId: user.id,
            url,
            videoId,
            videoTitle: videoPreview.videoTitle,
            thumbnailUrl: videoPreview.thumbnailUrl,
            objective: responsePayload.objective,
            phasesJson: JSON.stringify(responsePayload.phases),
            proTip: responsePayload.proTip,
            metadataJson: JSON.stringify(responsePayload.metadata),
          })

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
            id: saved.id,
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

        let transcriptText = ''
        try {
          const segments = await YoutubeTranscript.fetchTranscript(videoId)
          if (!segments.length) {
            send('error', {
              message: 'No se encontró transcripción utilizable para este video. Prueba con otro enlace.',
            })
            send('done', { ok: false })
            close()
            return
          }
          transcriptText = segments.map((segment) => segment.text).join(' ')
        } catch (error: unknown) {
          send('error', { message: getTranscriptErrorMessage(error) })
          send('done', { ok: false })
          close()
          return
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

        send('status', {
          step: 'analyzing',
          message: 'Analizando contenido con IA...',
        })

        modelStream = anthropic.messages
          .stream({
            model: EXTRACTION_MODEL,
            max_tokens: 2048,
            system: EXTRACTION_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: buildExtractionUserPrompt(finalTranscript),
              },
            ],
          })
          .on('text', (chunk) => {
            if (!chunk) return
            send('text', { chunk })
          })

        const modelText = await modelStream.finalText()
        const responsePayload = parseExtractionModelText(modelText, {
          originalTime,
          savedTime,
        })
        const videoPreview = await previewPromise

        await upsertVideoCache({
          videoId,
          videoTitle: videoPreview.videoTitle,
          thumbnailUrl: videoPreview.thumbnailUrl,
          objective: responsePayload.objective,
          phasesJson: JSON.stringify(responsePayload.phases),
          proTip: responsePayload.proTip,
          metadataJson: JSON.stringify(responsePayload.metadata),
          promptVersion: EXTRACTION_PROMPT_VERSION,
          model: EXTRACTION_MODEL,
        })

        const saved = await createExtraction({
          userId: user.id,
          url,
          videoId,
          videoTitle: videoPreview.videoTitle,
          thumbnailUrl: videoPreview.thumbnailUrl,
          objective: responsePayload.objective,
          phasesJson: JSON.stringify(responsePayload.phases),
          proTip: responsePayload.proTip,
          metadataJson: JSON.stringify(responsePayload.metadata),
        })

        send('result', {
          ...responsePayload,
          url,
          videoId,
          videoTitle: videoPreview.videoTitle,
          thumbnailUrl: videoPreview.thumbnailUrl,
          id: saved.id,
          createdAt: saved.created_at,
          cached: false,
        })
        send('done', { ok: true })
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error interno del servidor.'
        console.error('[ActionExtractor] extract stream error:', message)
        send('error', { message })
        send('done', { ok: false })
      } finally {
        close()
      }
    },
    cancel() {
      if (modelStream) {
        modelStream.abort()
      }
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
