import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getUserStripeCustomerId, getPlanByName } from '@/lib/db'
import { stripe, PLAN_PRICE_IDS } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roi.welltechnologies.net'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as { planId?: string } | null
    const planId = body?.planId?.toLowerCase().trim()

    if (!planId || planId === 'free') {
      return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 })
    }

    // Try DB first (admin-managed), fall back to env vars for backward compatibility
    const dbPlan = await getPlanByName(planId)
    const priceId = dbPlan?.stripe_price_id || PLAN_PRICE_IDS[planId as 'pro' | 'business'] || ''

    if (!priceId) {
      return NextResponse.json(
        { error: `El precio de Stripe para el plan "${planId}" no está configurado. Configúralo en el panel de administración.` },
        { status: 500 }
      )
    }

    if (dbPlan && !dbPlan.is_active) {
      return NextResponse.json({ error: 'Este plan no está disponible actualmente.' }, { status: 400 })
    }

    const stripeCustomerId = await getUserStripeCustomerId(user.id)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(stripeCustomerId
        ? { customer: stripeCustomerId }
        : { customer_email: user.email }),
      success_url: `${APP_URL}/app?upgrade=success&plan=${planId}`,
      cancel_url: `${APP_URL}/pricing?canceled=1`,
      metadata: { userId: user.id, plan: planId },
      subscription_data: {
        metadata: { userId: user.id, plan: planId },
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] stripe/checkout POST error:', message)
    return NextResponse.json({ error: 'No se pudo crear la sesión de pago.' }, { status: 500 })
  }
}
