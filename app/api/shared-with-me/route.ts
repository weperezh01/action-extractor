import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { listCircleExtractionsForMember } from '@/lib/db'
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
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const rows = await listCircleExtractionsForMember(user.id, 50)
    const items = rows.map((row) => {
      const extraction = row.extraction
      return {
        id: extraction.id,
        orderNumber: extraction.order_number ?? 0,
        shareVisibility: extraction.share_visibility ?? 'private',
        url: extraction.url,
        videoId: extraction.video_id,
        videoTitle: extraction.video_title,
        thumbnailUrl:
          extraction.thumbnail_url ||
          (extraction.video_id ? buildYoutubeThumbnailUrl(extraction.video_id) : null),
        mode: normalizeExtractionMode(extraction.extraction_mode),
        objective: extraction.objective,
        phases: safeParse(extraction.phases_json, []),
        proTip: extraction.pro_tip,
        metadata: safeParse(extraction.metadata_json, {
          readingTime: '3 min',
          difficulty: 'Media',
          originalTime: '0m',
          savedTime: '0m',
        }),
        createdAt: extraction.created_at,
        sourceType: extraction.source_type ?? 'youtube',
        sourceLabel: extraction.source_label ?? null,
        folderId: extraction.folder_id ?? null,
        accessRole: row.access_role,
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
      }
    })

    return NextResponse.json({ items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los compartidos.'
    console.error('[ActionExtractor] shared-with-me GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar los compartidos.' }, { status: 500 })
  }
}
