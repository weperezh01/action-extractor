import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { setPromptOverride, deletePromptOverride } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_KEYS = new Set([
  'extraction:action_plan:system',
  'extraction:action_plan:user',
  'extraction:executive_summary:system',
  'extraction:executive_summary:user',
  'extraction:business_ideas:system',
  'extraction:business_ideas:user',
  'extraction:key_quotes:system',
  'extraction:key_quotes:user',
  'extraction:concept_map:system',
  'extraction:concept_map:user',
  'chat:system',
])

export async function PUT(
  req: NextRequest,
  { params }: { params: { promptKey: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { promptKey } = params
  if (!VALID_KEYS.has(promptKey)) {
    return NextResponse.json({ error: 'Clave de prompt inválida.' }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as { content?: unknown } | null
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return NextResponse.json({ error: 'El contenido del prompt no puede estar vacío.' }, { status: 400 })
  }

  await setPromptOverride(promptKey, content, user.email)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { promptKey: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { promptKey } = params
  if (!VALID_KEYS.has(promptKey)) {
    return NextResponse.json({ error: 'Clave de prompt inválida.' }, { status: 400 })
  }

  await deletePromptOverride(promptKey)
  return NextResponse.json({ ok: true })
}
