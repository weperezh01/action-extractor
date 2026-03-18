import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { adminGetUserCreditDetail, findUserById } from '@/lib/db'
import { addUserCredits } from '@/lib/db/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users/[userId]/credits — daily usage + credit balance + transactions
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Sin permisos de administrador.' }, { status: 403 })
    }

    const { userId } = params
    const targetUser = await findUserById(userId)
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const detail = await adminGetUserCreditDetail(userId)

    return NextResponse.json({ user: { id: targetUser.id, name: targetUser.name, email: targetUser.email }, ...detail })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno.'
    console.error('[Admin] user credits GET error:', message)
    return NextResponse.json({ error: 'Error al cargar créditos del usuario.' }, { status: 500 })
  }
}

// POST /api/admin/users/[userId]/credits — add credits to this specific user
export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Sin permisos de administrador.' }, { status: 403 })
    }

    const { userId } = params
    const body = (await req.json().catch(() => null)) as { amount?: number; reason?: string } | null
    const amount = typeof body?.amount === 'number' ? Math.floor(body.amount) : NaN
    const reason = body?.reason?.trim() || 'manual_admin'

    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000) {
      return NextResponse.json({ error: 'amount debe ser un número entre 1 y 10000.' }, { status: 400 })
    }

    const targetUser = await findUserById(userId)
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    await addUserCredits(userId, amount, reason)
    const detail = await adminGetUserCreditDetail(userId)

    return NextResponse.json({ ok: true, ...detail })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno.'
    console.error('[Admin] user credits POST error:', message)
    return NextResponse.json({ error: 'Error al agregar créditos.' }, { status: 500 })
  }
}
