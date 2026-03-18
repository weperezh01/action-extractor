import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { getAdminInvestorMetricsPack } from '@/lib/db/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parsePeriodDays(raw: string | null) {
  if (!raw) return 30
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return 30
  return Math.min(90, Math.max(1, parsed))
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const days = parsePeriodDays(req.nextUrl.searchParams.get('days'))
  const format = req.nextUrl.searchParams.get('format')
  const payload = await getAdminInvestorMetricsPack(days)

  if (format === 'json') {
    const generatedOn = payload.generated_at.slice(0, 10)
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="investor-metrics-pack-${generatedOn}.json"`,
      },
    })
  }

  return NextResponse.json(payload)
}
