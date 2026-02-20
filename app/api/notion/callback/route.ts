import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { upsertNotionConnection } from '@/lib/db'
import {
  exchangeNotionAuthorizationCode,
  getAppBaseUrl,
  getNotionOwnerUserId,
  verifyNotionOauthState,
} from '@/lib/notion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildAppRedirect(status: string) {
  const url = new URL('/', getAppBaseUrl())
  url.searchParams.set('notion', status)
  return url
}

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.redirect(buildAppRedirect('auth_required'))
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const notionError = req.nextUrl.searchParams.get('error')

  if (notionError) {
    return NextResponse.redirect(buildAppRedirect('connect_denied'))
  }

  if (!code || !state || !verifyNotionOauthState(state, user.id)) {
    return NextResponse.redirect(buildAppRedirect('invalid_state'))
  }

  try {
    const oauth = await exchangeNotionAuthorizationCode(code)

    await upsertNotionConnection({
      userId: user.id,
      accessToken: oauth.access_token,
      workspaceId: normalizeNullableString(oauth.workspace_id),
      workspaceName: normalizeNullableString(oauth.workspace_name),
      workspaceIcon: normalizeNullableString(oauth.workspace_icon),
      botId: normalizeNullableString(oauth.bot_id),
      ownerUserId: normalizeNullableString(getNotionOwnerUserId(oauth.owner)),
    })

    return NextResponse.redirect(buildAppRedirect('connected'))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[ActionExtractor] notion callback error:', message)
    return NextResponse.redirect(buildAppRedirect('error'))
  }
}
