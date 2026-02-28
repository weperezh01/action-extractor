import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { deleteChatConversationForUser, renameChatConversationForUser } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const { conversationId } = params
  if (!conversationId?.trim()) {
    return NextResponse.json({ error: 'ID de conversación requerido.' }, { status: 400 })
  }

  const deleted = await deleteChatConversationForUser({ userId: user.id, conversationId })
  if (!deleted) {
    return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const { conversationId } = params
  if (!conversationId?.trim()) {
    return NextResponse.json({ error: 'ID de conversación requerido.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const title =
    typeof (body as { title?: unknown }).title === 'string'
      ? (body as { title: string }).title.trim()
      : ''

  if (!title) {
    return NextResponse.json({ error: 'El título es requerido.' }, { status: 400 })
  }

  const conv = await renameChatConversationForUser({ userId: user.id, conversationId, title })
  if (!conv) {
    return NextResponse.json({ error: 'Conversación no encontrada.' }, { status: 404 })
  }

  return NextResponse.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      contextType: conv.context_type,
      contextId: conv.context_id,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    },
  })
}
