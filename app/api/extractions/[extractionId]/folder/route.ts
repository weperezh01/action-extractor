import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  ensureDefaultExtractionFoldersForUser,
  findExtractionFolderByIdForUser,
  updateExtractionFolderForUser,
} from '@/lib/db'
import { buildSystemExtractionFolderIdForUser } from '@/lib/extraction-folders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }
    await ensureDefaultExtractionFoldersForUser(user.id)

    const extractionId = (context.params?.extractionId ?? '').trim()
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const b = body as { folderId?: unknown }
    const folderId =
      b.folderId === null
        ? null
        : typeof b.folderId === 'string' && b.folderId.trim()
          ? b.folderId.trim()
          : undefined

    if (folderId === undefined) {
      return NextResponse.json({ error: 'folderId inválido.' }, { status: 400 })
    }

    const targetFolderId = folderId ?? buildSystemExtractionFolderIdForUser({
      userId: user.id,
      key: 'general',
    })

    if (targetFolderId) {
      const folder = await findExtractionFolderByIdForUser({ id: targetFolderId, userId: user.id })
      if (!folder) {
        return NextResponse.json({ error: 'La carpeta seleccionada no existe.' }, { status: 400 })
      }
    }

    const updated = await updateExtractionFolderForUser({
      id: extractionId,
      userId: user.id,
      folderId: targetFolderId,
    })

    if (!updated) {
      return NextResponse.json({ error: 'No se encontró la extracción.' }, { status: 404 })
    }

    return NextResponse.json({ folderId: targetFolderId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno.'
    console.error('[ActionExtractor] folder PATCH error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar la carpeta.' }, { status: 500 })
  }
}
