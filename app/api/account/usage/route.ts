import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getAdminUserAiCostDetail, getUserAiDailyUsage } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const USE_TYPE_LABELS: Record<string, string> = {
  extraction: 'Extracción',
  chat: 'Chat',
  repair: 'Reparación JSON',
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const [detail, daily] = await Promise.all([
    getAdminUserAiCostDetail(user.id),
    getUserAiDailyUsage(user.id, 30),
  ])

  return NextResponse.json({
    totals: {
      calls: detail.total_calls,
      inputTokens: detail.total_input_tokens,
      outputTokens: detail.total_output_tokens,
      totalTokens: detail.total_input_tokens + detail.total_output_tokens,
      costUsd: Number(detail.total_cost_usd.toFixed(6)),
    },
    byUseType: detail.by_use_type.map((bt) => ({
      useType: bt.use_type,
      label: USE_TYPE_LABELS[bt.use_type] ?? bt.use_type,
      calls: bt.calls,
      costUsd: Number(Number(bt.cost_usd).toFixed(6)),
    })),
    daily,
  })
}
