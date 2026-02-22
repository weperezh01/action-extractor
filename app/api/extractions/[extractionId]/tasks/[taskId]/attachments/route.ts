import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { uploadFileToCloudinary } from '@/lib/cloudinary'
import {
  createExtractionTaskAttachmentForUser,
  findExtractionTaskByIdForUser,
  listExtractionTaskAttachmentsForUser,
  type DbExtractionTaskAttachment,
  type ExtractionTaskAttachmentType,
} from '@/lib/db'
import { buildYoutubeThumbnailUrl, fetchYoutubeVideoTitle } from '@/lib/video-preview'
import { buildYoutubeWatchUrl, extractYoutubeVideoId } from '@/lib/youtube'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return {}
  }
}

function toClientAttachment(attachment: DbExtractionTaskAttachment) {
  return {
    id: attachment.id,
    taskId: attachment.task_id,
    extractionId: attachment.extraction_id,
    attachmentType: attachment.attachment_type,
    storageProvider: attachment.storage_provider,
    url: attachment.url,
    thumbnailUrl: attachment.thumbnail_url,
    title: attachment.title,
    mimeType: attachment.mime_type,
    sizeBytes: attachment.size_bytes,
    metadataJson: attachment.metadata_json,
    metadata: safeParseJson(attachment.metadata_json),
    createdAt: attachment.created_at,
    updatedAt: attachment.updated_at,
  }
}

function resolveAttachmentTypeByMime(mimeType: string): ExtractionTaskAttachmentType | null {
  const normalized = mimeType.trim().toLowerCase()
  if (!normalized) return null

  if (normalized === 'application/pdf') return 'pdf'
  if (normalized.startsWith('image/')) return 'image'
  if (normalized.startsWith('audio/')) return 'audio'
  return null
}

function getMaxUploadBytes() {
  const parsed = Number.parseInt(process.env.CLOUDINARY_MAX_UPLOAD_MB ?? '25', 10)
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : 25
  return mb * 1024 * 1024
}

export async function GET(
  req: NextRequest,
  context: { params: { extractionId: string; taskId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseId(context.params?.extractionId)
    const taskId = parseId(context.params?.taskId)
    if (!extractionId || !taskId) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }

    const task = await findExtractionTaskByIdForUser({
      taskId,
      extractionId,
      userId: user.id,
    })
    if (!task) {
      return NextResponse.json({ error: 'No se encontró el subítem solicitado.' }, { status: 404 })
    }

    const attachments = await listExtractionTaskAttachmentsForUser({
      taskId,
      extractionId,
      userId: user.id,
    })

    return NextResponse.json({
      attachments: attachments.map(toClientAttachment),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las evidencias.'
    console.error('[ActionExtractor] task attachments GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar las evidencias.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { extractionId: string; taskId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseId(context.params?.extractionId)
    const taskId = parseId(context.params?.taskId)
    if (!extractionId || !taskId) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }

    const task = await findExtractionTaskByIdForUser({
      taskId,
      extractionId,
      userId: user.id,
    })
    if (!task) {
      return NextResponse.json({ error: 'No se encontró el subítem solicitado.' }, { status: 404 })
    }

    const contentType = (req.headers.get('content-type') ?? '').toLowerCase()

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const rawFile = formData.get('file')
      if (!(rawFile instanceof File)) {
        return NextResponse.json({ error: 'Debes adjuntar un archivo válido.' }, { status: 400 })
      }

      const maxUploadBytes = getMaxUploadBytes()
      if (rawFile.size <= 0) {
        return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 })
      }
      if (rawFile.size > maxUploadBytes) {
        const maxMb = Math.round(maxUploadBytes / (1024 * 1024))
        return NextResponse.json(
          { error: `El archivo supera el límite permitido de ${maxMb}MB.` },
          { status: 400 }
        )
      }

      const mimeType = (rawFile.type || '').trim().toLowerCase()
      const attachmentType = resolveAttachmentTypeByMime(mimeType)
      if (!attachmentType) {
        return NextResponse.json(
          { error: 'Solo se permiten archivos PDF, imagen o audio.' },
          { status: 400 }
        )
      }

      const upload = await uploadFileToCloudinary({
        fileBuffer: Buffer.from(await rawFile.arrayBuffer()),
        filename: rawFile.name?.trim() || `adjunto-${Date.now()}`,
        mimeType: mimeType || 'application/octet-stream',
      })

      const created = await createExtractionTaskAttachmentForUser({
        taskId,
        extractionId,
        userId: user.id,
        attachmentType,
        storageProvider: 'cloudinary',
        url: upload.secureUrl,
        thumbnailUrl:
          attachmentType === 'image' ? upload.secureUrl : attachmentType === 'pdf' ? upload.secureUrl : null,
        title: rawFile.name?.trim() || null,
        mimeType: mimeType || null,
        sizeBytes: rawFile.size,
        metadataJson: JSON.stringify({
          publicId: upload.publicId,
          resourceType: upload.resourceType,
          format: upload.format,
          width: upload.width,
          height: upload.height,
          duration: upload.duration,
        }),
      })
      if (!created) {
        return NextResponse.json({ error: 'No se pudo guardar la evidencia.' }, { status: 404 })
      }

      return NextResponse.json(
        {
          attachment: toClientAttachment(created),
        },
        { status: 201 }
      )
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const youtubeUrl =
      typeof (body as { youtubeUrl?: unknown }).youtubeUrl === 'string'
        ? (body as { youtubeUrl: string }).youtubeUrl.trim()
        : typeof (body as { url?: unknown }).url === 'string'
          ? (body as { url: string }).url.trim()
          : ''

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: 'Debes enviar un archivo o una URL de YouTube válida.' },
        { status: 400 }
      )
    }

    const videoId = extractYoutubeVideoId(youtubeUrl)
    if (!videoId) {
      return NextResponse.json({ error: 'URL de YouTube inválida.' }, { status: 400 })
    }

    const canonicalUrl = buildYoutubeWatchUrl(videoId)
    const thumbnailUrl = buildYoutubeThumbnailUrl(videoId)
    const videoTitle = await fetchYoutubeVideoTitle(videoId)

    const created = await createExtractionTaskAttachmentForUser({
      taskId,
      extractionId,
      userId: user.id,
      attachmentType: 'youtube_link',
      storageProvider: 'external',
      url: canonicalUrl,
      thumbnailUrl,
      title: videoTitle,
      metadataJson: JSON.stringify({ videoId }),
    })
    if (!created) {
      return NextResponse.json({ error: 'No se pudo guardar el enlace.' }, { status: 404 })
    }

    return NextResponse.json(
      {
        attachment: toClientAttachment(created),
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la evidencia.'
    console.error('[ActionExtractor] task attachments POST error:', message)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo guardar la evidencia.' },
      { status: 500 }
    )
  }
}
