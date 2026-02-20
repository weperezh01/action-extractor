import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { createOrGetShareToken, findExtractionByIdForUser } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const extractionId =
      typeof (body as { extractionId?: unknown })?.extractionId === 'string'
        ? (body as { extractionId: string }).extractionId.trim()
        : ''

    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId es requerido.' }, { status: 400 })
    }

    const extraction = await findExtractionByIdForUser({ id: extractionId, userId: user.id })
    if (!extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    const shareToken = await createOrGetShareToken({
      extractionId: extraction.id,
      userId: user.id,
    })

    return NextResponse.json({
      token: shareToken.token,
      sharePath: `/share/${shareToken.token}`,
      extractionId: extraction.id,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] share token error:', message)
    return NextResponse.json({ error: 'No se pudo generar el enlace compartible.' }, { status: 500 })
  }
}
