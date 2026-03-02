import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getWorkspaceMemberRole, listWorkspaceInvitations } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { workspaceId: string } }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()
    const role = await getWorkspaceMemberRole(workspaceId, user.id)
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: 'Sin permisos para ver invitaciones.' }, { status: 403 })
    }

    const invitations = await listWorkspaceInvitations(workspaceId)
    return NextResponse.json({ invitations })
  } catch (error: unknown) {
    console.error('[ws/invitations] GET error:', error)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
