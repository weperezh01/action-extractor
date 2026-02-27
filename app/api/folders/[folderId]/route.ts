import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { deleteExtractionFolderTreeForUser } from '@/lib/db'
import { isProtectedExtractionFolderIdForUser } from '@/lib/extraction-folders'

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
    if (isProtectedExtractionFolderIdForUser({ userId: user.id, id: folderId })) {
      return NextResponse.json(
        { error: 'Esta carpeta es del sistema y no se puede eliminar.' },
        { status: 403 }
      )
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
