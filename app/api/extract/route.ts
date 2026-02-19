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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const EXTRACTION_MODEL = 'claude-sonnet-4-6'
const EXTRACTION_PROMPT_VERSION = 'action-plan-v1'

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function estimateTime(wordCount: number) {
  const totalMinutes = Math.round(wordCount / 150) // ~150 wpm speech rate
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const originalTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  const savedMinutes = Math.max(totalMinutes - 3, 0)
  const savedH = Math.floor(savedMinutes / 60)
  const savedM = savedMinutes % 60
  const savedTime = savedH > 0 ? `${savedH}h ${savedM}m` : `${savedM}m`
  return { originalTime, savedTime }
}

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

      const saved = await createExtraction({
        userId: user.id,
        url,
        videoId,
        objective: responsePayload.objective,
        phasesJson: JSON.stringify(responsePayload.phases),
        proTip: responsePayload.proTip,
        metadataJson: JSON.stringify(responsePayload.metadata),
      })

      return NextResponse.json({
        ...responsePayload,
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

    const message = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 2048,
      system: `Eres un estratega de negocios experto. Tu función es analizar transcripciones de videos/podcasts y extraer ÚNICAMENTE las acciones concretas y ejecutables, eliminando todo relleno, anécdotas y motivación genérica.

REGLAS ESTRICTAS:
- Cada acción debe ser específica, medible y comenzar con verbo de acción (Define, Crea, Identifica, Implementa, Establece, Documenta, etc.)
- Elimina toda anécdota, motivación o consejo vago
- Genera entre 4 y 6 fases, cada una con 3 a 5 items
- La dificultad refleja recursos y habilidades requeridas: "Fácil", "Media" o "Difícil"
- El consejo pro debe ser la táctica más contraintuitiva o menos obvia del contenido`,
      messages: [
        {
          role: 'user',
          content: `Analiza la transcripción y responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

{
  "objective": "Descripción en 1-2 oraciones del objetivo central del contenido",
  "phases": [
    {
      "id": 1,
      "title": "Fase 1: Nombre Descriptivo",
      "items": ["Acción específica 1", "Acción específica 2", "Acción específica 3"]
    }
  ],
  "proTip": "La táctica más específica y contraintuitiva del contenido",
  "metadata": {
    "difficulty": "Media",
    "readingTime": "3 min"
  }
}

TRANSCRIPCIÓN:
${finalTranscript}`,
        },
      ],
    })

    const block = message.content[0]
    if (block.type !== 'text') {
      throw new Error('Respuesta inesperada del modelo.')
    }

    // Strip potential markdown code fences
    const cleaned = block.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let extracted
    try {
      extracted = JSON.parse(cleaned)
    } catch {
      throw new Error('El modelo devolvió JSON inválido. Intenta de nuevo.')
    }

    const responsePayload = {
      objective: typeof extracted.objective === 'string' ? extracted.objective : '',
      phases: Array.isArray(extracted.phases) ? extracted.phases : [],
      proTip: typeof extracted.proTip === 'string' ? extracted.proTip : '',
      metadata: {
        readingTime:
          typeof extracted.metadata?.readingTime === 'string'
            ? extracted.metadata.readingTime
            : '3 min',
        difficulty:
          typeof extracted.metadata?.difficulty === 'string'
            ? extracted.metadata.difficulty
            : 'Media',
        originalTime,
        savedTime,
      },
    }

    await upsertVideoCache({
      videoId,
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
      objective: responsePayload.objective,
      phasesJson: JSON.stringify(responsePayload.phases),
      proTip: responsePayload.proTip,
      metadataJson: JSON.stringify(responsePayload.metadata),
    })

    return NextResponse.json({
      ...responsePayload,
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
