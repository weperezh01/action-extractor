import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionFolderByIdForUser,
  removeExtractionFolderMemberForOwner,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function DELETE(
  req: NextRequest,
  context: { params: { folderId: string; memberUserId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const folderId = parseId(context.params?.folderId)
    const memberUserId = parseId(context.params?.memberUserId)
    if (!folderId || !memberUserId) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }
    if (memberUserId === user.id) {
      return NextResponse.json({ error: 'No puedes eliminar al owner de su carpeta.' }, { status: 400 })
    }

    const folder = await findExtractionFolderByIdForUser({ id: folderId, userId: user.id })
    if (!folder) {
      return NextResponse.json({ error: 'No se encontró la carpeta.' }, { status: 404 })
    }

    const deleted = await removeExtractionFolderMemberForOwner({
      folderId,
      ownerUserId: user.id,
      memberUserId,
    })
    if (deleted === 0) {
      return NextResponse.json({ error: 'No se encontró el miembro compartido.' }, { status: 404 })
    }

    return NextResponse.json({
      folderId,
      deletedMemberUserId: memberUserId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo revocar el acceso de carpeta.'
    console.error('[ActionExtractor] folder members DELETE error:', message)
    return NextResponse.json({ error: 'No se pudo revocar el acceso de carpeta.' }, { status: 500 })
  }
}
