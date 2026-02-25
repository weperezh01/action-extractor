import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionByIdForUser,
  updateExtractionShareVisibilityForUser,
  type ExtractionShareVisibility,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseVisibility(raw: unknown): ExtractionShareVisibility | null {
  if (raw === 'public' || raw === 'private' || raw === 'unlisted' || raw === 'circle') {
    return raw
  }
  return null
}

export async function GET(
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

    const extraction = await findExtractionByIdForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    return NextResponse.json({
      extractionId: extraction.id,
      shareVisibility: extraction.share_visibility,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar la visibilidad.'
    console.error('[ActionExtractor] extraction visibility GET error:', message)
    return NextResponse.json({ error: 'No se pudo cargar la visibilidad.' }, { status: 500 })
  }
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

    const shareVisibility = parseVisibility((body as { shareVisibility?: unknown })?.shareVisibility)
    if (!shareVisibility) {
      return NextResponse.json({ error: 'shareVisibility inválido.' }, { status: 400 })
    }

    const updated = await updateExtractionShareVisibilityForUser({
      id: extractionId,
      userId: user.id,
      shareVisibility,
    })
    if (!updated) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    return NextResponse.json({
      extractionId: updated.id,
      shareVisibility: updated.share_visibility,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la visibilidad.'
    console.error('[ActionExtractor] extraction visibility PATCH error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar la visibilidad.' }, { status: 500 })
  }
}
