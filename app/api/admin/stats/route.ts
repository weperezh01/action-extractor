import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { getAdminUsageStats } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_ESTIMATED_COST_PER_EXTRACTION_USD = 0.04
const MAX_ESTIMATED_COST_PER_EXTRACTION_USD = 5

function parsePeriodDays(raw: string | null) {
  if (!raw) return 30
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return 30
  return Math.min(90, Math.max(1, parsed))
}

function resolveEstimatedCostPerExtractionUsd() {
  const raw = process.env.ACTION_EXTRACTOR_ESTIMATED_COST_PER_EXTRACTION_USD
  if (!raw) return DEFAULT_ESTIMATED_COST_PER_EXTRACTION_USD

  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_ESTIMATED_COST_PER_EXTRACTION_USD
  }

  return Math.min(MAX_ESTIMATED_COST_PER_EXTRACTION_USD, parsed)
}

function roundUsd(value: number) {
  return Math.round(value * 100) / 100
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
    const stats = await getAdminUsageStats(days)

    const estimatedCostPerExtractionUsd = resolveEstimatedCostPerExtractionUsd()
    const estimatedClaudeCalls = stats.unique_videos_in_period
    const estimatedClaudeCostUsd = roundUsd(estimatedClaudeCalls * estimatedCostPerExtractionUsd)

    return NextResponse.json({
      stats,
      estimation: {
        periodDays: stats.period_days,
        estimatedClaudeCalls,
        estimatedCostPerExtractionUsd,
        estimatedClaudeCostUsd,
        currency: 'USD',
        method: 'videos_unicos_en_periodo',
        note: 'Estimación aproximada basada en videos únicos procesados durante el periodo.',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las métricas.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
