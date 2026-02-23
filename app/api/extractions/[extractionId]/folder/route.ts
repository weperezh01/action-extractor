import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { updateExtractionFolderForUser } from '@/lib/db'

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

    const updated = await updateExtractionFolderForUser({
      id: extractionId,
      userId: user.id,
      folderId,
    })

    if (!updated) {
      return NextResponse.json({ error: 'No se encontró la extracción.' }, { status: 404 })
    }

    return NextResponse.json({ folderId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno.'
    console.error('[ActionExtractor] folder PATCH error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar la carpeta.' }, { status: 500 })
  }
}
