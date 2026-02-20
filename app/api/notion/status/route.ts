import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findNotionConnectionByUserId } from '@/lib/db'
import { isNotionOAuthConfigured } from '@/lib/notion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const connection = await findNotionConnectionByUserId(user.id)

  return NextResponse.json({
    configured: isNotionOAuthConfigured(),
    connected: Boolean(connection),
    workspaceName: connection?.workspace_name ?? null,
    workspaceIcon: connection?.workspace_icon ?? null,
    workspaceId: connection?.workspace_id ?? null,
  })
}
