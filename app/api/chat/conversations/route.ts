import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createChatConversationForUser,
  findChatConversationByContextForUser,
  listChatConversationsForUser,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mapConversation(c: {
  id: string
  title: string
  context_type: string
  context_id: string | null
  created_at: string
  updated_at: string
}) {
  return {
    id: c.id,
    title: c.title,
    contextType: c.context_type,
    contextId: c.context_id,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const conversations = await listChatConversationsForUser(user.id)
  return NextResponse.json({ conversations: conversations.map(mapConversation) })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
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
      : 'Nueva conversación'
  const contextType =
    typeof (body as { contextType?: unknown }).contextType === 'string'
      ? (body as { contextType: string }).contextType.trim()
      : ''
  const contextId =
    typeof (body as { contextId?: unknown }).contextId === 'string'
      ? (body as { contextId: string }).contextId.trim()
      : ''

  if (contextType && contextId) {
    const existing = await findChatConversationByContextForUser({
      userId: user.id,
      contextType,
      contextId,
    })
    if (existing) {
      return NextResponse.json({
        conversation: mapConversation(existing),
        created: false,
      })
    }
  }

  const conv = await createChatConversationForUser({
    userId: user.id,
    title,
    contextType: contextType || undefined,
    contextId: contextId || undefined,
  })
  if (!conv) {
    return NextResponse.json({ error: 'No se pudo crear la conversación.' }, { status: 500 })
  }

  return NextResponse.json({ conversation: mapConversation(conv), created: true }, { status: 201 })
}
