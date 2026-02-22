import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { clearChatMessagesForUser, listChatMessagesForUser } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeReferences(payload: unknown) {
  if (!Array.isArray(payload)) return []
  return payload
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const id = typeof (entry as { id?: unknown }).id === 'string' ? (entry as { id: string }).id.trim() : ''
      if (!id) return null

      const orderNumberRaw = (entry as { orderNumber?: unknown }).orderNumber
      const orderNumber =
        typeof orderNumberRaw === 'number' && Number.isFinite(orderNumberRaw)
          ? Math.trunc(orderNumberRaw)
          : null

      return {
        id,
        orderNumber,
        videoTitle:
          typeof (entry as { videoTitle?: unknown }).videoTitle === 'string'
            ? (entry as { videoTitle: string }).videoTitle
            : null,
        mode:
          typeof (entry as { mode?: unknown }).mode === 'string'
            ? (entry as { mode: string }).mode
            : 'N/A',
        createdAt:
          typeof (entry as { createdAt?: unknown }).createdAt === 'string'
            ? (entry as { createdAt: string }).createdAt
            : '',
      }
    })
    .filter(
      (
        entry
      ): entry is {
        id: string
        orderNumber: number | null
        videoTitle: string | null
        mode: string
        createdAt: string
      } => Boolean(entry)
    )
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const messages = await listChatMessagesForUser({
    userId: user.id,
    limit: 80,
  })

  const mapped = messages.map((message) => {
    const metadata = safeParse<{ references?: unknown }>(message.metadata_json, {})
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
      references: normalizeReferences(metadata.references),
    }
  })

  return NextResponse.json({ messages: mapped })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const deletedCount = await clearChatMessagesForUser(user.id)
  return NextResponse.json({ ok: true, deletedCount })
}
