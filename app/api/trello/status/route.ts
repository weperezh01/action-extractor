import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findTrelloConnectionByUserId } from '@/lib/db/integrations'
import { isTrelloConfigured } from '@/lib/trello'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const connection = await findTrelloConnectionByUserId(user.id)

    return NextResponse.json({
      configured: isTrelloConfigured(),
      connected: Boolean(connection),
      username: connection?.username ?? null,
      fullName: connection?.full_name ?? null,
      memberId: connection?.member_id ?? null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] trello/status GET error:', message)
    return NextResponse.json({ error: 'No se pudo consultar el estado de Trello.' }, { status: 500 })
  }
}
