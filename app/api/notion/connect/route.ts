import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  buildNotionAuthorizeUrl,
  createNotionOauthState,
  getAppBaseUrl,
  isNotionOAuthConfigured,
} from '@/lib/notion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildAppRedirect(status: string) {
  const url = new URL('/', getAppBaseUrl())
  url.searchParams.set('notion', status)
  return url
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.redirect(buildAppRedirect('auth_required'))
  }

  if (!isNotionOAuthConfigured()) {
    return NextResponse.redirect(buildAppRedirect('not_configured'))
  }

  const state = createNotionOauthState(user.id)
  const authorizeUrl = buildNotionAuthorizeUrl(state)
  return NextResponse.redirect(authorizeUrl)
}
