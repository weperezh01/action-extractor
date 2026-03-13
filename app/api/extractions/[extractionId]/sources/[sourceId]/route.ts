import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { deleteExtractionAdditionalSourceForUser } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function DELETE(
  req: NextRequest,
  context: { params: { extractionId: string; sourceId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const extractionId = normalizeId(context.params?.extractionId)
  const sourceId = normalizeId(context.params?.sourceId)

  if (!extractionId || !sourceId) {
    return NextResponse.json({ error: 'IDs inválidos.' }, { status: 400 })
  }

  const deleted = await deleteExtractionAdditionalSourceForUser({
    extractionId,
    sourceId,
    userId: user.id,
  })

  if (!deleted) {
    return NextResponse.json(
      { error: 'No se encontró la fuente adicional o ya fue analizada y bloqueada.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true })
}
