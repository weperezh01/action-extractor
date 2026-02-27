import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  listCommunityExplorePostsForUser,
  recordCommunityPostViewsForUser,
  type DbCommunityPost,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    attachments: post.attachments.map((attachment) => ({
      id: attachment.id,
      attachmentType: attachment.attachment_type,
      storageProvider: attachment.storage_provider,
      url: attachment.url,
      thumbnailUrl: attachment.thumbnail_url,
      title: attachment.title,
      mimeType: attachment.mime_type,
      metadataJson: attachment.metadata_json,
      createdAt: attachment.created_at,
      updatedAt: attachment.updated_at,
    })),
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const limit = parseLimit(req.nextUrl.searchParams.get('limit'))
    const items = await listCommunityExplorePostsForUser({
      userId: user.id,
      limit,
    })

    if (items.length > 0) {
      void recordCommunityPostViewsForUser({
        userId: user.id,
        postIds: items.map((item) => item.id),
      })
    }

    return NextResponse.json({
      items: items.map(toClientPost),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el feed Explore.'
    console.error('[ActionExtractor] community feed explore GET error:', message)
    return NextResponse.json({ error: 'No se pudo cargar el feed Explore.' }, { status: 500 })
  }
}
