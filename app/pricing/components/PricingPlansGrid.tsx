import Link from 'next/link'
import { Check, HardDrive, Loader2 } from 'lucide-react'
import { FEATURE_KEYS } from '@/app/admin/plans/feature-keys'
import { t, type Lang } from '@/app/home/lib/i18n'
import { formatStorageBytes } from '@/lib/storage-limits'

export interface DbPlan {
  id: string
  name: string
  display_name: string
  price_monthly_usd: number
  stripe_price_id: string | null
  extractions_per_hour: number
  extractions_per_day?: number
  storage_limit_bytes?: number
  features_json: string
  is_active: boolean
  display_order: number
}

export interface PlanSnapshot {
  plan: string
  extractionsPerHour: number
  extractionsPerDay?: number
  creditBalance?: number
  status: string
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
}

type PricingPlansGridProps = {
  lang: Lang
  plans: DbPlan[]
  currentPlan?: PlanSnapshot | null
  checkingOut?: string | null
  openingPortal?: boolean
  onUpgrade?: (planName: string) => void
  onManageBilling?: () => void
  ctaMode?: 'interactive' | 'details'
}

function parseFeatures(json: string): Record<string, boolean> {
  try {
    return JSON.parse(json) as Record<string, boolean>
  } catch {
    return {}
  }
}

const PLAN_COLORS: Record<string, { border: string; cta: string; badge?: true }> = {
  free: { border: 'border-slate-200 dark:border-slate-800', cta: '' },
  starter: {
    border: 'border-emerald-400 dark:border-emerald-600',
    cta: 'bg-emerald-600 hover:bg-emerald-700',
  },
  pro: {
    border: 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20',
    cta: 'bg-indigo-600 hover:bg-indigo-700',
    badge: true,
  },
  business: {
    border: 'border-violet-500 dark:border-violet-400',
    cta: 'bg-violet-600 hover:bg-violet-700',
  },
}

function planColors(name: string) {
  return PLAN_COLORS[name] ?? {
    border: 'border-slate-300 dark:border-slate-700',
    cta: 'bg-slate-700 hover:bg-slate-800',
  }
}

export function PricingPlansGrid({
  lang,
  plans,
  currentPlan = null,
  checkingOut = null,
  openingPortal = false,
  onUpgrade,
  onManageBilling,
  ctaMode = 'interactive',
}: PricingPlansGridProps) {
  const isCurrentPlan = (planName: string) => currentPlan?.plan === planName

  return (
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
                <span className="mb-1 text-sm text-slate-500 dark:text-slate-400">
                  {t(lang, 'pricing.monthly')}
                </span>
              )}
            </div>

            <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
              {plan.extractions_per_day ?? plan.extractions_per_hour} {t(lang, 'pricing.extractionsPerDay')}
            </p>
            <p className="mb-4 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <HardDrive size={11} className="shrink-0" />
              {plan.storage_limit_bytes ? formatStorageBytes(plan.storage_limit_bytes) : '100 MB'} almacenamiento
            </p>

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

            {ctaMode === 'interactive' ? (
              plan.name === 'free' ? (
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
                  {currentPlan?.hasStripeCustomer && onManageBilling ? (
                    <button
                      type="button"
                      onClick={onManageBilling}
                      disabled={openingPortal}
                      className="block w-full rounded-lg border border-slate-300 bg-white py-2 text-center text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {openingPortal ? <Loader2 size={12} className="mx-auto animate-spin" /> : t(lang, 'pricing.manageBilling')}
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpgrade?.(plan.name)}
                  disabled={!!checkingOut || openingPortal || !plan.stripe_price_id || !onUpgrade}
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
              )
            ) : (
              <Link
                href={plan.name === 'free' ? '/register' : '/pricing'}
                className={`block w-full rounded-lg py-2.5 text-center text-xs font-semibold transition-colors ${
                  plan.name === 'free'
                    ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    : `${colors.cta || 'bg-indigo-600 hover:bg-indigo-700'} text-white`
                }`}
              >
                {plan.name === 'free'
                  ? t(lang, 'pricing.goToExtractor')
                  : `${t(lang, 'pricing.startWith')} ${plan.display_name}`}
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
