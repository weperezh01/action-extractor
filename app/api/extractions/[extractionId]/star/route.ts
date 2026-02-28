import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { setExtractionStarredForUser } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function PATCH(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseExtractionId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const starred = (body as { starred?: unknown })?.starred
    if (typeof starred !== 'boolean') {
      return NextResponse.json({ error: 'starred debe ser true o false.' }, { status: 400 })
    }

    const updated = await setExtractionStarredForUser({
      id: extractionId,
      userId: user.id,
      starred,
    })

    if (!updated) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    return NextResponse.json({
      extractionId: updated.id,
      isStarred: updated.is_starred,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el favorito.'
    console.error('[ActionExtractor] extraction star PATCH error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar el favorito.' }, { status: 500 })
  }
}
