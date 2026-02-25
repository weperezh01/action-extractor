import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createCommunityPostCommentForUser,
  getCommunityPostAccessForUser,
  listCommunityPostCommentsForUser,
  type DbCommunityPostComment,
} from '@/lib/db'
import {
  buildCommunityActionRateLimitMessage,
  consumeUserCommunityActionRateLimit,
} from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseLimit(raw: string | null) {
  const parsed = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 100
  return Math.min(parsed, 300)
}

function toClientComment(comment: DbCommunityPostComment) {
  return {
    id: comment.id,
    postId: comment.post_id,
    userId: comment.user_id,
    userName: comment.user_name,
    userEmail: comment.user_email,
    content: comment.content,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
  }
}

export async function GET(
  req: NextRequest,
  context: { params: { postId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const postId = parseId(context.params?.postId)
    if (!postId) {
      return NextResponse.json({ error: 'postId inválido.' }, { status: 400 })
    }

    const access = await getCommunityPostAccessForUser({
      postId,
      userId: user.id,
    })
    if (!access.post) {
      return NextResponse.json({ error: 'No se encontró el post solicitado.' }, { status: 404 })
    }
    if (!access.can_view) {
      return NextResponse.json({ error: 'No tienes acceso a este post.' }, { status: 403 })
    }

    const limit = parseLimit(req.nextUrl.searchParams.get('limit'))
    const comments = await listCommunityPostCommentsForUser({
      postId,
      limit,
    })

    return NextResponse.json({
      postId,
      comments: comments.map(toClientComment),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los comentarios.'
    console.error('[ActionExtractor] community post comments GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar los comentarios.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { postId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const rateLimit = await consumeUserCommunityActionRateLimit(user.id, 'comment')
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: buildCommunityActionRateLimitMessage('comment', rateLimit.limit),
          rateLimit: {
            limit: rateLimit.limit,
            used: rateLimit.used,
            remaining: rateLimit.remaining,
            resetAt: rateLimit.resetAt,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': rateLimit.resetAt,
          },
        }
      )
    }

    const postId = parseId(context.params?.postId)
    if (!postId) {
      return NextResponse.json({ error: 'postId inválido.' }, { status: 400 })
    }

    const access = await getCommunityPostAccessForUser({
      postId,
      userId: user.id,
    })
    if (!access.post) {
      return NextResponse.json({ error: 'No se encontró el post solicitado.' }, { status: 404 })
    }
    if (!access.can_view) {
      return NextResponse.json({ error: 'No tienes acceso a este post.' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const content =
      typeof (body as { content?: unknown }).content === 'string'
        ? (body as { content: string }).content.trim()
        : ''
    if (!content) {
      return NextResponse.json({ error: 'content es requerido.' }, { status: 400 })
    }
    if (content.length > 1500) {
      return NextResponse.json({ error: 'content no puede superar 1500 caracteres.' }, { status: 400 })
    }

    const created = await createCommunityPostCommentForUser({
      postId,
      userId: user.id,
      content,
    })
    if (!created) {
      return NextResponse.json({ error: 'No se pudo crear el comentario.' }, { status: 500 })
    }

    return NextResponse.json(
      {
        postId,
        comment: toClientComment(created),
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el comentario.'
    console.error('[ActionExtractor] community post comments POST error:', message)
    return NextResponse.json({ error: 'No se pudo crear el comentario.' }, { status: 500 })
  }
}
