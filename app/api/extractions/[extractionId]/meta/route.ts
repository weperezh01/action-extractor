import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findExtractionByIdForUser, updateExtractionMetaForUser } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function PATCH(
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

    const b = body as { title?: unknown; thumbnailUrl?: unknown; objective?: unknown }

    const rawTitle = typeof b.title === 'string' ? b.title.trim().slice(0, 300) : null
    const videoTitle = rawTitle && rawTitle.length > 0 ? rawTitle : 'Sin título'
    const thumbnailUrl =
      b.thumbnailUrl === null ? null : typeof b.thumbnailUrl === 'string' ? b.thumbnailUrl.trim() || null : undefined
    const objective = typeof b.objective === 'string' ? b.objective.trim() : null

    if (thumbnailUrl === undefined) {
      return NextResponse.json({ error: 'thumbnailUrl inválido.' }, { status: 400 })
    }

    const existing = await findExtractionByIdForUser({ id: extractionId, userId: user.id })
    if (!existing) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    const updated = await updateExtractionMetaForUser({
      id: extractionId,
      userId: user.id,
      videoTitle,
      sourceLabel: videoTitle,
      thumbnailUrl,
      objective: objective ?? existing.objective,
    })

    if (!updated) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    return NextResponse.json({
      extractionId: updated.id,
      videoTitle: updated.video_title,
      sourceLabel: updated.source_label,
      thumbnailUrl: updated.thumbnail_url,
      objective: updated.objective,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la información.'
    console.error('[ActionExtractor] extraction meta PATCH error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar la información.' }, { status: 500 })
  }
}
