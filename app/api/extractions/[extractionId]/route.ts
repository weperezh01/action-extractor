import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { moveExtractionToWorkspace } from '@/lib/db/workspaces'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { extractionId: string } }

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const extractionId = (context.params?.extractionId ?? '').trim()
    if (!extractionId) return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const b = body as { workspaceId?: unknown }
    if (!('workspaceId' in b)) {
      return NextResponse.json({ error: 'Operación no reconocida.' }, { status: 400 })
    }

    const workspaceId = b.workspaceId === null ? null : typeof b.workspaceId === 'string' ? b.workspaceId.trim() : undefined
    if (workspaceId === undefined) {
      return NextResponse.json({ error: 'workspaceId debe ser string o null.' }, { status: 400 })
    }

    await moveExtractionToWorkspace({ extractionId, userId: user.id, workspaceId })
    return NextResponse.json({ ok: true, workspaceId })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al mover extracción.'
    console.error('[extractions/[id]] PATCH error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
