import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { upsertGoogleDocsConnection } from '@/lib/db'
import { getAppBaseUrl } from '@/lib/notion'
import {
  exchangeGoogleAuthorizationCode,
  getGoogleUserProfile,
  verifyGoogleDocsOauthState,
} from '@/lib/google-docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function buildAppRedirect(status: string) {
  const url = new URL('/', getAppBaseUrl())
  url.searchParams.set('gdocs', status)
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
  const googleError = req.nextUrl.searchParams.get('error')

  if (googleError) {
    return NextResponse.redirect(buildAppRedirect('connect_denied'))
  }

  if (!code || !state || !verifyGoogleDocsOauthState(state, user.id)) {
    return NextResponse.redirect(buildAppRedirect('invalid_state'))
  }

  try {
    const oauth = await exchangeGoogleAuthorizationCode(code)
    const profile = await getGoogleUserProfile(oauth.access_token).catch(() => null)

    await upsertGoogleDocsConnection({
      userId: user.id,
      accessToken: oauth.access_token,
      refreshToken: normalizeNullableString(oauth.refresh_token),
      tokenExpiresAt: normalizeNullableString(oauth.token_expires_at),
      scope: normalizeNullableString(oauth.scope),
      googleUserId: normalizeNullableString(profile?.id),
      userEmail: normalizeNullableString(profile?.email),
    })

    return NextResponse.redirect(buildAppRedirect('connected'))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[ActionExtractor] google docs callback error:', message)
    return NextResponse.redirect(buildAppRedirect('error'))
  }
}
