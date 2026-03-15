import type { Lang } from '@/app/home/lib/i18n'

export type LegalPageKey = 'privacy' | 'terms'
export type LegalPageLang = Lang

export function getLegalPagePath(lang: LegalPageLang, page: LegalPageKey) {
  const prefix = lang === 'es' ? '/es' : ''
  return `${prefix}${page === 'privacy' ? '/privacy-policy' : '/terms-of-use'}`
}

