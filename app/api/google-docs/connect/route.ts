import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getAppBaseUrl } from '@/lib/notion'
import {
  buildGoogleDocsAuthorizeUrl,
  createGoogleDocsOauthState,
  isGoogleDocsOAuthConfigured,
} from '@/lib/google-docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildAppRedirect(status: string) {
  const url = new URL('/', getAppBaseUrl())
  url.searchParams.set('gdocs', status)
  return url
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.redirect(buildAppRedirect('auth_required'))
  }

  if (!isGoogleDocsOAuthConfigured()) {
    return NextResponse.redirect(buildAppRedirect('not_configured'))
  }

  const state = createGoogleDocsOauthState(user.id)
  const authorizeUrl = buildGoogleDocsAuthorizeUrl(state)
  return NextResponse.redirect(authorizeUrl)
}
