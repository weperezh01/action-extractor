import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findExtractionByIdForUser, removeExtractionMemberForOwner } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function DELETE(
  req: NextRequest,
  context: { params: { extractionId: string; memberUserId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseId(context.params?.extractionId)
    const memberUserId = parseId(context.params?.memberUserId)
    if (!extractionId || !memberUserId) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }

    const extraction = await findExtractionByIdForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    if (memberUserId === user.id) {
      return NextResponse.json({ error: 'No puedes eliminar al owner del playbook.' }, { status: 400 })
    }

    const deleted = await removeExtractionMemberForOwner({
      extractionId,
      ownerUserId: user.id,
      memberUserId,
    })
    if (deleted === 0) {
      return NextResponse.json({ error: 'No se encontró el miembro solicitado.' }, { status: 404 })
    }

    return NextResponse.json({
      extractionId,
      deletedMemberUserId: memberUserId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el miembro.'
    console.error('[ActionExtractor] extraction members DELETE error:', message)
    return NextResponse.json({ error: 'No se pudo eliminar el miembro.' }, { status: 500 })
  }
}
