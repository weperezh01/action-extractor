import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { acceptWorkspaceInvitation, declineWorkspaceInvitation, findWorkspaceInvitationByToken } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { token: string } }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const token = (context.params?.token ?? '').trim()
    const invitation = await findWorkspaceInvitationByToken(token)
    if (!invitation) {
      return NextResponse.json({ error: 'Invitación no encontrada.' }, { status: 404 })
    }
    // Return safe public info (no sensitive fields)
    return NextResponse.json({
      invitation: {
        id: invitation.id,
        workspaceName: invitation.workspace_name,
        invitedByName: invitation.invited_by_name,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expires_at,
      },
    })
  } catch (error: unknown) {
    console.error('[ws/invite/[token]] GET error:', error)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const token = (context.params?.token ?? '').trim()

    let body: unknown
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const action = (body as { action?: unknown })?.action
    if (action === 'decline') {
      await declineWorkspaceInvitation(token)
      return NextResponse.json({ ok: true, action: 'declined' })
    }

    const member = await acceptWorkspaceInvitation({ token, userId: user.id })
    return NextResponse.json({ ok: true, action: 'accepted', member })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al procesar invitación.'
    console.error('[ws/invite/[token]] POST error:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
