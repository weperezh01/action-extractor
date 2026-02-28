import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { assignTagToExtraction, removeTagFromExtraction } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { extractionId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const tagId = typeof (body as { tagId?: unknown }).tagId === 'string' ? (body as { tagId: string }).tagId : ''
  if (!tagId) return NextResponse.json({ error: 'tagId requerido.' }, { status: 400 })

  await assignTagToExtraction(params.extractionId, tagId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { extractionId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const tagId = typeof (body as { tagId?: unknown }).tagId === 'string' ? (body as { tagId: string }).tagId : ''
  if (!tagId) return NextResponse.json({ error: 'tagId requerido.' }, { status: 400 })

  await removeTagFromExtraction(params.extractionId, tagId)
  return NextResponse.json({ ok: true })
}
