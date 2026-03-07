'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, Suspense } from 'react'
import { Loader2, Zap } from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'
import {
  type DbPlan,
  type PlanSnapshot,
  PricingPlansGrid,
} from '@/app/pricing/components/PricingPlansGrid'
import { t } from '@/app/home/lib/i18n'

const CREDIT_PACKS: Array<{ id: string; label: string; credits: number; price: string; popular?: boolean }> = [
  { id: 'pack_s', label: 'Pack S', credits: 5,  price: '$1.99' },
  { id: 'pack_m', label: 'Pack M', credits: 20, price: '$5.99', popular: true },
  { id: 'pack_l', label: 'Pack L', credits: 50, price: '$12.99' },
]

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(iso))
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
        <PricingPlansGrid
          lang={lang}
          plans={plans}
          currentPlan={currentPlan}
          checkingOut={checkingOut}
          openingPortal={openingPortal}
          onUpgrade={(planName) => {
            void handleUpgrade(planName)
          }}
          onManageBilling={() => {
            void handleManageBilling()
          }}
        />

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
