import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteExtractionByIdForUser,
  deleteExtractionsByUser,
  listExtractionsByUser,
} from '@/lib/db'
import { normalizeExtractionMode } from '@/lib/extraction-modes'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const rows = await listExtractionsByUser(user.id, 50)
  const history = rows.map((row) => ({
    id: row.id,
    url: row.url,
    videoId: row.video_id,
    videoTitle: row.video_title,
    thumbnailUrl: row.thumbnail_url || (row.video_id ? buildYoutubeThumbnailUrl(row.video_id) : null),
    mode: normalizeExtractionMode(row.extraction_mode),
    objective: row.objective,
    phases: safeParse(row.phases_json, []),
    proTip: row.pro_tip,
    metadata: safeParse(row.metadata_json, {
      readingTime: '3 min',
      difficulty: 'Media',
      originalTime: '0m',
      savedTime: '0m',
    }),
    createdAt: row.created_at,
  }))

  return NextResponse.json({ history })
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      body = null
    }

    const extractionId =
      typeof (body as { extractionId?: unknown } | null)?.extractionId === 'string'
        ? ((body as { extractionId: string }).extractionId || '').trim()
        : ''
    const clearAll = (body as { all?: unknown } | null)?.all === true

    if (extractionId) {
      const deleted = await deleteExtractionByIdForUser({ id: extractionId, userId: user.id })
      if (deleted === 0) {
        return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, deletedCount: deleted })
    }

    if (clearAll) {
      const deleted = await deleteExtractionsByUser(user.id)
      return NextResponse.json({ ok: true, deletedCount: deleted })
    }

    return NextResponse.json(
      { error: 'Debes indicar extractionId o all=true.' },
      { status: 400 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] history delete error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar el historial.' }, { status: 500 })
  }
}
