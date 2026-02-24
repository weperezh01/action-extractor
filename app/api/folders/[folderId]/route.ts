import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { deleteExtractionFolderTreeForUser } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  context: { params: { folderId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const folderId = (context.params?.folderId ?? '').trim()
    if (!folderId) {
      return NextResponse.json({ error: 'folderId inválido.' }, { status: 400 })
    }

    const deletedIds = await deleteExtractionFolderTreeForUser({
      id: folderId,
      userId: user.id,
    })

    if (deletedIds.length === 0) {
      return NextResponse.json({ error: 'Carpeta no encontrada.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, deletedIds })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la carpeta.'
    console.error('[ActionExtractor] folders DELETE error:', message)
    return NextResponse.json({ error: 'No se pudo eliminar la carpeta.' }, { status: 500 })
  }
}
