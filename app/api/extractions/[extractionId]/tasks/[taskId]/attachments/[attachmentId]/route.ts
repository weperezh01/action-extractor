import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { deleteCloudinaryAsset } from '@/lib/cloudinary'
import {
  deleteExtractionTaskAttachmentByIdForUser,
  findExtractionAccessForUser,
  findExtractionTaskByIdForUser,
  type ExtractionAccessRole,
} from '@/lib/db'
import { deleteGuestTaskAttachment, findGuestTaskById } from '@/lib/guest-tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

async function resolveAuthAttachmentAccess(input: {
  extractionId: string
  actorUserId: string
}): Promise<
  { ok: true; role: ExtractionAccessRole; canEdit: boolean } | { ok: false; status: 403 | 404; error: string }
> {
  const access = await findExtractionAccessForUser({
    id: input.extractionId,
    userId: input.actorUserId,
  })

  if (!access.extraction) {
    return { ok: false, status: 404, error: 'No se encontró la extracción solicitada.' }
  }

  if (!access.role) {
    return { ok: false, status: 403, error: 'No tienes acceso a esta extracción.' }
  }

  return {
    ok: true,
    role: access.role,
    canEdit: access.role === 'owner' || access.role === 'editor',
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { extractionId: string; taskId: string; attachmentId: string } }
) {
  try {
    const extractionId = parseId(context.params?.extractionId)
    const taskId = parseId(context.params?.taskId)
    const attachmentId = parseId(context.params?.attachmentId)
    if (!extractionId || !taskId || !attachmentId) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }

    // ── Guest mode ──────────────────────────────────────────────────────────
    if (extractionId.startsWith('g-')) {
      const guestId = extractionId.slice(2)
      if (!GUEST_ID_RE.test(guestId)) {
        return NextResponse.json({ error: 'guestId inválido.' }, { status: 400 })
      }
      const task = await findGuestTaskById({ guestId, taskId })
      if (!task) {
        return NextResponse.json({ error: 'No se encontró el subítem solicitado.' }, { status: 404 })
      }
      const deleted = await deleteGuestTaskAttachment({ guestId, taskId, attachmentId })
      if (!deleted) {
        return NextResponse.json({ error: 'No se encontró la evidencia solicitada.' }, { status: 404 })
      }
      return NextResponse.json({ deletedAttachmentId: deleted.id })
    }

    // ── Authenticated mode ──────────────────────────────────────────────────
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const access = await resolveAuthAttachmentAccess({
      extractionId,
      actorUserId: user.id,
    })
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    if (!access.canEdit) {
      return NextResponse.json({ error: 'No tienes permisos para editar evidencias.' }, { status: 403 })
    }

    const task = await findExtractionTaskByIdForUser({
      taskId,
      extractionId,
    })
    if (!task) {
      return NextResponse.json({ error: 'No se encontró el subítem solicitado.' }, { status: 404 })
    }

    const deleted = await deleteExtractionTaskAttachmentByIdForUser({
      attachmentId,
      taskId,
      extractionId,
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
