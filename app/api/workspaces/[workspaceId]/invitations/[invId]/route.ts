import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { cancelWorkspaceInvitation, getWorkspaceMemberRole } from '@/lib/db/workspaces'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { workspaceId: string; invId: string } }

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()
    const invId = (context.params?.invId ?? '').trim()

    const role = await getWorkspaceMemberRole(workspaceId, user.id)
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 })
    }

    await cancelWorkspaceInvitation({ invitationId: invId, requestingUserId: user.id })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al cancelar invitación.'
    console.error('[ws/invitations/[invId]] DELETE error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
