'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckSquare, Clock, Copy, Moon, Sun } from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'
import { PublicHeroSection } from '@/app/home/components/PublicHeroSection'
import { applyTheme, getThemeStorageKey, resolveInitialTheme } from '@/app/home/lib/utils'
import { t } from '@/app/home/lib/i18n'
import type { Theme } from '@/app/home/lib/types'

function ValueHighlights({ lang }: { lang: ReturnType<typeof useLang>['lang'] }) {
  return (
    <div className="grid gap-4 text-center md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          <Clock size={24} />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t(lang, 'value.time.title')}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'value.time.desc')}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
          <CheckSquare size={24} />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t(lang, 'value.action.title')}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'value.action.desc')}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
          <Copy size={24} />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{t(lang, 'value.export.title')}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t(lang, 'value.export.desc')}</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const { lang, toggle: toggleLang } = useLang()
  const [theme, setTheme] = useState<Theme>('light')
  const themeStorageKey = getThemeStorageKey()

  useEffect(() => {
    const initialTheme = resolveInitialTheme()
    setTheme(initialTheme)
    applyTheme(initialTheme)
  }, [])

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    applyTheme(nextTheme)
    try {
      localStorage.setItem(themeStorageKey, nextTheme)
    } catch {
      // noop
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-black/90">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/15 dark:bg-zinc-950">
            <Image
              src="/roi-logo.png"
              alt="Roi Action Extractor App logo"
              fill
              sizes="36px"
              className="object-cover"
              priority
            />
          </div>
          <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-xl">
            Roi Action Extractor
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs font-medium text-zinc-500 md:flex dark:text-zinc-400">
            <Link className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-100" href="/privacy-policy">
              {t(lang, 'nav.privacy')}
            </Link>
            <Link className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-100" href="/terms-of-use">
              {t(lang, 'nav.terms')}
            </Link>
          </div>

          <button
            onClick={toggleLang}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-transparent px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100"
            aria-label="Toggle language"
          >
            {t(lang, 'nav.langToggle')}
          </button>

          <button
            onClick={toggleTheme}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-transparent px-3 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100 dark:shadow-[0_20px_44px_-24px_rgba(148,163,184,0.72)]"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="hidden text-sm font-medium whitespace-nowrap sm:inline">
              {theme === 'dark' ? t(lang, 'nav.light') : t(lang, 'nav.dark')}
            </span>
          </button>

          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-violet-700 dark:shadow-[0_24px_52px_-22px_rgba(139,92,246,0.96)]"
          >
            {t(lang, 'nav.openApp')}
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="space-y-8">
          <PublicHeroSection lang={lang} />

          <div className="text-center">
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight dark:text-white">
              {t(lang, 'landing.headline')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                {t(lang, 'landing.headlineAccent')}
              </span>{' '}
              {t(lang, 'landing.headlineSuffix')}
            </h2>
            <div className="mx-auto mt-5 h-[180px] w-[180px]">
              <div className="relative h-full w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-white/15 dark:bg-zinc-950">
                <Image
                  src="/roi-logo.png"
                  alt="Roi Action Extractor App logo"
                  fill
                  sizes="180px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>

          <ValueHighlights lang={lang} />
        </div>
      </main>
    </div>
  )
}
