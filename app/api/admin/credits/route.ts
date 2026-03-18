import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import {
  adminGetCreditStats,
  adminListUsersWithCredits,
  adminListRecentCreditTransactions,
  findUserById,
} from '@/lib/db'
import { addUserCredits } from '@/lib/db/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/credits — global credit stats + users list + recent transactions
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Sin permisos de administrador.' }, { status: 403 })
    }

    const [stats, users, transactions] = await Promise.all([
      adminGetCreditStats(),
      adminListUsersWithCredits(100),
      adminListRecentCreditTransactions(50),
    ])

    return NextResponse.json({ stats, users, transactions })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno.'
    console.error('[Admin] credits GET error:', message)
    return NextResponse.json({ error: 'Error al cargar datos de créditos.' }, { status: 500 })
  }
}

// POST /api/admin/credits — add credits to a user manually
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Sin permisos de administrador.' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as {
      userId?: string
      amount?: number
      reason?: string
    } | null

    const targetUserId = body?.userId?.trim()
    const amount = typeof body?.amount === 'number' ? Math.floor(body.amount) : NaN
    const reason = body?.reason?.trim() || 'manual_admin'

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000) {
      return NextResponse.json({ error: 'amount debe ser un número entre 1 y 10000.' }, { status: 400 })
    }

    const targetUser = await findUserById(targetUserId)
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    await addUserCredits(targetUserId, amount, reason)

    return NextResponse.json({ ok: true, userId: targetUserId, amount, reason })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno.'
    console.error('[Admin] credits POST error:', message)
    return NextResponse.json({ error: 'Error al agregar créditos.' }, { status: 500 })
  }
}
