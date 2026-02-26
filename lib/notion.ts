import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { flattenItemsAsText, type PlaybookNode } from '@/lib/playbook-tree'

const NOTION_API_BASE_URL = 'https://api.notion.com/v1'
const NOTION_API_VERSION = '2022-06-28'
const DEFAULT_APP_URL = 'https://roi.welltechnologies.net'
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

const DEV_FALLBACK_SESSION_SECRET = 'action-extractor-dev-only-secret'

export interface NotionOAuthTokenResponse {
  access_token: string
  workspace_id?: string
  workspace_name?: string
  workspace_icon?: string
  bot_id?: string
  owner?: {
    type?: string
    user?: { id?: string }
  }
}

export interface NotionPhase {
  id: number
  title: string
  items: PlaybookNode[]
}

export interface NotionMetadata {
  difficulty: string
  readingTime: string
  originalTime: string
  savedTime: string
}

export interface CreateNotionPageInput {
  accessToken: string
  extractionMode: string
  objective: string
  phases: NotionPhase[]
  proTip: string
  metadata: NotionMetadata
  videoTitle: string | null
  videoUrl: string
  parentPageId?: string | null
}

export class NotionApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'NotionApiError'
    this.status = status
    this.details = details
  }
}

function clipText(text: string, max = 1900) {
  const clean = text.trim()
  if (!clean) return '-'
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

export function getAppBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.ACTION_EXTRACTOR_APP_URL || DEFAULT_APP_URL
  return raw.replace(/\/+$/, '')
}

function getNotionClientId() {
  return (process.env.NOTION_CLIENT_ID || '').trim()
}

function getNotionClientSecret() {
  return (process.env.NOTION_CLIENT_SECRET || '').trim()
}

function getSessionSecret() {
  const configured = process.env.ACTION_EXTRACTOR_SESSION_SECRET
  if (configured && configured.trim().length >= 16) {
    return configured
  }
  return DEV_FALLBACK_SESSION_SECRET
}

export function getNotionRedirectUri() {
  const custom = (process.env.NOTION_REDIRECT_URI || '').trim()
  if (custom) return custom
  return `${getAppBaseUrl()}/api/notion/callback`
}

export function isNotionOAuthConfigured() {
  return Boolean(getNotionClientId() && getNotionClientSecret())
}

