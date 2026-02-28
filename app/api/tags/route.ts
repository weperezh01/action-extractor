import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { createOrGetTag, deleteUserTag, listUserTags } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tags = await listUserTags(user.id)
  return NextResponse.json({ tags })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = typeof (body as { name?: unknown }).name === 'string' ? (body as { name: string }).name.trim() : ''
  const color = typeof (body as { color?: unknown }).color === 'string' ? (body as { color: string }).color : 'indigo'

  if (!name || name.length > 32) {
    return NextResponse.json({ error: 'El nombre del tag es requerido (máx 32 chars).' }, { status: 400 })
  }

  const tag = await createOrGetTag(user.id, name, color)
  return NextResponse.json({ tag }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const tagId = typeof (body as { tagId?: unknown }).tagId === 'string' ? (body as { tagId: string }).tagId : ''
  if (!tagId) return NextResponse.json({ error: 'tagId requerido.' }, { status: 400 })

  await deleteUserTag(user.id, tagId)
  return NextResponse.json({ ok: true })
}
