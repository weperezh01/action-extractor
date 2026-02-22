import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { findAdminUserById, getAdminUserAiCostDetail, getAdminUserMonthlyStats } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Acceso restringido a administradores.' }, { status: 403 })
    }

    const { userId } = params
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'userId requerido.' }, { status: 400 })
    }

    const [targetUser, monthly, costDetail] = await Promise.all([
      findAdminUserById(userId),
      getAdminUserMonthlyStats(userId),
      getAdminUserAiCostDetail(userId),
    ])

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ user: targetUser, monthly, costDetail })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los datos del usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
