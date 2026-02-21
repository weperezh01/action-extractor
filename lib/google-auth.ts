import { randomBytes } from 'node:crypto'
import { getAppBaseUrl } from '@/lib/notion'

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const GOOGLE_AUTH_STATE_MAX_AGE_SECONDS = 10 * 60

interface GoogleOAuthTokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

export interface GoogleAuthUserProfile {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
}

function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || '').trim()
}

function getGoogleClientSecret() {
  return (process.env.GOOGLE_CLIENT_SECRET || '').trim()
}

function parseResponseJson(response: Response) {
  return response
    .json()
    .catch(() => null) as Promise<Record<string, unknown> | Array<Record<string, unknown>> | null>
}

export function isGoogleAuthConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret())
}

export function createGoogleAuthState() {
  return randomBytes(24).toString('base64url')
}

export function getGoogleAuthStateMaxAgeSeconds() {
  return GOOGLE_AUTH_STATE_MAX_AGE_SECONDS
}

export function getGoogleAuthRedirectUri() {
  const custom = (process.env.GOOGLE_AUTH_REDIRECT_URI || '').trim()
  if (custom) return custom
  return `${getAppBaseUrl()}/api/auth/google/callback`
}

export function buildGoogleAuthAuthorizeUrl(state: string) {
  const clientId = getGoogleClientId()
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID no está configurado.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleAuthRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  })

  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`
}

export async function exchangeGoogleAuthCode(code: string) {
  const clientId = getGoogleClientId()
  const clientSecret = getGoogleClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth no está configurado en el servidor.')
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getGoogleAuthRedirectUri(),
    grant_type: 'authorization_code',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  })

  const payload = (await parseResponseJson(response)) as GoogleOAuthTokenResponse | null
  if (!response.ok) {
    const message =
      payload && typeof payload.error_description === 'string'
        ? payload.error_description
        : 'No se pudo completar la autorización con Google.'
    throw new Error(message)
  }

  if (!payload || typeof payload.access_token !== 'string') {
    throw new Error('Google devolvió una respuesta inválida.')
  }

  return payload.access_token
}

export async function getGoogleAuthUserProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  const payload = (await parseResponseJson(response)) as GoogleAuthUserProfile | null
  if (!response.ok) {
    throw new Error('No se pudo obtener el perfil del usuario desde Google.')
  }

  return payload
}
