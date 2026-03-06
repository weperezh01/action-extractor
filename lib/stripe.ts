import Stripe from 'stripe'

// Stripe is initialized lazily at runtime so the build succeeds without env vars.
// API calls will fail with a clear error if STRIPE_SECRET_KEY is not set at runtime.
let _stripe: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripe
}

// Named alias kept for backward compat with existing imports of `stripe`
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const PLAN_PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
  pro: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
  business: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '',
}

// Daily extraction limits per plan
export const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  starter: 15,
  pro: 40,
  business: 150,
}

export const CREDIT_PACK_PRICE_IDS = {
  pack_s: process.env.STRIPE_PRICE_CREDIT_PACK_S ?? '',
  pack_m: process.env.STRIPE_PRICE_CREDIT_PACK_M ?? '',
  pack_l: process.env.STRIPE_PRICE_CREDIT_PACK_L ?? '',
}

export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  pack_s: 5,
  pack_m: 20,
  pack_l: 50,
}

export function planFromPriceId(priceId: string): 'starter' | 'pro' | 'business' | null {
  if (PLAN_PRICE_IDS.starter && priceId === PLAN_PRICE_IDS.starter) return 'starter'
  if (PLAN_PRICE_IDS.pro && priceId === PLAN_PRICE_IDS.pro) return 'pro'
  if (PLAN_PRICE_IDS.business && priceId === PLAN_PRICE_IDS.business) return 'business'
  return null
}
