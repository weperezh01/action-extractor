import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { getChatTokenSnapshot } from '@/lib/db/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users/[userId]/chat-tokens — today's chat token usage for a user
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Sin permisos de administrador.' }, { status: 403 })
    }

    const snapshot = await getChatTokenSnapshot(params.userId)
    return NextResponse.json(snapshot)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
