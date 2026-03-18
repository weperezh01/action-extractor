import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteWorkspace,
  findWorkspaceById,
  getWorkspaceMemberRole,
  updateWorkspace,
} from '@/lib/db/workspaces'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: { workspaceId: string } }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId inválido.' }, { status: 400 })

    const role = await getWorkspaceMemberRole(workspaceId, user.id)
    if (!role) return NextResponse.json({ error: 'Sin acceso a este workspace.' }, { status: 403 })

    const workspace = await findWorkspaceById(workspaceId)
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado.' }, { status: 404 })

    return NextResponse.json({ workspace, role })
  } catch (error: unknown) {
    console.error('[workspaces/[id]] GET error:', error)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId inválido.' }, { status: 400 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const b = body as { name?: unknown; description?: unknown; avatarColor?: unknown }
    const updated = await updateWorkspace({
      id: workspaceId,
      requestingUserId: user.id,
      ...(typeof b.name === 'string' ? { name: b.name } : {}),
      ...('description' in b ? { description: typeof b.description === 'string' ? b.description : null } : {}),
      ...(typeof b.avatarColor === 'string' ? { avatarColor: b.avatarColor } : {}),
    })

    if (!updated) return NextResponse.json({ error: 'Workspace no encontrado.' }, { status: 404 })
    return NextResponse.json({ workspace: updated })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al actualizar workspace.'
    console.error('[workspaces/[id]] PATCH error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaceId = (context.params?.workspaceId ?? '').trim()
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId inválido.' }, { status: 400 })

    await deleteWorkspace({ id: workspaceId, ownerUserId: user.id })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al eliminar workspace.'
    console.error('[workspaces/[id]] DELETE error:', msg)
    return NextResponse.json({ error: msg }, { status: 403 })
  }
}
