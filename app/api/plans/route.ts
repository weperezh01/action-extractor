import { NextResponse } from 'next/server'
import { listPlans } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const plans = await listPlans()
  return NextResponse.json({ plans: plans.filter((p) => p.is_active) })
}
