'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Brain,
  CheckCircle,
  Download,
  FileText,
  Lightbulb,
  Link2,
  ListChecks,
  Moon,
  Quote,
  Sparkles,
  Sun,
} from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'
import { applyTheme, getThemeStorageKey, resolveInitialTheme } from '@/app/home/lib/utils'
import { t } from '@/app/home/lib/i18n'
import type { Theme } from '@/app/home/lib/types'

export default function LandingPage() {
  const { lang, toggle: toggleLang } = useLang()
  const [theme, setTheme] = useState<Theme>('light')
  const themeStorageKey = getThemeStorageKey()

  useEffect(() => {
    const initial = resolveInitialTheme()
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    try { localStorage.setItem(themeStorageKey, next) } catch { /* noop */ }
  }

  const steps = [
    {
      num: '01',
      icon: <Link2 size={22} />,
      title: t(lang, 'landing.how.step1.title'),
      desc: t(lang, 'landing.how.step1.desc'),
    },
    {
      num: '02',
      icon: <Brain size={22} />,
      title: t(lang, 'landing.how.step2.title'),
      desc: t(lang, 'landing.how.step2.desc'),
    },
    {
      num: '03',
      icon: <Download size={22} />,
      title: t(lang, 'landing.how.step3.title'),
      desc: t(lang, 'landing.how.step3.desc'),
    },
  ]

  const modes = [
    {
      icon: <ListChecks size={20} />,
      iconClass: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400',
      title: t(lang, 'landing.mode1.title'),
      desc: t(lang, 'landing.mode1.desc'),
    },
    {
      icon: <FileText size={20} />,
      iconClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
      title: t(lang, 'landing.mode2.title'),
      desc: t(lang, 'landing.mode2.desc'),
    },
    {
      icon: <Lightbulb size={20} />,
      iconClass: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
      title: t(lang, 'landing.mode3.title'),
      desc: t(lang, 'landing.mode3.desc'),
    },
    {
      icon: <Quote size={20} />,
      iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
      title: t(lang, 'landing.mode4.title'),
      desc: t(lang, 'landing.mode4.desc'),
    },
  ]

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-3.5 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/15 dark:bg-zinc-900">
            <Image src="/roi-logo.png" alt="ROI Action Extractor" fill sizes="32px" className="object-cover" priority />
          </div>
          <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-base">
            ROI Action Extractor
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-4 text-xs font-medium text-zinc-500 md:flex dark:text-zinc-400">
            <Link className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-100" href="/privacy-policy">
              {t(lang, 'nav.privacy')}
            </Link>
            <Link className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-100" href="/terms-of-use">
              {t(lang, 'nav.terms')}
            </Link>
          </div>

          <button
            onClick={toggleLang}
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            {t(lang, 'nav.langToggle')}
          </button>

          <button
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <Link
            href="/app?mode=login"
            className="hidden text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 md:inline"
          >
            {t(lang, 'nav.signin')}
          </Link>

          <Link
            href="/app?mode=register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            {t(lang, 'landing.hero.cta')}
          </Link>
        </div>
      </nav>

      <main>
        {/* ── HERO ── */}
        <section className="mx-auto max-w-5xl px-4 pb-20 pt-24 text-center md:pb-28 md:pt-32">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-400">
            <Sparkles size={12} />
            {t(lang, 'landing.hero.badge')}
          </span>

          <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-zinc-900 dark:text-white md:text-7xl">
            {t(lang, 'landing.hero.headline1')}{' '}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              {t(lang, 'landing.hero.headline2')}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-lg">
            {t(lang, 'landing.hero.sub')}
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/app?mode=register"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_48px_-8px_rgba(139,92,246,0.55)] transition-all hover:bg-violet-700 hover:shadow-[0_20px_56px_-6px_rgba(139,92,246,0.7)]"
            >
              {t(lang, 'landing.hero.cta')}
              <ArrowRight size={16} />
            </Link>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t(lang, 'landing.hero.signin')}{' '}
              <Link
                href="/app?mode=login"
                className="font-semibold text-violet-600 hover:underline dark:text-violet-400"
              >
                {t(lang, 'landing.hero.signinLink')}
              </Link>
            </p>
          </div>

          {/* Stats row */}
          <div className="mx-auto mt-16 grid max-w-lg grid-cols-3 gap-3">
            {[
              { value: t(lang, 'hero.stat1.value'), label: t(lang, 'hero.stat1.label') },
              { value: t(lang, 'hero.stat2.value'), label: t(lang, 'hero.stat2.label') },
              { value: t(lang, 'hero.stat3.value'), label: t(lang, 'hero.stat3.label') },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-2xl font-extrabold text-zinc-900 dark:text-white">{s.value}</p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-zinc-400">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="border-t border-zinc-100 bg-zinc-50 py-20 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white md:text-4xl">
              {t(lang, 'landing.how.title')}
            </h2>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.num} className="rounded-2xl border border-zinc-200 bg-white p-7 dark:border-white/10 dark:bg-zinc-900">
                  <span className="text-xs font-bold tracking-widest text-zinc-300 dark:text-zinc-600">
                    {step.num}
                  </span>
                  <div className="mt-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                    {step.icon}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── EXTRACTION MODES ── */}
        <section className="py-20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white md:text-4xl">
                {t(lang, 'landing.modes.title')}
              </h2>
              <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
                {t(lang, 'landing.modes.sub')}
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {modes.map((mode) => (
                <div key={mode.title} className="rounded-2xl border border-zinc-200 bg-white p-7 dark:border-white/10 dark:bg-zinc-900">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${mode.iconClass}`}>
                    {mode.icon}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {mode.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {mode.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── INTEGRATIONS ── */}
        <section className="border-t border-zinc-100 bg-zinc-50 py-20 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white md:text-4xl">
              {t(lang, 'landing.integrations.title')}
            </h2>
            <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
              {t(lang, 'landing.integrations.sub')}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {['Notion', 'Trello', 'Todoist', 'Google Docs'].map((tool) => (
                <div
                  key={tool}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 shadow-sm dark:border-white/10 dark:bg-zinc-900"
                >
                  <CheckCircle size={15} className="text-emerald-500" />
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{tool}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="py-28">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white md:text-5xl">
              {t(lang, 'landing.finalcta.title')}
            </h2>
            <p className="mt-4 text-base text-zinc-500 dark:text-zinc-400">
              {t(lang, 'landing.finalcta.sub')}
            </p>
            <Link
              href="/app?mode=register"
              className="mt-10 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-[0_20px_56px_-10px_rgba(139,92,246,0.55)] transition-all hover:bg-violet-700"
            >
              {t(lang, 'landing.finalcta.button')}
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

