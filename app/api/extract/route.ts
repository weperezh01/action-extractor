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

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const body = await req.json()
    const url: string = body?.url ?? ''

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

      return NextResponse.json({
        ...responsePayload,
        url,
        videoId,
        videoTitle: videoPreview.videoTitle,
        thumbnailUrl: videoPreview.thumbnailUrl,
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

    // Fetch transcript
    let transcriptText = ''
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId)
      if (!segments.length) {
        return NextResponse.json(
          {
            error:
              'No se encontró transcripción utilizable para este video. Prueba con otro enlace.',
          },
          { status: 422 }
        )
      }
      transcriptText = segments.map((s) => s.text).join(' ')
    } catch (error: unknown) {
      if (error instanceof YoutubeTranscriptTooManyRequestError) {
        return NextResponse.json(
          {
            error:
              'YouTube bloqueó temporalmente la extracción por demasiadas solicitudes desde este servidor. Intenta más tarde.',
          },
          { status: 429 }
        )
      }

      if (error instanceof YoutubeTranscriptVideoUnavailableError) {
        return NextResponse.json(
          {
            error:
              'El video no está disponible o no puede consultarse desde este servidor.',
          },
          { status: 404 }
        )
      }

      if (
        error instanceof YoutubeTranscriptDisabledError ||
        error instanceof YoutubeTranscriptNotAvailableError ||
        error instanceof YoutubeTranscriptNotAvailableLanguageError ||
        error instanceof YoutubeTranscriptEmptyError
      ) {
        return NextResponse.json(
          {
            error:
              'No se encontró transcripción para este video. Asegúrate de que tenga subtítulos habilitados (automáticos o manuales).',
          },
          { status: 422 }
        )
      }

      return NextResponse.json(
        {
          error:
            'No se pudo obtener la transcripción desde YouTube. Intenta con otro video o vuelve a intentar en unos minutos.',
        },
        { status: 502 }
      )
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
    const previewPromise = resolveVideoPreview({ videoId })

    const message = await anthropic.messages.create({
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

    const block = message.content[0]
    if (block.type !== 'text') {
      throw new Error('Respuesta inesperada del modelo.')
    }

    const responsePayload = parseExtractionModelText(block.text, {
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

    return NextResponse.json({
      ...responsePayload,
      url,
      videoId,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      id: saved.id,
      createdAt: saved.created_at,
      cached: false,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] extract error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
