import { buildLegalHtmlResponse } from '@/lib/legal-pages'

export const dynamic = 'force-static'
export const revalidate = 86400

export function GET() {
  return buildLegalHtmlResponse('terms', 'es')
}
