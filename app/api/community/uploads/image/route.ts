import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { isCloudinaryConfigured, uploadFileToCloudinary } from '@/lib/cloudinary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_IMAGE_MB = 8
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function normalizeFilename(rawFile: File) {
  const trimmed = rawFile.name?.trim()
  if (trimmed) return trimmed
  return `community-image-${Date.now()}`
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: 'El servidor no tiene Cloudinary configurado.' },
        { status: 503 }
      )
    }

    const formData = await req.formData()
    const rawFile = formData.get('file')

    if (!(rawFile instanceof File)) {
      return NextResponse.json({ error: 'Debes adjuntar una imagen válida.' }, { status: 400 })
    }

    if (rawFile.size <= 0) {
      return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 })
    }

    const maxBytes = MAX_IMAGE_MB * 1024 * 1024
    if (rawFile.size > maxBytes) {
      return NextResponse.json(
        { error: `La imagen supera el límite de ${MAX_IMAGE_MB}MB.` },
        { status: 400 }
      )
    }

    const mimeType = (rawFile.type || '').trim().toLowerCase()
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Solo se permiten imágenes JPG, PNG, WebP o GIF.' },
        { status: 400 }
      )
    }

    const upload = await uploadFileToCloudinary({
      fileBuffer: Buffer.from(await rawFile.arrayBuffer()),
      filename: normalizeFilename(rawFile),
      mimeType,
    })

    return NextResponse.json({
      attachment: {
        attachmentType: 'image',
        storageProvider: 'cloudinary',
        url: upload.secureUrl,
        thumbnailUrl: upload.secureUrl,
        title: rawFile.name?.trim() || null,
        mimeType,
        metadata: {
          publicId: upload.publicId,
          bytes: upload.bytes,
          width: upload.width,
          height: upload.height,
          format: upload.format,
          resourceType: upload.resourceType,
          duration: upload.duration,
        },
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo subir la imagen.'
    console.error('[ActionExtractor] community image upload error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
