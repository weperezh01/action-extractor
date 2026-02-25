import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteCommunityPostCommentByIdForUser,
  getCommunityPostAccessForUser,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function DELETE(
  req: NextRequest,
  context: { params: { postId: string; commentId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const postId = parseId(context.params?.postId)
    const commentId = parseId(context.params?.commentId)
    if (!postId || !commentId) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
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

    const deleted = await deleteCommunityPostCommentByIdForUser({
      postId,
      commentId,
      actorUserId: user.id,
    })
    if (!deleted) {
      return NextResponse.json({ error: 'No se encontró el comentario solicitado.' }, { status: 404 })
    }

    return NextResponse.json({
      postId,
      deletedCommentId: deleted.id,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el comentario.'
    console.error('[ActionExtractor] community post comment DELETE error:', message)
    return NextResponse.json({ error: 'No se pudo eliminar el comentario.' }, { status: 500 })
  }
}

