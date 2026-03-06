export type Locale = 'en' | 'es'

interface CookieStore {
  get(name: string): { value: string } | undefined
}

export function getLocale(cookieStore: CookieStore): Locale {
  const lang = cookieStore.get('roi-lang')?.value
  return lang === 'es' ? 'es' : 'en'
}
