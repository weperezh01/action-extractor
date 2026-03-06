'use client'

import { useTranslations } from 'next-intl'
import { useLang } from '@/app/home/hooks/useLang'

interface LanguageToggleProps {
  className?: string
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { lang, toggle } = useLang()
  const t = useTranslations('common')
  const nextLang = lang === 'en' ? 'es' : 'en'
  const nextLangLabel = nextLang === 'es' ? t('language.es') : t('language.en')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('languageToggle.ariaLabel', { language: nextLangLabel })}
      title={t('languageToggle.title', { language: nextLangLabel })}
      className={
        className ??
        'inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
      }
    >
      {lang.toUpperCase()}
    </button>
  )
}
