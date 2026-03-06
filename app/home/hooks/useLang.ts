'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Lang, LANG_STORAGE_KEY, normalizeLang } from '@/app/home/lib/i18n'

export function useLang() {
  const [lang, setLangState] = useState<Lang>('en')
  const router = useRouter()

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY)
      setLangState(normalizeLang(stored))
    } catch {
      // noop
    }
  }, [])

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next)
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next)
        document.cookie = `roi-lang=${next}; path=/; max-age=31536000; SameSite=Lax`
      } catch {
        // noop
      }
      router.refresh()
    },
    [router],
  )

  const toggle = useCallback(() => {
    setLangState((current) => {
      const next: Lang = current === 'en' ? 'es' : 'en'
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next)
        document.cookie = `roi-lang=${next}; path=/; max-age=31536000; SameSite=Lax`
      } catch {
        // noop
      }
      return next
    })
    router.refresh()
  }, [router])

  return { lang, setLang, toggle }
}
