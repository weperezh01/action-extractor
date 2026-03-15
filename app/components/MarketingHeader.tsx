'use client'

import { type MouseEvent as ReactMouseEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { Moon, Sun } from 'lucide-react'
import { NotesAideLogo } from '@/app/components/NotesAideLogo'
import type { Lang } from '@/app/home/lib/i18n'
import { t } from '@/app/home/lib/i18n'
import type { Theme } from '@/app/home/lib/types'
import { applyTheme, getThemeStorageKey, resolveInitialTheme } from '@/app/home/lib/utils'
import { getLegalPagePath } from '@/lib/legal-links'

const containerClass = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

interface MarketingHeaderProps {
  lang: Lang
  onToggleLang: () => void
  basePath?: string
  onSectionAnchorClick?: (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => void
}

function getSectionLinks(lang: Lang) {
  return lang === 'es'
    ? [
        { href: '#how-it-works', label: 'Cómo funciona' },
        { href: '#extraction-modes', label: 'Formatos' },
        { href: '#views', label: 'Vistas' },
        { href: '#use-cases', label: 'Casos de uso' },
        { href: '#integrations', label: 'Integraciones' },
        { href: '#pricing', label: 'Pricing' },
        { href: '#faq', label: 'FAQ' },
      ]
    : [
        { href: '#how-it-works', label: 'How it works' },
        { href: '#extraction-modes', label: 'Formats' },
        { href: '#views', label: 'Views' },
        { href: '#use-cases', label: 'Use cases' },
        { href: '#integrations', label: 'Integrations' },
        { href: '#pricing', label: 'Pricing' },
        { href: '#faq', label: 'FAQ' },
      ]
}

export function MarketingHeader({
  lang,
  onToggleLang,
  basePath = '',
  onSectionAnchorClick,
}: MarketingHeaderProps) {
  const [theme, setTheme] = useState<Theme>('light')
  const themeStorageKey = getThemeStorageKey()
  const sectionLinks = getSectionLinks(lang)
  const privacyHref = getLegalPagePath(lang, 'privacy')
  const termsHref = getLegalPagePath(lang, 'terms')

  useEffect(() => {
    const initial = resolveInitialTheme()
    setTheme(initial)
    applyTheme(initial)
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)

    try {
      localStorage.setItem(themeStorageKey, next)
    } catch {
      // noop
    }
  }

  return (
    <nav className="sticky top-0 z-20 border-b border-white/60 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/75">
      <div className={`${containerClass} flex items-center justify-between py-3`}>
        <div className="flex items-center">
          <NotesAideLogo
            className="h-10 w-[172px] text-zinc-900 sm:h-11 sm:w-[210px] md:h-12 md:w-[244px] dark:text-zinc-100"
            title="Notes Aide"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-5 text-xs font-semibold text-zinc-500 lg:flex dark:text-zinc-400">
            {sectionLinks.map((item) => {
              const href = `${basePath}${item.href}`

              return (
                <a
                  key={item.href}
                  href={href}
                  onClick={
                    onSectionAnchorClick
                      ? (event) => onSectionAnchorClick(event, href)
                      : undefined
                  }
                  className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  {item.label}
                </a>
              )
            })}
          </div>

          <div className="hidden items-center gap-4 text-xs font-medium text-zinc-500 md:flex lg:hidden dark:text-zinc-400">
            <Link
              className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              href={privacyHref}
            >
              {t(lang, 'nav.privacy')}
            </Link>
            <Link
              className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
              href={termsHref}
            >
              {t(lang, 'nav.terms')}
            </Link>
          </div>

          <button
            type="button"
            onClick={onToggleLang}
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
          >
            {t(lang, 'nav.langToggle')}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t(lang, 'nav.light') : t(lang, 'nav.dark')}
            title={theme === 'dark' ? t(lang, 'nav.light') : t(lang, 'nav.dark')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <Link
            href="/login"
            className="hidden text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 md:inline"
          >
            {t(lang, 'nav.signin')}
          </Link>

          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-950"
          >
            {t(lang, 'landing.hero.cta')}
          </Link>
        </div>
      </div>
    </nav>
  )
}
