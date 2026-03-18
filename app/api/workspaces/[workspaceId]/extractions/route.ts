import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { listWorkspaceExtractions } from '@/lib/db'
import { getWorkspaceMemberRole } from '@/lib/db/workspaces'

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

    const url = new URL(req.url)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '30'), 100)

    const extractions = await listWorkspaceExtractions({
      workspaceId,
      userId: user.id,
      limit,
      cursor,
    })

    return NextResponse.json({ extractions })
  } catch (error: unknown) {
    console.error('[ws/extractions] GET error:', error)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
