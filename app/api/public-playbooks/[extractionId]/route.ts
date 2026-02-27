import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findPublicExtractionById } from '@/lib/db'
import { normalizeExtractionMode } from '@/lib/extraction-modes'
import { normalizePlaybookPhases } from '@/lib/playbook-tree'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

interface ExtractionMetadataShape {
  readingTime: string
  difficulty: string
  originalTime: string
  savedTime: string
}

export async function GET(
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

    const row = await findPublicExtractionById(extractionId)
    if (!row) {
      return NextResponse.json({ error: 'No se encontró un playbook público con ese ID.' }, { status: 404 })
    }

    const extraction = row.extraction
    const phases = normalizePlaybookPhases(safeParse(extraction.phases_json, []))
    const metadata = safeParse<ExtractionMetadataShape>(extraction.metadata_json, {
      readingTime: '3 min',
      difficulty: 'Media',
      originalTime: '0m',
      savedTime: '0m',
    })

    return NextResponse.json({
      item: {
        id: extraction.id,
        shareVisibility: extraction.share_visibility ?? 'public',
        accessRole: 'viewer',
        ownerName: row.owner_name,
        ownerEmail: row.owner_email,
        createdAt: extraction.created_at,
        url: extraction.url,
        videoId: extraction.video_id,
        videoTitle: extraction.video_title,
        thumbnailUrl:
          extraction.thumbnail_url ||
          (extraction.video_id ? buildYoutubeThumbnailUrl(extraction.video_id) : null),
        mode: normalizeExtractionMode(extraction.extraction_mode),
        objective: extraction.objective,
        phases,
        proTip: extraction.pro_tip,
        metadata,
        sourceType: extraction.source_type ?? 'youtube',
        sourceLabel: extraction.source_label ?? null,
        folderId: null,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo abrir el playbook público.'
    console.error('[ActionExtractor] public playbook detail GET error:', message)
    return NextResponse.json({ error: 'No se pudo abrir el playbook público.' }, { status: 500 })
  }
}
