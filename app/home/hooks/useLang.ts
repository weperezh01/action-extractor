'use client'

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { type Lang, LANG_STORAGE_KEY, normalizeLang } from '@/app/home/lib/i18n'

const LANG_CHANGE_EVENT = 'roi-lang-change'

type LangContextValue = {
  lang: Lang
  setLang: (next: Lang) => void
  toggle: () => void
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => undefined,
  toggle: () => undefined,
})

function readCookieLang(): Lang | null {
  if (typeof document === 'undefined') return null
  const cookieValue = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LANG_STORAGE_KEY}=`))
    ?.split('=')
    .slice(1)
    .join('=')

  if (!cookieValue) return null
  return normalizeLang(cookieValue)
}

function readDocumentLang(): Lang | null {
  if (typeof document === 'undefined') return null
  const lang = document.documentElement.lang
  if (!lang) return null
  return normalizeLang(lang)
}

function readStoredLang(): Lang | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY)
    if (!raw) return null
    return normalizeLang(raw)
  } catch {
    return null
  }
}

function readCanonicalLang(fallback: Lang): Lang {
  return readCookieLang() ?? readDocumentLang() ?? readStoredLang() ?? fallback
}

function persistLang(next: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, next)
    document.cookie = `roi-lang=${next}; path=/; max-age=31536000; SameSite=Lax`
    document.documentElement.lang = next
    window.dispatchEvent(new Event(LANG_CHANGE_EVENT))
  } catch {
    // noop
  }
}

function refreshLocale() {
  window.setTimeout(() => {
    window.location.reload()
  }, 0)
}

export function LangProvider({
  initialLang,
  children,
}: {
  initialLang: Lang
  children: ReactNode
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    const syncLang = () => setLangState((current) => readCanonicalLang(current))
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== LANG_STORAGE_KEY) return
      syncLang()
    }

    syncLang()
    window.addEventListener('storage', handleStorage)
    window.addEventListener(LANG_CHANGE_EVENT, syncLang)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(LANG_CHANGE_EVENT, syncLang)
    }
  }, [])

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next)
      persistLang(next)
      refreshLocale()
    },
    [],
  )

  const toggle = useCallback(() => {
    const current = readCanonicalLang(lang)
    const next: Lang = current === 'en' ? 'es' : 'en'
    setLangState(next)
    persistLang(next)
    refreshLocale()
  }, [lang])

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, toggle }),
    [lang, setLang, toggle],
  )

  return createElement(LangContext.Provider, { value }, children)
}

export function useLang() {
  return useContext(LangContext)
}
