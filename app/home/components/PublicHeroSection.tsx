import Link from 'next/link'
import { ArrowRight, Sparkles, Zap } from 'lucide-react'
import { type Lang, t } from '@/app/home/lib/i18n'

interface PublicHeroSectionProps {
  lang: Lang
}

export function PublicHeroSection({ lang }: PublicHeroSectionProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_72px_200px_-36px_rgba(139,92,246,0.95)] dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_44px_120px_-42px_rgba(139,92,246,0.95)]">
      <div className="grid lg:grid-cols-2">
        <div className="p-7 md:p-10">
          <span className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-white/10 dark:text-zinc-300">
            <Sparkles size={13} />
            {t(lang, 'hero.badge')}
          </span>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
            {t(lang, 'hero.headline')}
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
            {t(lang, 'hero.subheadline')}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-zinc-200 px-3 py-3 shadow-[0_30px_70px_-24px_rgba(56,189,248,0.9)] dark:border-white/10 dark:shadow-[0_30px_64px_-28px_rgba(56,189,248,0.78)]">
              <p className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {t(lang, 'hero.stat1.value')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t(lang, 'hero.stat1.label')}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 px-3 py-3 shadow-[0_30px_70px_-24px_rgba(139,92,246,0.94)] dark:border-white/10 dark:shadow-[0_30px_64px_-28px_rgba(139,92,246,0.8)]">
              <p className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {t(lang, 'hero.stat2.value')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t(lang, 'hero.stat2.label')}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 px-3 py-3 shadow-[0_30px_70px_-24px_rgba(59,130,246,0.9)] dark:border-white/10 dark:shadow-[0_30px_64px_-28px_rgba(59,130,246,0.78)]">
              <p className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {t(lang, 'hero.stat3.value')}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {t(lang, 'hero.stat3.label')}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/app?mode=register"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_34px_78px_-18px_rgba(124,58,237,1)] transition-colors duration-200 hover:bg-violet-700 dark:shadow-[0_26px_56px_-22px_rgba(139,92,246,0.98)]"
            >
              {t(lang, 'hero.cta.register')}
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/app?mode=login"
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-[0_30px_66px_-22px_rgba(148,163,184,0.9)] transition-colors duration-200 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5 dark:shadow-[0_24px_48px_-24px_rgba(148,163,184,0.75)]"
            >
              {t(lang, 'hero.cta.login')}
            </Link>
          </div>
        </div>

        <aside className="border-t border-zinc-200 bg-zinc-50 p-7 dark:border-white/10 dark:bg-black/30 lg:border-l lg:border-t-0 md:p-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
              {t(lang, 'hero.preview.title')}
            </h2>
            <span className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
              {t(lang, 'hero.preview.badge')}
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_46px_110px_-24px_rgba(139,92,246,0.92)] dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_38px_88px_-34px_rgba(139,92,246,0.9)]">
            <div className="space-y-2.5">
              <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-white/10">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {t(lang, 'hero.preview.phase1')}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-white/10">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {t(lang, 'hero.preview.phase2')}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-white/10">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  {t(lang, 'hero.preview.phase3')}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-zinc-200 px-3 py-2 text-center dark:border-white/10">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t(lang, 'hero.preview.timeSaved')}
                </p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">1h 27m</p>
              </div>
              <div className="rounded-lg border border-zinc-200 px-3 py-2 text-center dark:border-white/10">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t(lang, 'hero.preview.difficulty')}
                </p>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {t(lang, 'hero.preview.difficultyValue')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-white/10">
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                <Zap size={12} className="mr-1 inline-block" />
                {t(lang, 'hero.preview.tip1')}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 px-3 py-2 dark:border-white/10">
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                {t(lang, 'hero.preview.tip2')}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
