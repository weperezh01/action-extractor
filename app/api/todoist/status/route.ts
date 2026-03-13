import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findTodoistConnectionByUserId } from '@/lib/db'
import { isTodoistOAuthConfigured } from '@/lib/todoist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const connection = await findTodoistConnectionByUserId(user.id)

    return NextResponse.json({
      configured: isTodoistOAuthConfigured(),
      connected: Boolean(connection),
      userEmail: connection?.user_email ?? null,
      userName: connection?.user_name ?? null,
      projectId: connection?.project_id ?? null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] todoist/status GET error:', message)
    return NextResponse.json({ error: 'No se pudo consultar el estado de Todoist.' }, { status: 500 })
  }
}
