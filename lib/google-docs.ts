import {
  BuildExportContentInput,
  buildExtractionMarkdown,
  buildExportTitle,
} from '@/lib/export-content'
import {
  createNotionOauthState,
  getAppBaseUrl,
  verifyNotionOauthState,
} from '@/lib/notion'

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
const GOOGLE_DOCS_BASE_URL = 'https://docs.googleapis.com/v1'

const GOOGLE_DOCS_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
]

export interface GoogleOAuthTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

export interface GoogleOAuthTokenResult extends GoogleOAuthTokenResponse {
  token_expires_at: string | null
}

export interface GoogleUserProfile {
  id?: string
  email?: string
  verified_email?: boolean
}

export interface CreateGoogleDocInput extends BuildExportContentInput {
  accessToken: string
}

export class GoogleDocsApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'GoogleDocsApiError'
    this.status = status
    this.details = details
  }
}

function getGoogleClientId() {
  return (process.env.GOOGLE_CLIENT_ID || '').trim()
}

function getGoogleClientSecret() {
  return (process.env.GOOGLE_CLIENT_SECRET || '').trim()
}

export function getGoogleDocsRedirectUri() {
  const custom = (process.env.GOOGLE_DOCS_REDIRECT_URI || '').trim()
  if (custom) return custom
  return `${getAppBaseUrl()}/api/google-docs/callback`
}

export function isGoogleDocsOAuthConfigured() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret())
}

export function createGoogleDocsOauthState(userId: string) {
  return `google_docs.${createNotionOauthState(userId)}`
}

export function verifyGoogleDocsOauthState(state: string, userId: string) {
  if (!state.startsWith('google_docs.')) return false
  const raw = state.slice('google_docs.'.length)
  return verifyNotionOauthState(raw, userId)
}

export function buildGoogleDocsAuthorizeUrl(state: string) {
  const clientId = getGoogleClientId()
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID no está configurado.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleDocsRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    scope: GOOGLE_DOCS_SCOPES.join(' '),
    state,
  })

  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`
}

async function parseResponseJson(response: Response) {
  return (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null
}

function computeTokenExpiresAt(expiresIn?: number) {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null
  const expiresAtMs = Date.now() + Math.max(0, expiresIn - 30) * 1000
  return new Date(expiresAtMs).toISOString()
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const clientId = getGoogleClientId()
  const clientSecret = getGoogleClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Integración con Google Docs no configurada.')
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getGoogleDocsRedirectUri(),
    grant_type: 'authorization_code',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  })

  const payload = (await parseResponseJson(response)) as
    | GoogleOAuthTokenResponse
    | { error?: unknown; error_description?: unknown }
    | null

  if (!response.ok) {
    const errorPayload = payload as { error_description?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.error_description === 'string'
        ? errorPayload.error_description
        : 'No se pudo completar la autorización con Google.'
    throw new GoogleDocsApiError(message, response.status, payload)
  }

  const tokenPayload = payload as GoogleOAuthTokenResponse | null
  if (!tokenPayload || typeof tokenPayload.access_token !== 'string') {
    throw new GoogleDocsApiError('Respuesta inválida de Google al autorizar.', 502, payload)
  }

  return {
    access_token: tokenPayload.access_token,
    token_type: tokenPayload.token_type,
    expires_in: tokenPayload.expires_in,
    refresh_token: tokenPayload.refresh_token,
    scope: tokenPayload.scope,
    token_expires_at: computeTokenExpiresAt(tokenPayload.expires_in),
  }
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = getGoogleClientId()
  const clientSecret = getGoogleClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Integración con Google Docs no configurada.')
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  })

  const payload = (await parseResponseJson(response)) as
    | GoogleOAuthTokenResponse
    | { error?: unknown; error_description?: unknown }
    | null

  if (!response.ok) {
    const errorPayload = payload as { error_description?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.error_description === 'string'
        ? errorPayload.error_description
        : 'No se pudo refrescar el token de Google.'
    throw new GoogleDocsApiError(message, response.status, payload)
  }

  const tokenPayload = payload as GoogleOAuthTokenResponse | null
  if (!tokenPayload || typeof tokenPayload.access_token !== 'string') {
    throw new GoogleDocsApiError('Respuesta inválida al refrescar token de Google.', 502, payload)
  }

  return {
    access_token: tokenPayload.access_token,
    token_type: tokenPayload.token_type,
    expires_in: tokenPayload.expires_in,
    refresh_token: tokenPayload.refresh_token,
    scope: tokenPayload.scope,
    token_expires_at: computeTokenExpiresAt(tokenPayload.expires_in),
  }
}

export async function getGoogleUserProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  const payload = (await parseResponseJson(response)) as GoogleUserProfile | null
  if (!response.ok) {
    const errorPayload = payload as { error?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.error === 'string'
        ? errorPayload.error
        : 'No se pudo obtener perfil del usuario de Google.'
    throw new GoogleDocsApiError(message, response.status, payload)
  }

  return payload
}

export async function createGoogleDocFromExtraction(input: CreateGoogleDocInput) {
  const title = buildExportTitle(input).slice(0, 120)
  const content = `${buildExtractionMarkdown(input)}\n`

  const createResponse = await fetch(`${GOOGLE_DOCS_BASE_URL}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
    }),
    cache: 'no-store',
  })

  const createPayload = (await parseResponseJson(createResponse)) as
    | { documentId?: unknown; title?: unknown; error?: unknown }
    | null

  if (!createResponse.ok) {
    const message =
      createPayload &&
      typeof createPayload === 'object' &&
      typeof createPayload.error === 'object'
        ? 'Google rechazó la creación del documento.'
        : 'No se pudo crear el documento en Google Docs.'
    throw new GoogleDocsApiError(message, createResponse.status, createPayload)
  }

  const documentId =
    createPayload && typeof createPayload.documentId === 'string'
      ? createPayload.documentId
      : null
  if (!documentId) {
    throw new GoogleDocsApiError('Google Docs devolvió una respuesta incompleta al crear documento.', 502, createPayload)
  }

  const updateResponse = await fetch(`${GOOGLE_DOCS_BASE_URL}/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    }),
    cache: 'no-store',
  })

  const updatePayload = await parseResponseJson(updateResponse)
  if (!updateResponse.ok) {
    throw new GoogleDocsApiError(
      'El documento se creó pero no se pudo insertar el contenido.',
      updateResponse.status,
      updatePayload
    )
  }

  return {
    documentId,
    documentUrl: `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit`,
  }
}
