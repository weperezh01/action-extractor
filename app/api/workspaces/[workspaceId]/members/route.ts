import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createWorkspaceInvitation,
  findWorkspaceById,
  getWorkspaceMemberRole,
  listWorkspaceMembers,
} from '@/lib/db'
import { sendWorkspaceInvitationEmail } from '@/lib/email-notifications'
import type { WorkspaceRole } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { workspaceId: string } }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()
    const role = await getWorkspaceMemberRole(workspaceId, user.id)
    if (!role) return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 })

    const members = await listWorkspaceMembers(workspaceId)
    return NextResponse.json({ members })
  } catch (error: unknown) {
    console.error('[ws/members] GET error:', error)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()

    // Check requester is admin+
    const reqRole = await getWorkspaceMemberRole(workspaceId, user.id)
    if (!reqRole || (reqRole !== 'owner' && reqRole !== 'admin')) {
      return NextResponse.json({ error: 'Sin permisos para invitar miembros.' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const b = body as { email?: unknown; role?: unknown }
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    }

    const allowedRoles: WorkspaceRole[] = ['admin', 'member', 'viewer']
    const role: WorkspaceRole = allowedRoles.includes(b.role as WorkspaceRole)
      ? (b.role as WorkspaceRole)
      : 'member'

    const invitation = await createWorkspaceInvitation({
      workspaceId,
      invitedByUserId: user.id,
      email,
      role,
    })

    const workspace = await findWorkspaceById(workspaceId)

    // Send invitation email (non-blocking)
    void sendWorkspaceInvitationEmail({
      toEmail: email,
      invitedByName: user.name,
      workspaceName: workspace?.name ?? 'Workspace',
      role,
      inviteToken: invitation.token,
    })

    return NextResponse.json({ invitation }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al invitar miembro.'
    console.error('[ws/members] POST error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
