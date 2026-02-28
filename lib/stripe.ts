import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const PLAN_PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
  business: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '',
}

export const PLAN_LIMITS: Record<string, number> = {
  free: 12,
  pro: 60,
  business: 200,
}

export function planFromPriceId(priceId: string): 'pro' | 'business' | null {
  if (PLAN_PRICE_IDS.pro && priceId === PLAN_PRICE_IDS.pro) return 'pro'
  if (PLAN_PRICE_IDS.business && priceId === PLAN_PRICE_IDS.business) return 'business'
  return null
}
