'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, Suspense } from 'react'
import { Check, Loader2, Zap } from 'lucide-react'
import { FEATURE_KEYS } from '@/app/admin/plans/page'
import { useLang } from '@/app/home/hooks/useLang'
import { t } from '@/app/home/lib/i18n'

interface DbPlan {
  id: string
  name: string
  display_name: string
  price_monthly_usd: number
  stripe_price_id: string | null
  extractions_per_hour: number
  extractions_per_day?: number
  features_json: string
  is_active: boolean
  display_order: number
}

interface PlanSnapshot {
  plan: string
  extractionsPerHour: number
  extractionsPerDay?: number
  creditBalance?: number
  status: string
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
}

const CREDIT_PACKS: Array<{ id: string; label: string; credits: number; price: string; popular?: boolean }> = [
  { id: 'pack_s', label: 'Pack S', credits: 5,  price: '$1.99' },
  { id: 'pack_m', label: 'Pack M', credits: 20, price: '$5.99', popular: true },
  { id: 'pack_l', label: 'Pack L', credits: 50, price: '$12.99' },
]

function parseFeatures(json: string): Record<string, boolean> {
  try { return JSON.parse(json) as Record<string, boolean> }
  catch { return {} }
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(iso))
}

const PLAN_COLORS: Record<string, { border: string; cta: string; badge?: true }> = {
  free:     { border: 'border-slate-200 dark:border-slate-800', cta: '' },
  starter:  { border: 'border-emerald-400 dark:border-emerald-600', cta: 'bg-emerald-600 hover:bg-emerald-700' },
  pro:      { border: 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20', cta: 'bg-indigo-600 hover:bg-indigo-700', badge: true },
  business: { border: 'border-violet-500 dark:border-violet-400', cta: 'bg-violet-600 hover:bg-violet-700' },
}

function planColors(name: string) {
  return PLAN_COLORS[name] ?? { border: 'border-slate-300 dark:border-slate-700', cta: 'bg-slate-700 hover:bg-slate-800' }
}

function PricingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const canceled = searchParams.get('canceled') === '1'
  const { lang } = useLang()

  const [plans, setPlans] = useState<DbPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<PlanSnapshot | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [buyingPack, setBuyingPack] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/plans', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { plans: DbPlan[] } | null) => {
        if (d?.plans) setPlans(d.plans)
      })
      .catch(() => undefined)
      .finally(() => setLoadingPlans(false))
  }, [])

  useEffect(() => {
    fetch('/api/account/plan', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PlanSnapshot | null) => { if (d) setCurrentPlan(d) })
      .catch(() => undefined)
  }, [])

  const handleUpgrade = async (planName: string) => {
    setError(null)
    setCheckingOut(planName)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: planName }),
      })
      if (res.status === 401) { router.push('/'); return }
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !data?.url) { setError(data?.error ?? t(lang, 'pricing.paymentError')); return }
      window.location.href = data.url
    } catch {
      setError(t(lang, 'pricing.connectionError'))
    } finally {
      setCheckingOut(null)
    }
  }

  const handleManageBilling = async () => {
    setError(null)
    setOpeningPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      if (res.status === 401) { router.push('/'); return }
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !data?.url) { setError(data?.error ?? t(lang, 'pricing.portalError')); return }
      window.location.href = data.url
    } catch {
      setError(t(lang, 'pricing.connectionError'))
    } finally {
      setOpeningPortal(false)
    }
  }

  const handleBuyCreditPack = useCallback(async (packId: string) => {
    setError(null)
    setBuyingPack(packId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'credits', packId }),
      })
      if (res.status === 401) { router.push('/'); return }
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !data?.url) { setError(data?.error ?? t(lang, 'pricing.paymentError')); return }
      window.location.href = data.url
    } catch {
      setError(t(lang, 'pricing.connectionError'))
    } finally {
      setBuyingPack(null)
    }
  }, [router, lang])

  const isCurrentPlan = (planName: string) => currentPlan?.plan === planName

  if (loadingPlans) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">

        <div className="mb-2">
          <Link href="/app" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
            {t(lang, 'pricing.backToExtractor')}
          </Link>
        </div>

        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold md:text-4xl">{t(lang, 'pricing.title')}</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            {t(lang, 'pricing.subtitle')}
          </p>
        </div>

        {/* Notices */}
        {canceled && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {t(lang, 'pricing.paymentCanceled')}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Active plan banner */}
        {currentPlan && currentPlan.plan !== 'free' && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 flex flex-wrap items-center justify-between gap-3">
            <span>
              {t(lang, 'pricing.activePlan')} <strong className="capitalize">{currentPlan.plan}</strong>
              {currentPlan.currentPeriodEnd && <> {t(lang, 'pricing.renewsOn')} {formatDate(currentPlan.currentPeriodEnd)}</>}
            </span>
            {currentPlan.hasStripeCustomer && (
              <button
                type="button"
                onClick={() => void handleManageBilling()}
                disabled={openingPortal}
                className="inline-flex items-center gap-1.5 text-emerald-700 underline underline-offset-2 hover:no-underline disabled:opacity-60 dark:text-emerald-300"
              >
                {openingPortal && <Loader2 size={13} className="animate-spin" />}
                {t(lang, 'pricing.manageBilling')}
              </button>
            )}
          </div>
        )}

        {/* Plan cards */}
        <div className={`grid gap-5 ${plans.length <= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan.name)
            const colors = planColors(plan.name)
            const features = parseFeatures(plan.features_json)

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${colors.border}`}
              >
                {colors.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                      {t(lang, 'pricing.mostPopular')}
                    </span>
                  </div>
                )}

                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold">{plan.display_name}</h2>
                  {isCurrent && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {t(lang, 'pricing.currentPlan')}
                    </span>
                  )}
                </div>

                <div className="mb-1 flex items-end gap-1">
                  <span className="text-3xl font-extrabold">
                    {plan.price_monthly_usd === 0 ? '$0' : `$${plan.price_monthly_usd}`}
                  </span>
                  {plan.price_monthly_usd > 0 && (
                    <span className="mb-1 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'pricing.monthly')}</span>
                  )}
                </div>

                <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                  {plan.extractions_per_day ?? plan.extractions_per_hour} {t(lang, 'pricing.extractionsPerDay')}
                </p>

                {/* Features */}
                <ul className="mb-5 flex-1 space-y-1.5">
                  {FEATURE_KEYS.map(({ key, label }) => {
                    const enabled = features[key] === true
                    return (
                      <li key={key} className={`flex items-start gap-2 text-xs ${enabled ? '' : 'opacity-40'}`}>
                        <Check size={13} className={`mt-0.5 shrink-0 ${enabled ? 'text-indigo-500' : 'text-slate-300'}`} />
                        <span>{label}</span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA */}
                {plan.name === 'free' ? (
                  isCurrent ? (
                    <span className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-center text-xs font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                      {t(lang, 'pricing.currentPlan')}
                    </span>
                  ) : (
                    <Link href="/app" className="block w-full rounded-lg border border-slate-300 bg-white py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {t(lang, 'pricing.goToExtractor')}
                    </Link>
                  )
                ) : isCurrent ? (
                  <div className="space-y-1.5">
                    <span className="block w-full rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-center text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {t(lang, 'pricing.currentPlan')}
                    </span>
                    {currentPlan?.hasStripeCustomer && (
                      <button
                        type="button"
                        onClick={() => void handleManageBilling()}
                        disabled={openingPortal}
                        className="block w-full rounded-lg border border-slate-300 bg-white py-2 text-center text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {openingPortal ? <Loader2 size={12} className="animate-spin mx-auto" /> : t(lang, 'pricing.manageBilling')}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleUpgrade(plan.name)}
                    disabled={!!checkingOut || openingPortal || !plan.stripe_price_id}
                    className={`w-full rounded-lg py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-60 ${colors.cta || 'bg-indigo-600 hover:bg-indigo-700'}`}
                    title={!plan.stripe_price_id ? 'Stripe Price ID no configurado' : undefined}
                  >
                    {checkingOut === plan.name ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" /> {t(lang, 'pricing.redirecting')}
                      </span>
                    ) : (
                      `${t(lang, 'pricing.startWith')} ${plan.display_name}`
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Credit packs section */}
        <div id="credits" className="mt-14 scroll-mt-16">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold">{t(lang, 'pricing.creditsTitle')}</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
              {t(lang, 'pricing.creditsSubtitle')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${
                  pack.popular
                    ? 'border-indigo-400 ring-2 ring-indigo-500/20 dark:border-indigo-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                      {t(lang, 'pricing.mostPopular')}
                    </span>
                  </div>
                )}

                <div className="mb-3 flex items-center gap-2">
                  <Zap size={16} className="text-amber-500 shrink-0" />
                  <h3 className="font-bold text-sm">{pack.label}</h3>
                </div>

                <div className="mb-1 flex items-end gap-1">
                  <span className="text-2xl font-extrabold">{pack.price}</span>
                  <span className="mb-1 text-xs text-slate-500 dark:text-slate-400">{t(lang, 'pricing.oneTime')}</span>
                </div>

                <p className="mb-4 text-xs text-slate-500 dark:text-slate-400 flex-1">
                  {pack.credits} {t(lang, 'pricing.creditsSuffix')}
                </p>

                <button
                  type="button"
                  onClick={() => void handleBuyCreditPack(pack.id)}
                  disabled={!!buyingPack || !!checkingOut}
                  className={`w-full rounded-lg py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60 ${
                    pack.popular ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {buyingPack === pack.id ? (
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <Loader2 size={12} className="animate-spin" /> {t(lang, 'pricing.redirecting')}
                    </span>
                  ) : (
                    `${t(lang, 'pricing.buyCredits')} ${pack.credits} ${t(lang, 'pricing.creditsSuffix')}`
                  )}
                </button>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            {t(lang, 'pricing.creditsNote')}
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          {t(lang, 'pricing.stripeNote')}
        </p>
      </div>
    </main>
  )
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  )
}
