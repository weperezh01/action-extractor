import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  updateExtractionClonePermissionForUser,
  type ExtractionClonePermission,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseClonePermission(raw: unknown): ExtractionClonePermission | null {
  if (raw === 'template_only' || raw === 'full') return raw
  if (raw === 'disabled') return 'disabled'
  return null
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

    const clonePermission = parseClonePermission(
      (body as { clonePermission?: unknown } | null)?.clonePermission
    )
    if (!clonePermission) {
      return NextResponse.json({ error: 'clonePermission inválido.' }, { status: 400 })
    }

    const updated = await updateExtractionClonePermissionForUser({
      id: extractionId,
      userId: user.id,
      clonePermission,
    })

    if (!updated) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    return NextResponse.json({
      extractionId: updated.id,
      clonePermission: updated.clone_permission,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el permiso de copia.'
    console.error('[ActionExtractor] extraction clone-permission PATCH error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar el permiso de copia.' }, { status: 500 })
  }
}
