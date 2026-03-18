import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { getAdminUserProfitability } from '@/lib/db/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parsePeriodDays(raw: string | null) {
  if (!raw) return 30
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return 30
  return Math.min(90, Math.max(1, parsed))
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const userId = params.userId?.trim()
  if (!userId) {
    return NextResponse.json({ error: 'userId requerido.' }, { status: 400 })
  }

  const days = parsePeriodDays(req.nextUrl.searchParams.get('days'))
  const payload = await getAdminUserProfitability(userId, days)
  if (!payload) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  }

  return NextResponse.json(payload)
}
