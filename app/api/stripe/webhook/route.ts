import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe, planFromPriceId, PLAN_LIMITS } from '@/lib/stripe'
import {
  getUserByStripeCustomerId,
  logStripeEvent,
  setUserStripeCustomerId,
  upsertUserActivePlan,
  deactivateUserPlan,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

// Extract billing period dates from a subscription object (API version-agnostic)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPeriodDates(sub: any): { periodStart: Date | null; periodEnd: Date | null } {
  const start = sub.current_period_start ?? sub.billing_cycle_anchor ?? null
  const end = sub.current_period_end ?? null
  return {
    periodStart: typeof start === 'number' ? new Date(start * 1000) : null,
    periodEnd: typeof end === 'number' ? new Date(end * 1000) : null,
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    console.error('[Stripe] Webhook signature verification failed:', message)
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  // Idempotency guard — skip already-processed events
  await logStripeEvent(event.id, event.type, null, rawBody)

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (!userId || !session.subscription || !session.customer) {
        return NextResponse.json({ received: true })
      }

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer.id

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any
      const priceId = subscription.items?.data[0]?.price?.id ?? ''
      const plan = planFromPriceId(priceId) ?? 'pro'
      const extractionsPerHour = PLAN_LIMITS[plan] ?? 60
      const { periodStart, periodEnd } = extractPeriodDates(subscription)

      await setUserStripeCustomerId(userId, customerId)
      await upsertUserActivePlan({
        userId,
        plan,
        extractionsPerHour,
        subscriptionId,
        priceId,
        periodStart,
        periodEnd,
      })

      console.log(`[Stripe] checkout.session.completed — user ${userId} → plan ${plan}`)
    } else if (event.type === 'customer.subscription.updated') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

      const user = await getUserByStripeCustomerId(customerId)
      if (!user) {
        return NextResponse.json({ received: true })
      }

      const priceId = subscription.items?.data[0]?.price?.id ?? ''
      const plan = planFromPriceId(priceId) ?? 'pro'
      const extractionsPerHour = PLAN_LIMITS[plan] ?? 60
      const status: string = subscription.status
      const { periodStart, periodEnd } = extractPeriodDates(subscription)

      if (status === 'active' || status === 'trialing') {
        await upsertUserActivePlan({
          userId: user.id,
          plan,
          extractionsPerHour,
          subscriptionId: subscription.id,
          priceId,
          periodStart,
          periodEnd,
        })
      } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
        await deactivateUserPlan(user.id, subscription.id)
      }

      console.log(`[Stripe] subscription.updated — user ${user.id} → plan ${plan} (${status})`)
    } else if (event.type === 'customer.subscription.deleted') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

      const user = await getUserByStripeCustomerId(customerId)
      if (!user) {
        return NextResponse.json({ received: true })
      }

      await deactivateUserPlan(user.id, subscription.id)
      console.log(`[Stripe] subscription.deleted — user ${user.id} downgraded to free`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Stripe] Webhook handler error:', message)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
