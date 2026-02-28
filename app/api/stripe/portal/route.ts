import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getUserStripeCustomerId } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://roi.welltechnologies.net'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const stripeCustomerId = await getUserStripeCustomerId(user.id)
    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No tienes una suscripción activa en Stripe.' },
        { status: 400 }
      )
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${APP_URL}/settings`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] stripe/portal POST error:', message)
    return NextResponse.json({ error: 'No se pudo abrir el portal de facturación.' }, { status: 500 })
  }
}
