import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getWorkspaceMemberRole, removeWorkspaceMember, upsertWorkspaceMember } from '@/lib/db/workspaces'
import type { WorkspaceRole } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { workspaceId: string; userId: string } }

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()
    const targetUserId = (context.params?.userId ?? '').trim()

    const reqRole = await getWorkspaceMemberRole(workspaceId, user.id)
    if (!reqRole || (reqRole !== 'owner' && reqRole !== 'admin')) {
      return NextResponse.json({ error: 'Sin permisos para cambiar roles.' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const b = body as { role?: unknown }
    const allowedRoles: WorkspaceRole[] = ['admin', 'member', 'viewer']
    if (!allowedRoles.includes(b.role as WorkspaceRole)) {
      return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
    }

    const member = await upsertWorkspaceMember({
      workspaceId,
      userId: targetUserId,
      role: b.role as WorkspaceRole,
      requestingUserId: user.id,
    })

    return NextResponse.json({ member })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al cambiar rol.'
    console.error('[ws/members/[userId]] PATCH error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()
    const targetUserId = (context.params?.userId ?? '').trim()

    await removeWorkspaceMember({
      workspaceId,
      userId: targetUserId,
      requestingUserId: user.id,
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al remover miembro.'
    console.error('[ws/members/[userId]] DELETE error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
