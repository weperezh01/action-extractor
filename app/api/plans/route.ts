import { NextResponse } from 'next/server'
import { listPlans } from '@/lib/db'
import { CREDIT_PACK_PRICE_IDS } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const plans = await listPlans()
  return NextResponse.json({
    plans: plans.filter((p) => p.is_active),
    creditPacks: {
      pack_s: Boolean(CREDIT_PACK_PRICE_IDS.pack_s),
      pack_m: Boolean(CREDIT_PACK_PRICE_IDS.pack_m),
      pack_l: Boolean(CREDIT_PACK_PRICE_IDS.pack_l),
    },
  })
}
