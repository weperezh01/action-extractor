import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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