function signOAuthState(userId: string, nonce: string, issuedAtMs: string) {
  const payload = `${userId}:${nonce}:${issuedAtMs}`
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

export function createNotionOauthState(userId: string) {
  const nonce = randomBytes(16).toString('hex')
  const issuedAtMs = `${Date.now()}`
  const signature = signOAuthState(userId, nonce, issuedAtMs)
  return `${nonce}.${issuedAtMs}.${signature}`
}

export function verifyNotionOauthState(state: string, userId: string) {
  const parts = state.split('.')
  if (parts.length !== 3) return false

  const [nonce, issuedAtMs, signature] = parts
  if (!nonce || !issuedAtMs || !signature) return false

  const issuedAt = Number(issuedAtMs)
  if (!Number.isFinite(issuedAt)) return false

  const age = Date.now() - issuedAt
  if (age < -30_000 || age > OAUTH_STATE_TTL_MS) return false

  const expected = signOAuthState(userId, nonce, issuedAtMs)
  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (providedBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

export function buildNotionAuthorizeUrl(state: string) {
  const clientId = getNotionClientId()
  const redirectUri = getNotionRedirectUri()
  if (!clientId) {
    throw new Error('NOTION_CLIENT_ID no está configurado.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    owner: 'user',
    redirect_uri: redirectUri,
    state,
  })

  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`
}

export function getNotionOwnerUserId(owner: NotionOAuthTokenResponse['owner']) {
  if (!owner || owner.type !== 'user') return null
  const id = owner.user?.id
  return typeof id === 'string' && id.trim() ? id : null
}

export async function exchangeNotionAuthorizationCode(code: string) {
  const clientId = getNotionClientId()
  const clientSecret = getNotionClientSecret()

  if (!clientId || !clientSecret) {
    throw new Error('Integración con Notion no configurada.')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch(`${NOTION_API_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getNotionRedirectUri(),
    }),
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as
    | NotionOAuthTokenResponse
    | { message?: unknown }
    | null

  if (!response.ok) {
    const payloadWithMessage = payload as { message?: unknown } | null
    const apiMessage =
      payloadWithMessage && typeof payloadWithMessage.message === 'string'
        ? payloadWithMessage.message
        : 'No se pudo completar la autorización con Notion.'
    throw new NotionApiError(apiMessage, response.status, payload)
  }

  if (!payload || typeof payload !== 'object' || typeof (payload as NotionOAuthTokenResponse).access_token !== 'string') {
    throw new NotionApiError('Respuesta inválida de Notion al autorizar.', 502, payload)
  }

  return payload as NotionOAuthTokenResponse
}

function buildNotionRichText(content: string, options?: { link?: string }) {
  const text = clipText(content)

  return [
    {
      type: 'text' as const,
      text: {
        content: text,
        ...(options?.link ? { link: { url: options.link } } : {}),
      },
    },
  ]
}

function buildNotionTitle(input: CreateNotionPageInput) {
  const modeLabel = getExtractionModeLabel(normalizeExtractionMode(input.extractionMode))
  const base = input.videoTitle?.trim() || input.objective.trim() || 'Extracción'
  return clipText(`${modeLabel} | ${base}`, 120)
}

function sanitizeParentPageId(value: string) {
  return value.trim().replace(/-/g, '')
}

export async function createNotionPageFromExtraction(input: CreateNotionPageInput) {
  const notionTitle = buildNotionTitle(input)

  const metadataLine = `Dificultad: ${input.metadata.difficulty} | Lectura: ${input.metadata.readingTime} | Tiempo ahorrado: ${input.metadata.savedTime}`

  const children: Array<Record<string, unknown>> = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: buildNotionRichText('Objetivo estratégico'),
      },
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: buildNotionRichText(input.objective),
      },
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: buildNotionRichText(metadataLine),
      },
    },
  ]

  for (const phase of input.phases) {
    children.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: buildNotionRichText(`${phase.id}. ${phase.title}`),
      },
    })

    for (const item of flattenItemsAsText(phase.items)) {
      children.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: buildNotionRichText(item),
          checked: false,
        },
      })
    }
  }

  children.push(
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: buildNotionRichText('Consejo Pro'),
      },
    },
    {
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: buildNotionRichText(input.proTip),
      },
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: buildNotionRichText(`Fuente: ${input.videoUrl}`, { link: input.videoUrl }),
      },
    }
  )

  const parentPageId = input.parentPageId?.trim() ? sanitizeParentPageId(input.parentPageId) : null

  const payload = {
    parent: parentPageId ? { page_id: parentPageId } : { workspace: true },
    icon: { emoji: '🧠' },
    properties: {
      title: {
        title: buildNotionRichText(notionTitle),
      },
    },
    children,
  }

  const response = await fetch(`${NOTION_API_BASE_URL}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const result = (await response.json().catch(() => null)) as
    | { id?: unknown; url?: unknown; message?: unknown }
    | null

  if (!response.ok) {
    const apiMessage =
      result && typeof result === 'object' && typeof result.message === 'string'
        ? result.message
        : 'No se pudo crear la página en Notion.'
    throw new NotionApiError(apiMessage, response.status, result)
  }

  const pageId = result && typeof result.id === 'string' ? result.id : null
  const pageUrl = result && typeof result.url === 'string' ? result.url : null

  if (!pageId || !pageUrl) {
    throw new NotionApiError('Notion devolvió una respuesta incompleta al crear la página.', 502, result)
  }

  return {
    pageId,
    pageUrl,
  }
}
