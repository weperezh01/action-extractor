import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getNotificationPreferences, upsertNotificationPreferences } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const prefs = await getNotificationPreferences(user.id)
  return NextResponse.json(prefs)
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const patch: Record<string, boolean> = {}

  if (typeof raw.notifyTaskStatusChange === 'boolean') {
    patch.notifyTaskStatusChange = raw.notifyTaskStatusChange
  }
  if (typeof raw.notifyNewComment === 'boolean') {
    patch.notifyNewComment = raw.notifyNewComment
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No hay campos válidos para actualizar.' }, { status: 400 })
  }

  const updated = await upsertNotificationPreferences(user.id, patch)
  return NextResponse.json(updated)
}
