import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findCommunityPostByIdForUser,
  getCommunityPostAccessForUser,
  toggleCommunityPostReactionForUser,
  type CommunityPostReactionType,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseReactionType(raw: unknown): CommunityPostReactionType | null {
  if (raw === undefined || raw === null) return 'like'
  if (raw === 'like') return 'like'
  return null
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

    const post = await findCommunityPostByIdForUser({ postId, userId: user.id })
    if (!post) {
      return NextResponse.json({ error: 'No se pudo cargar el estado de reacciones.' }, { status: 404 })
    }

    return NextResponse.json({
      postId: post.id,
      reactionType: 'like',
      reactionsCount: post.reactions_count,
      reactedByMe: post.reacted_by_me,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar reacciones.'
    console.error('[ActionExtractor] community post reactions GET error:', message)
    return NextResponse.json({ error: 'No se pudo cargar reacciones.' }, { status: 500 })
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

    const postId = parseId(context.params?.postId)
    if (!postId) {
      return NextResponse.json({ error: 'postId inválido.' }, { status: 400 })
    }

    let body: unknown = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const reactionType = parseReactionType((body as { reactionType?: unknown }).reactionType)
    if (!reactionType) {
      return NextResponse.json({ error: 'reactionType inválido.' }, { status: 400 })
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

    const summary = await toggleCommunityPostReactionForUser({
      postId,
      userId: user.id,
      reactionType,
    })

    return NextResponse.json({
      postId: summary.post_id,
      reactionType: summary.reaction_type,
      reactionsCount: summary.reactions_count,
      reactedByMe: summary.reacted_by_me,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la reacción.'
    console.error('[ActionExtractor] community post reactions POST error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar la reacción.' }, { status: 500 })
  }
}

