import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createExtractionAdditionalSourceForUser,
  findExtractionAccessForUser,
  getExtractionSourceData,
  listExtractionAdditionalSources,
} from '@/lib/db/extractions'
import { detectSourceType } from '@/lib/source-detector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function normalizeUrl(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function normalizeLabel(raw: unknown) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().slice(0, 200)
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNullableText(raw: unknown) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNullableFileUrl(raw: unknown) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.startsWith('https://') || trimmed.startsWith('/api/uploads/') ? trimmed : null
}

function normalizeNullableFileName(raw: unknown) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().slice(0, 500)
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNullableMimeType(raw: unknown) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().slice(0, 200)
  return trimmed.length > 0 ? trimmed : null
}

function normalizeNullableFileSize(raw: unknown) {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function GET(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  const user = await getUserFromRequest(req)
  const extractionId = parseExtractionId(context.params?.extractionId)

  if (!extractionId) {
    return NextResponse.json({ error: 'ID de extracción requerido.' }, { status: 400 })
  }

  const [primarySource, additionalSources] = await Promise.all([
    getExtractionSourceData({
      extractionId,
      requestingUserId: user?.id ?? null,
    }),
    listExtractionAdditionalSources({
      extractionId,
      requestingUserId: user?.id ?? null,
    }),
  ])

  if (!primarySource || additionalSources === null) {
    return NextResponse.json({ error: 'Extracción no encontrada o sin acceso.' }, { status: 404 })
  }

  return NextResponse.json({
    sources: [
      {
        id: `primary:${extractionId}`,
        kind: 'primary',
        analysisStatus: 'analyzed',
        analyzedAt: null,
        url: primarySource.url,
        sourceType: primarySource.sourceType,
        sourceLabel: primarySource.sourceLabel ?? primarySource.videoTitle,
        createdAt: '',
        sourceFileUrl: primarySource.sourceFileUrl,
        sourceFileName: primarySource.sourceFileName,
        sourceFileSizeBytes: primarySource.sourceFileSizeBytes,
        sourceFileMimeType: primarySource.sourceFileMimeType,
        hasSourceText: Boolean(primarySource.sourceText?.trim()),
      },
      ...additionalSources.map((source) => ({
        id: source.id,
        kind: 'additional',
        analysisStatus: source.analysis_status,
        analyzedAt: source.analyzed_at,
        url: source.url,
        sourceType: source.source_type,
        sourceLabel: source.source_label,
        createdAt: source.created_at,
        sourceFileUrl: source.source_file_url,
        sourceFileName: source.source_file_name,
        sourceFileSizeBytes: source.source_file_size_bytes,
        sourceFileMimeType: source.source_file_mime_type,
        hasSourceText: Boolean(source.source_text?.trim()),
      })),
    ],
  })
}

export async function POST(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const extractionId = parseExtractionId(context.params?.extractionId)
  if (!extractionId) {
    return NextResponse.json({ error: 'ID de extracción requerido.' }, { status: 400 })
  }

  const access = await findExtractionAccessForUser({
    id: extractionId,
    userId: user.id,
  })
  if (!access.extraction) {
    return NextResponse.json({ error: 'Extracción no encontrada.' }, { status: 404 })
  }
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño puede agregar fuentes.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const url = normalizeUrl((body as { url?: unknown } | null)?.url)
  const sourceLabel = normalizeLabel((body as { sourceLabel?: unknown } | null)?.sourceLabel)
  const sourceText = normalizeNullableText((body as { sourceText?: unknown } | null)?.sourceText)
  const sourceFileUrl = normalizeNullableFileUrl((body as { sourceFileUrl?: unknown } | null)?.sourceFileUrl)
  const sourceFileName = normalizeNullableFileName((body as { sourceFileName?: unknown } | null)?.sourceFileName)
  const sourceFileSizeBytes = normalizeNullableFileSize((body as { sourceFileSizeBytes?: unknown } | null)?.sourceFileSizeBytes)
  const sourceFileMimeType = normalizeNullableMimeType((body as { sourceFileMimeType?: unknown } | null)?.sourceFileMimeType)
  const rawSourceType = typeof (body as { sourceType?: unknown } | null)?.sourceType === 'string'
    ? (body as { sourceType: string }).sourceType.trim()
    : ''

  const detectedSourceType = url ? detectSourceType(url) : null
  const sourceType =
    rawSourceType === 'pdf' || rawSourceType === 'docx' || rawSourceType === 'text'
      ? rawSourceType
      : detectedSourceType

  if (sourceType === 'youtube' || sourceType === 'web_url') {
    if (!url || !isHttpUrl(url)) {
      return NextResponse.json({ error: 'Ingresa una URL válida.' }, { status: 400 })
    }
  } else if (sourceType === 'pdf' || sourceType === 'docx' || sourceType === 'text') {
    if (!sourceText || !sourceFileName) {
      return NextResponse.json(
        { error: 'Debes subir un archivo válido antes de guardarlo como fuente.' },
        { status: 400 }
      )
    }
  } else {
    return NextResponse.json(
      { error: 'Solo se permiten enlaces web, YouTube, PDF, Word o TXT como fuente adicional.' },
      { status: 400 }
    )
  }

  const created = await createExtractionAdditionalSourceForUser({
    extractionId,
    userId: user.id,
    sourceType,
    sourceLabel,
    url: url || null,
    sourceText,
    sourceFileUrl,
    sourceFileName,
    sourceFileSizeBytes,
    sourceFileMimeType,
    analysisStatus: 'pending',
  })

  if (!created) {
    return NextResponse.json(
      { error: 'No se pudo guardar la fuente adicional. Verifica que no esté repetida.' },
      { status: 409 }
    )
  }

  return NextResponse.json(
    {
      source: {
        id: created.id,
        kind: 'additional',
        analysisStatus: created.analysis_status,
        analyzedAt: created.analyzed_at,
        url: created.url,
        sourceType: created.source_type,
        sourceLabel: created.source_label,
        createdAt: created.created_at,
        sourceFileUrl: created.source_file_url,
        sourceFileName: created.source_file_name,
        sourceFileSizeBytes: created.source_file_size_bytes,
        sourceFileMimeType: created.source_file_mime_type,
        hasSourceText: Boolean(created.source_text?.trim()),
      },
    },
    { status: 201 }
  )
}
