import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { transferWorkspaceOwnership } from '@/lib/db/workspaces'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { workspaceId: string } }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const b = body as { newOwnerId?: unknown }
    const newOwnerId = typeof b.newOwnerId === 'string' ? b.newOwnerId.trim() : ''
    if (!newOwnerId) return NextResponse.json({ error: 'newOwnerId requerido.' }, { status: 400 })

    await transferWorkspaceOwnership({
      workspaceId,
      currentOwnerId: user.id,
      newOwnerId,
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al transferir ownership.'
    console.error('[ws/transfer] POST error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
