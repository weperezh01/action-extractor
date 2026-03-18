import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { getAdminAiCostModelDetail } from '@/lib/db/billing'

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

    const provider = req.nextUrl.searchParams.get('provider')?.trim() ?? ''
    const model = req.nextUrl.searchParams.get('model')?.trim() ?? ''
    if (!provider || !model) {
      return NextResponse.json({ error: 'Debes indicar provider y model.' }, { status: 400 })
    }

    const days = parsePeriodDays(req.nextUrl.searchParams.get('days'))
    const detail = await getAdminAiCostModelDetail(provider, model, days)

    return NextResponse.json(detail)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el detalle del modelo.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
