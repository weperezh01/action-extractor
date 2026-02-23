'use client'

import { useCallback, useEffect, useState } from 'react'
import { type Lang, LANG_STORAGE_KEY, normalizeLang } from '@/app/home/lib/i18n'

export function useLang() {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY)
      setLangState(normalizeLang(stored))
    } catch {
      // noop
    }
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next)
    } catch {
      // noop
    }
  }, [])

  const toggle = useCallback(() => {
    setLangState((current) => {
      const next: Lang = current === 'en' ? 'es' : 'en'
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next)
      } catch {
        // noop
      }
      return next
    })
  }, [])

  return { lang, setLang, toggle }
}
