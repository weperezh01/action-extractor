import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { createExtraction, findExtractionOrderNumberForUser } from '@/lib/db'
import { normalizeExtractionMode } from '@/lib/extraction-modes'

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

    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const rawTitle =
      typeof (body as { title?: unknown })?.title === 'string'
        ? (body as { title: string }).title.trim()
        : ''
    const rawMode = (body as { mode?: unknown })?.mode
    const rawThumbnailUrl =
      typeof (body as { thumbnailUrl?: unknown })?.thumbnailUrl === 'string'
        ? (body as { thumbnailUrl: string }).thumbnailUrl.trim()
        : null

    const title = rawTitle || 'Sin título'
    const mode = normalizeExtractionMode(rawMode)
    const thumbnailUrl = rawThumbnailUrl || null

    const emptyPhases = [
      {
        id: 1,
        title: 'Fase 1',
        items: [{ id: 'p1-n1', text: 'Nuevo ítem', children: [] }],
      },
    ]
    const emptyMetadata = {
      readingTime: '—',
      difficulty: '—',
      originalTime: '—',
      savedTime: '—',
    }

    const row = await createExtraction({
      userId: user.id,
      url: null,
      videoId: null,
      videoTitle: title,
      thumbnailUrl,
      extractionMode: mode,
      objective: '',
      phasesJson: JSON.stringify(emptyPhases),
      proTip: '',
      metadataJson: JSON.stringify(emptyMetadata),
      sourceType: 'manual',
      sourceLabel: title,
    })

    if (!row) {
      return NextResponse.json(
        { error: 'No se pudo crear la extracción manual.' },
        { status: 500 }
      )
    }

    const orderNumber =
      (await findExtractionOrderNumberForUser({ id: row.id, userId: user.id })) ?? 0

    const result = {
      id: row.id,
      orderNumber,
      shareVisibility: row.share_visibility ?? 'private',
      createdAt: row.created_at,
      cached: false,
      url: null,
      videoId: null,
      videoTitle: title,
      thumbnailUrl,
      mode,
      objective: '',
      phases: safeParse(row.phases_json, emptyPhases),
      proTip: '',
      metadata: emptyMetadata,
      sourceType: 'manual' as const,
      sourceLabel: title,
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la extracción manual.'
    console.error('[ActionExtractor] manual extraction POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
