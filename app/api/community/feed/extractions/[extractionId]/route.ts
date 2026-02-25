import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionAccessForUser,
  listCommunityPostsByExtractionForUser,
  recordCommunityPostViewsForUser,
  type DbCommunityPost,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseLimit(raw: string | null) {
  const parsed = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 20
  return Math.min(parsed, 100)
}

function toClientPost(post: DbCommunityPost) {
  return {
    id: post.id,
    content: post.content,
    visibility: post.visibility,
    metadataJson: post.metadata_json,
    source: {
      extractionId: post.source_extraction_id,
      taskId: post.source_task_id,
      label: post.source_label,
    },
    metrics: {
      reactionsCount: post.reactions_count,
      commentsCount: post.comments_count,
      viewsCount: post.views_count,
      reactedByMe: post.reacted_by_me,
    },
    author: {
      userId: post.user_id,
      name: post.user_name,
      email: post.user_email,
      following: post.following_author,
    },
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  }
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

    const extractionId = parseId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    const access = await findExtractionAccessForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!access.extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    const hasPublicLinkVisibility =
      access.extraction.share_visibility === 'public' || access.extraction.share_visibility === 'unlisted'
    if (!access.role && !hasPublicLinkVisibility) {
      return NextResponse.json({ error: 'No tienes acceso a esta extracción.' }, { status: 403 })
    }

    const limit = parseLimit(req.nextUrl.searchParams.get('limit'))
    const items = await listCommunityPostsByExtractionForUser({
      userId: user.id,
      extractionId,
      limit,
    })

    if (items.length > 0) {
      void recordCommunityPostViewsForUser({
        userId: user.id,
        postIds: items.map((item) => item.id),
      })
    }

    return NextResponse.json({
      extractionId,
      items: items.map(toClientPost),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el feed por extracción.'
    console.error('[ActionExtractor] community feed by extraction GET error:', message)
    return NextResponse.json({ error: 'No se pudo cargar el feed por extracción.' }, { status: 500 })
  }
}

