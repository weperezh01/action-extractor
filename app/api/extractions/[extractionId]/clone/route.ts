import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  cloneExtractionForUser,
  findCloneableExtractionAccessForUser,
  findExtractionFolderByIdForUser,
  type ExtractionClonePermission,
} from '@/lib/db'
import {
  findExtractionByIdForUser,
  findExtractionOrderNumberForUser,
} from '@/lib/db/extractions'
import { normalizeExtractionMode } from '@/lib/extraction-modes'
import { normalizePlaybookPhases } from '@/lib/playbook-tree'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CloneMode = 'full' | 'template'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseCloneMode(raw: unknown): CloneMode | null {
  if (raw === 'full' || raw === 'template') return raw
  return null
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function resolveSourceDisplayTitle(input: {
  video_title: string | null
  source_label: string | null
  objective: string
}) {
  return (
    input.video_title?.trim() ||
    input.source_label?.trim() ||
    input.objective.trim() ||
    'Sin título'
  )
}

function canCloneByPermission(input: {
  isOwner: boolean
  clonePermission: ExtractionClonePermission
  mode: CloneMode
}) {
  if (input.isOwner) return true
  if (input.clonePermission === 'full') return true
  if (input.clonePermission === 'template_only') return input.mode === 'template'
  return false
}

export async function POST(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseExtractionId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const mode = parseCloneMode((body as { mode?: unknown } | null)?.mode)
    if (!mode) {
      return NextResponse.json({ error: 'mode inválido.' }, { status: 400 })
    }

    const rawName = typeof (body as { name?: unknown } | null)?.name === 'string'
      ? (body as { name: string }).name.trim().slice(0, 300)
      : ''
    const rawFolderId = (body as { folderId?: unknown } | null)?.folderId
    const folderId =
      rawFolderId === null
        ? null
        : typeof rawFolderId === 'string' && rawFolderId.trim()
          ? rawFolderId.trim()
          : null

    if (rawFolderId !== undefined && rawFolderId !== null && folderId === null) {
      return NextResponse.json({ error: 'folderId inválido.' }, { status: 400 })
    }

    if (folderId) {
      const folder = await findExtractionFolderByIdForUser({ id: folderId, userId: user.id })
      if (!folder) {
        return NextResponse.json({ error: 'La carpeta destino no existe.' }, { status: 400 })
      }
    }

    const access = await findCloneableExtractionAccessForUser({
      id: extractionId,
      userId: user.id,
    })

    if (!access.extraction) {
      return NextResponse.json({ error: 'No se encontró el playbook solicitado.' }, { status: 404 })
    }
    if (!access.role) {
      return NextResponse.json({ error: 'No tienes acceso a este playbook.' }, { status: 403 })
    }

    const isOwner = access.role === 'owner'
    const clonePermission = access.extraction.clone_permission
    if (!canCloneByPermission({ isOwner, clonePermission, mode })) {
      return NextResponse.json(
        {
          error:
            clonePermission === 'template_only'
              ? 'El dueño solo permite copiar este playbook como plantilla.'
              : 'El dueño no permite copiar este playbook.',
        },
        { status: 403 }
      )
    }

    const name = rawName || `Copia de ${resolveSourceDisplayTitle(access.extraction)}`

    const cloned = await cloneExtractionForUser({
      sourceExtractionId: extractionId,
      targetUserId: user.id,
      folderId,
      mode,
      name,
    })

    const persistedClone = await findExtractionByIdForUser({
      id: cloned.id,
      userId: user.id,
    })
    if (!persistedClone) {
      return NextResponse.json({ error: 'No se pudo cargar la copia creada.' }, { status: 500 })
    }

    const orderNumber = await findExtractionOrderNumberForUser({
      id: persistedClone.id,
      userId: user.id,
    })

    const metadata = safeParse(persistedClone.metadata_json, {
      readingTime: '3 min',
      difficulty: 'Media',
      originalTime: '0m',
      savedTime: '0m',
    })

    return NextResponse.json({
      item: {
        id: persistedClone.id,
        orderNumber: orderNumber ?? 0,
        shareVisibility: persistedClone.share_visibility ?? 'private',
        clonePermission: persistedClone.clone_permission,
        url: persistedClone.url,
        videoId: persistedClone.video_id,
        videoTitle: persistedClone.video_title,
        thumbnailUrl:
          persistedClone.thumbnail_url ||
          (persistedClone.video_id ? buildYoutubeThumbnailUrl(persistedClone.video_id) : null),
        mode: normalizeExtractionMode(persistedClone.extraction_mode),
        objective: persistedClone.objective,
        phases: normalizePlaybookPhases(safeParse(persistedClone.phases_json, [])),
        proTip: persistedClone.pro_tip,
        metadata,
        createdAt: persistedClone.created_at,
        sourceType: persistedClone.source_type ?? 'youtube',
        transcriptSource: persistedClone.transcript_source ?? null,
        sourceLabel: persistedClone.source_label ?? null,
        sourceFileUrl: persistedClone.source_file_url ?? null,
        sourceFileName: persistedClone.source_file_name ?? null,
        sourceFileSizeBytes: persistedClone.source_file_size_bytes ?? null,
        sourceFileMimeType: persistedClone.source_file_mime_type ?? null,
        hasSourceText: persistedClone.has_source_text === true,
        folderId: persistedClone.folder_id ?? null,
        isStarred: persistedClone.is_starred === true,
        tags: persistedClone.tags ?? [],
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo clonar el playbook.'
    console.error('[ActionExtractor] extraction clone POST error:', message)
    return NextResponse.json({ error: 'No se pudo clonar el playbook.' }, { status: 500 })
  }
}
