import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  buildTrelloAuthorizeUrl,
  createTrelloOauthState,
  isTrelloConfigured,
} from '@/lib/trello'
import { getAppBaseUrl } from '@/lib/notion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildAppRedirect(status: string) {
  const url = new URL('/', getAppBaseUrl())
  url.searchParams.set('trello', status)
  return url
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.redirect(buildAppRedirect('auth_required'))
  }

  if (!isTrelloConfigured()) {
    return NextResponse.redirect(buildAppRedirect('not_configured'))
  }

  const state = createTrelloOauthState(user.id)
  const authorizeUrl = buildTrelloAuthorizeUrl(state)
  return NextResponse.redirect(authorizeUrl)
}
