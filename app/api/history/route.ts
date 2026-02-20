import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { listExtractionsByUser } from '@/lib/db'
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
