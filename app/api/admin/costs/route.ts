import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { getAdminAiCostStats } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parsePeriodDays(raw: string | null) {
  if (!raw) return 30
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return 30
  return Math.min(90, Math.max(1, parsed))
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Acceso restringido a administradores.' }, { status: 403 })
    }

    const days = parsePeriodDays(req.nextUrl.searchParams.get('days'))
    const costs = await getAdminAiCostStats(days)

    return NextResponse.json(costs)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los costos.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
