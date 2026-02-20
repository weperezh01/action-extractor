import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  buildTodoistAuthorizeUrl,
  createTodoistOauthState,
  isTodoistOAuthConfigured,
} from '@/lib/todoist'
import { getAppBaseUrl } from '@/lib/notion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildAppRedirect(status: string) {
  const url = new URL('/', getAppBaseUrl())
  url.searchParams.set('todoist', status)
  return url
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.redirect(buildAppRedirect('auth_required'))
  }

  if (!isTodoistOAuthConfigured()) {
    return NextResponse.redirect(buildAppRedirect('not_configured'))
  }

  const state = createTodoistOauthState(user.id)
  const authorizeUrl = buildTodoistAuthorizeUrl(state)
  return NextResponse.redirect(authorizeUrl)
}
