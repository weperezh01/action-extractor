import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { type DbCommunityPost } from '@/lib/db'
import { listCommunityUserPosts } from '@/lib/db/community'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toClientPost(post: DbCommunityPost) {
  return {
    id: post.id,
    content: post.content,
    visibility: post.visibility,
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
    attachments: post.attachments.map((a) => ({
      id: a.id,
      attachmentType: a.attachment_type,
      storageProvider: a.storage_provider,
      url: a.url,
      thumbnailUrl: a.thumbnail_url,
      title: a.title,
      mimeType: a.mime_type,
      metadataJson: a.metadata_json,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    })),
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const { userId } = params
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'ID de usuario inválido.' }, { status: 400 })
    }

    const { searchParams } = req.nextUrl
    const limit = clamp(Number(searchParams.get('limit') ?? '20'), 1, 50)
    const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

    const posts = await listCommunityUserPosts({
      currentUserId: user.id,
      targetUserId: userId.trim(),
      limit: limit + 1, // fetch one extra to determine hasMore
      offset,
    })

    const hasMore = posts.length > limit
    const slice = hasMore ? posts.slice(0, limit) : posts

    return NextResponse.json({ posts: slice.map(toClientPost), hasMore })
  } catch (error: unknown) {
    console.error('[GET /api/community/users/[userId]/posts]', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
