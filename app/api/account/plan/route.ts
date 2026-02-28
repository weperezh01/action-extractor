import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getUserActivePlan, getUserStripeCustomerId } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const [plan, stripeCustomerId] = await Promise.all([
      getUserActivePlan(user.id),
      getUserStripeCustomerId(user.id),
    ])

    if (!plan) {
      return NextResponse.json({
        plan: 'free',
        extractionsPerHour: 12,
        status: 'active',
        currentPeriodEnd: null,
        hasStripeCustomer: Boolean(stripeCustomerId),
      })
    }

    return NextResponse.json({
      plan: plan.plan,
      extractionsPerHour: plan.extractions_per_hour,
      status: plan.status,
      currentPeriodEnd: plan.current_period_end,
      hasStripeCustomer: Boolean(stripeCustomerId),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] account/plan GET error:', message)
    return NextResponse.json({ error: 'No se pudo obtener el plan.' }, { status: 500 })
  }
}
