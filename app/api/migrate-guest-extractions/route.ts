import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { createExtraction } from '@/lib/db'
import { extractYoutubeVideoId } from '@/lib/youtube'
import { normalizeExtractionMode } from '@/lib/extraction-modes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_EXTRACTIONS = 10 // safety cap — guests can only have 3, but be generous

interface PendingExtraction {
  url?: unknown
  mode?: unknown
  objective?: unknown
  phases?: unknown
  proTip?: unknown
  metadata?: unknown
  videoTitle?: unknown
  thumbnailUrl?: unknown
  sourceType?: unknown
  sourceLabel?: unknown
}

function safeStr(v: unknown, max = 50000): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const rawList = (body as { extractions?: unknown }).extractions
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json({ migrated: 0 })
    }

    const items = rawList.slice(0, MAX_EXTRACTIONS) as PendingExtraction[]
    let migrated = 0

    for (const item of items) {
      const url = safeStr(item.url, 2048)
      const objective = safeStr(item.objective, 10000)
      const proTip = safeStr(item.proTip, 5000)
      const mode = normalizeExtractionMode(item.mode)

      if (!objective) continue // skip empty/malformed entries

      // Resolve youtube video id from url (may be null for non-youtube sources)
      const videoId = url ? (extractYoutubeVideoId(url) ?? null) : null

      // phases — must be a non-empty array
      let phasesJson = '[]'
      if (Array.isArray(item.phases) && item.phases.length > 0) {
        try {
          phasesJson = JSON.stringify(item.phases)
        } catch {
          phasesJson = '[]'
        }
      }

      // metadata
      let metadataJson = '{}'
      if (item.metadata && typeof item.metadata === 'object') {
        try {
          metadataJson = JSON.stringify(item.metadata)
        } catch {
          metadataJson = '{}'
        }
      }

      const sourceType =
        typeof item.sourceType === 'string' && item.sourceType.trim()
          ? item.sourceType.trim()
          : videoId
            ? 'youtube'
            : 'url'

      await createExtraction({
        userId: user.id,
        url: url || null,
        videoId,
        videoTitle: safeStr(item.videoTitle, 500) || null,
        thumbnailUrl: safeStr(item.thumbnailUrl, 2048) || null,
        extractionMode: mode,
        objective,
        phasesJson,
        proTip,
        metadataJson,
        sourceType,
        sourceLabel: safeStr(item.sourceLabel, 300) || null,
      })

      migrated++
    }

    return NextResponse.json({ migrated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al migrar extracciones.'
    console.error('[ActionExtractor] migrate-guest-extractions error:', message)
    return NextResponse.json({ error: 'No se pudieron migrar las extracciones.' }, { status: 500 })
  }
}
