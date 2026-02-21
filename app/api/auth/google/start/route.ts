import { NextRequest, NextResponse } from 'next/server'
import {
  buildGoogleAuthAuthorizeUrl,
  createGoogleAuthState,
  getGoogleAuthStateMaxAgeSeconds,
  isGoogleAuthConfigured,
} from '@/lib/google-auth'
import { getAppBaseUrl } from '@/lib/notion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GOOGLE_AUTH_STATE_COOKIE = 'ae_google_oauth_state'
const GOOGLE_AUTH_NEXT_COOKIE = 'ae_google_oauth_next'

function normalizeNextPath(rawNextPath: string | null) {
  if (!rawNextPath) return '/'
  const value = rawNextPath.trim()
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function buildAppRedirect(status: string, nextPath: string) {
  const url = new URL(nextPath, getAppBaseUrl())
  url.searchParams.set('auth', status)
  return url
}

export async function GET(req: NextRequest) {
  const nextPath = normalizeNextPath(req.nextUrl.searchParams.get('next'))
  if (!isGoogleAuthConfigured()) {
    return NextResponse.redirect(buildAppRedirect('google_not_configured', nextPath))
  }

  const state = createGoogleAuthState()
  const authorizeUrl = buildGoogleAuthAuthorizeUrl(state)
  const secure = process.env.NODE_ENV === 'production'
  const maxAge = getGoogleAuthStateMaxAgeSeconds()

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set({
    name: GOOGLE_AUTH_STATE_COOKIE,
    value: state,
    maxAge,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  })
  response.cookies.set({
    name: GOOGLE_AUTH_NEXT_COOKIE,
    value: nextPath,
    maxAge,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  })

  return response
}
