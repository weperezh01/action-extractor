import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { deleteCloudinaryAsset } from '@/lib/cloudinary'
import {
  deleteExtractionTaskAttachmentByIdForUser,
  findExtractionTaskByIdForUser,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function safeParseObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { extractionId: string; taskId: string; attachmentId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseId(context.params?.extractionId)
    const taskId = parseId(context.params?.taskId)
    const attachmentId = parseId(context.params?.attachmentId)
    if (!extractionId || !taskId || !attachmentId) {
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

    const deleted = await deleteExtractionTaskAttachmentByIdForUser({
      attachmentId,
      taskId,
      extractionId,
      userId: user.id,
    })
    if (!deleted) {
      return NextResponse.json({ error: 'No se encontró la evidencia solicitada.' }, { status: 404 })
    }

    if (deleted.storage_provider === 'cloudinary') {
      const metadata = safeParseObject(deleted.metadata_json) as {
        publicId?: unknown
        resourceType?: unknown
      }
      const publicId =
        typeof metadata.publicId === 'string' ? metadata.publicId.trim() : ''
      const resourceType =
        typeof metadata.resourceType === 'string' ? metadata.resourceType.trim() : null

      if (publicId) {
        void deleteCloudinaryAsset({
          publicId,
          resourceType,
        })
      }
    }

    return NextResponse.json({
      deletedAttachmentId: deleted.id,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la evidencia.'
    console.error('[ActionExtractor] task attachments DELETE error:', message)
    return NextResponse.json({ error: 'No se pudo eliminar la evidencia.' }, { status: 500 })
  }
}
