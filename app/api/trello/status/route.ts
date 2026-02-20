import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findTrelloConnectionByUserId } from '@/lib/db'
import { isTrelloConfigured } from '@/lib/trello'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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
}
