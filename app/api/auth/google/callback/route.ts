import { randomBytes, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  createSessionExpirationDate,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  setSessionCookie,
} from '@/lib/auth'
import {
  createSession,
  createUser,
  deleteEmailVerificationTokensByUserId,
  findUserByEmail,
  markUserEmailAsVerified,
} from '@/lib/db'
import {
  exchangeGoogleAuthCode,
  getGoogleAuthUserProfile,
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

function clearOAuthCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === 'production'

  response.cookies.set({
    name: GOOGLE_AUTH_STATE_COOKIE,
    value: '',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  })
  response.cookies.set({
    name: GOOGLE_AUTH_NEXT_COOKIE,
    value: '',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  })
}

function buildAppRedirect(status: string, nextPath: string) {
  const url = new URL(nextPath, getAppBaseUrl())
  url.searchParams.set('auth', status)
  return url
}

function safeEqual(expected: string, received: string) {
  if (!expected || !received) return false
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

function resolveDisplayName(nameFromGoogle: string | undefined, email: string) {
  const cleanedName = typeof nameFromGoogle === 'string' ? nameFromGoogle.trim() : ''
  if (cleanedName.length >= 2) return cleanedName

  const localPart = email.split('@')[0]?.trim()
  if (localPart && localPart.length >= 2) return localPart
  return 'Usuario'
}

export async function GET(req: NextRequest) {
  const nextPath = normalizeNextPath(req.cookies.get(GOOGLE_AUTH_NEXT_COOKIE)?.value ?? null)
  const code = req.nextUrl.searchParams.get('code')?.trim() ?? ''
  const state = req.nextUrl.searchParams.get('state')?.trim() ?? ''
  const oauthError = req.nextUrl.searchParams.get('error')
  const expectedState = req.cookies.get(GOOGLE_AUTH_STATE_COOKIE)?.value ?? ''

  if (!isGoogleAuthConfigured()) {
    const response = NextResponse.redirect(buildAppRedirect('google_not_configured', nextPath))
    clearOAuthCookies(response)
    return response
  }

  if (oauthError) {
    const response = NextResponse.redirect(buildAppRedirect('google_cancelled', nextPath))
    clearOAuthCookies(response)
    return response
  }

  if (!code || !safeEqual(expectedState, state)) {
    const response = NextResponse.redirect(buildAppRedirect('google_invalid_state', nextPath))
    clearOAuthCookies(response)
    return response
  }

  try {
    const accessToken = await exchangeGoogleAuthCode(code)
    const profile = await getGoogleAuthUserProfile(accessToken)
    const email = normalizeEmail(typeof profile?.email === 'string' ? profile.email : '')

    if (!email) {
      throw new Error('No se recibió un correo válido desde Google.')
    }

    if (profile?.email_verified === false) {
      throw new Error('Tu cuenta de Google no tiene correo verificado.')
    }

    let user = await findUserByEmail(email)
    if (!user) {
      const randomPassword = randomBytes(32).toString('hex')
      const passwordHash = await hashPassword(randomPassword)
      user = await createUser({
        name: resolveDisplayName(profile?.name, email),
        email,
        passwordHash,
        emailVerifiedAt: new Date(),
      })
    } else if (user.blocked_at) {
      throw new Error('Tu cuenta está bloqueada temporalmente.')
    } else if (!user.email_verified_at) {
      await markUserEmailAsVerified(user.id)
      await deleteEmailVerificationTokensByUserId(user.id)
    }

    const sessionToken = createSessionToken()
    const sessionTokenHash = hashSessionToken(sessionToken)
    const expiresAt = createSessionExpirationDate()
    await createSession({ userId: user.id, tokenHash: sessionTokenHash, expiresAt })

    const response = NextResponse.redirect(buildAppRedirect('google_success', nextPath))
    clearOAuthCookies(response)
    setSessionCookie(response, sessionToken, expiresAt)
    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado de OAuth con Google.'
    console.error('[auth/google/callback]', message)

    const status = message.toLowerCase().includes('bloquead') ? 'google_blocked' : 'google_error'
    const response = NextResponse.redirect(buildAppRedirect(status, nextPath))
    clearOAuthCookies(response)
    return response
  }
}
