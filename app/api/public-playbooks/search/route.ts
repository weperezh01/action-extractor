import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { listPublicExtractionsForSearch } from '@/lib/db'
import { normalizeExtractionMode } from '@/lib/extraction-modes'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseLimit(raw: string | null) {
  const parsed = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 18
  return Math.min(parsed, 60)
}

function resolveDisplayTitle(input: {
  sourceLabel: string | null
  videoTitle: string | null
  objective: string
  extractionId: string
}) {
  const sourceLabel = input.sourceLabel?.trim()
  if (sourceLabel) return sourceLabel

  const videoTitle = input.videoTitle?.trim()
  if (videoTitle) return videoTitle

  const objective = input.objective.trim()
  if (objective.length > 0) {
    return objective.length > 88 ? `${objective.slice(0, 88)}...` : objective
  }

  return `Playbook ${input.extractionId.slice(0, 8)}`
}

function resolveObjectivePreview(raw: string) {
  const text = raw.trim()
  if (!text) return 'Sin objetivo disponible.'
  return text.length > 220 ? `${text.slice(0, 220)}...` : text
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const query = (req.nextUrl.searchParams.get('q') ?? '').trim()
    const limit = parseLimit(req.nextUrl.searchParams.get('limit'))
    const rows = await listPublicExtractionsForSearch({
      query,
      limit,
    })

    return NextResponse.json({
      items: rows.map((row) => {
        const extraction = row.extraction
        const title = resolveDisplayTitle({
          sourceLabel: extraction.source_label,
          videoTitle: extraction.video_title,
          objective: extraction.objective,
          extractionId: extraction.id,
        })

        return {
          id: extraction.id,
          title,
          objectivePreview: resolveObjectivePreview(extraction.objective),
          createdAt: extraction.created_at,
          mode: normalizeExtractionMode(extraction.extraction_mode),
          thumbnailUrl:
            extraction.thumbnail_url ||
            (extraction.video_id ? buildYoutubeThumbnailUrl(extraction.video_id) : null),
          sourceLabel: extraction.source_label ?? null,
          ownerName: row.owner_name,
          ownerEmail: row.owner_email,
        }
      }),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron buscar playbooks públicos.'
    console.error('[ActionExtractor] public playbooks search GET error:', message)
    return NextResponse.json({ error: 'No se pudieron buscar playbooks públicos.' }, { status: 500 })
  }
}
