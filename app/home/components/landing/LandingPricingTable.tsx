'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Lang } from '@/app/home/lib/i18n'
import {
  type DbPlan,
  PricingPlansGrid,
} from '@/app/pricing/components/PricingPlansGrid'

type LandingPricingTableProps = {
  lang: Lang
}

export function LandingPricingTable({ lang }: LandingPricingTableProps) {
  const [plans, setPlans] = useState<DbPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)

  useEffect(() => {
    fetch('/api/plans', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { plans: DbPlan[] } | null) => {
        if (data?.plans) setPlans(data.plans)
      })
      .catch(() => undefined)
      .finally(() => setLoadingPlans(false))
  }, [])

  const noteCta = lang === 'es' ? 'Ver precios completos' : 'View full pricing'

  return (
    <div className="mt-10 md:mt-12">
      {loadingPlans ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-cyan-600 dark:text-cyan-300" />
        </div>
      ) : (
        <PricingPlansGrid lang={lang} plans={plans} ctaMode="details" />
      )}

      <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/pricing"
          className="font-semibold text-cyan-700 underline decoration-cyan-300 underline-offset-4 transition-colors hover:text-cyan-800 dark:text-cyan-300 dark:decoration-cyan-500/50 dark:hover:text-cyan-200"
        >
          {noteCta}
        </Link>
      </div>
    </div>
  )
}
