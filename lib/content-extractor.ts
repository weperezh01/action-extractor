import dns from 'node:dns/promises'
import net from 'node:net'
import * as cheerio from 'cheerio'

export const MAX_WEB_CHARS = 100_000
export const MAX_AI_CHARS = 50_000
const MAX_REDIRECTS = 5
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export interface ExtractedContent {
  text: string
  title: string | null
  charCount: number
}

function normalizeHostname(hostname: string) {
  return hostname.trim().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '').toLowerCase()
}

function ipv4ToInt(ip: string) {
  return ip
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .reduce((acc, part) => (acc << 8) + part, 0) >>> 0
}

function isIpv4InRange(ip: string, cidrBase: string, prefixLength: number) {
  const ipValue = ipv4ToInt(ip)
  const baseValue = ipv4ToInt(cidrBase)
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0
  return (ipValue & mask) === (baseValue & mask)
}

function normalizeIpAddress(address: string) {
  const trimmed = address.trim()
  const withoutZone = trimmed.includes('%') ? trimmed.slice(0, trimmed.indexOf('%')) : trimmed
  const lowerCased = withoutZone.toLowerCase()
  if (lowerCased.startsWith('::ffff:')) {
    const mappedIpv4 = lowerCased.slice('::ffff:'.length)
    if (net.isIP(mappedIpv4) === 4) {
      return mappedIpv4
    }
  }
  return lowerCased
}

function isBlockedIpv4(address: string) {
  return (
    isIpv4InRange(address, '0.0.0.0', 8) ||
    isIpv4InRange(address, '10.0.0.0', 8) ||
    isIpv4InRange(address, '100.64.0.0', 10) ||
    isIpv4InRange(address, '127.0.0.0', 8) ||
    isIpv4InRange(address, '169.254.0.0', 16) ||
    isIpv4InRange(address, '172.16.0.0', 12) ||
    isIpv4InRange(address, '192.0.0.0', 24) ||
    isIpv4InRange(address, '192.0.2.0', 24) ||
    isIpv4InRange(address, '192.168.0.0', 16) ||
    isIpv4InRange(address, '198.18.0.0', 15) ||
    isIpv4InRange(address, '198.51.100.0', 24) ||
    isIpv4InRange(address, '203.0.113.0', 24) ||
    isIpv4InRange(address, '224.0.0.0', 4) ||
    isIpv4InRange(address, '240.0.0.0', 4)
  )
}

function isBlockedIpv6(address: string) {
  return (
    address === '::' ||
    address === '::1' ||
    address.startsWith('fc') ||
    address.startsWith('fd') ||
    /^fe[89ab]/i.test(address) ||
    address.startsWith('ff')
  )
}

function isBlockedHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  )
}

export async function assertSafeWebFetchUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('La URL no es válida.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Solo se permiten URLs http o https.')
  }

  if (parsed.username || parsed.password) {
    throw new Error('La URL no puede incluir credenciales.')
  }

  const hostname = normalizeHostname(parsed.hostname)
  if (!hostname || isBlockedHostname(hostname)) {
    throw new Error('La URL apunta a un destino interno o no permitido.')
  }

  const literalIpVersion = net.isIP(hostname)
  if (literalIpVersion === 4) {
    if (isBlockedIpv4(hostname)) {
      throw new Error('La URL apunta a una IP privada o no permitida.')
    }
    return parsed
  }
  if (literalIpVersion === 6) {
    const normalizedAddress = normalizeIpAddress(hostname)
    if (isBlockedIpv6(normalizedAddress)) {
      throw new Error('La URL apunta a una IP privada o no permitida.')
    }
    return parsed
  }

  let resolvedAddresses: Array<{ address: string; family: number }>
  try {
    resolvedAddresses = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('No se pudo resolver el host de la URL.')
  }

  if (resolvedAddresses.length === 0) {
    throw new Error('No se pudo resolver el host de la URL.')
  }

  for (const resolved of resolvedAddresses) {
    const normalizedAddress = normalizeIpAddress(resolved.address)
    if (
      (resolved.family === 4 && isBlockedIpv4(normalizedAddress)) ||
      (resolved.family === 6 && isBlockedIpv6(normalizedAddress))
    ) {
      throw new Error('La URL apunta a un destino interno o no permitido.')
    }
  }

  return parsed
}

async function fetchHtmlWithRedirectValidation(url: string, signal: AbortSignal, redirectsRemaining = MAX_REDIRECTS) {
  const safeUrl = await assertSafeWebFetchUrl(url)
  const res = await fetch(safeUrl, {
    signal,
    redirect: 'manual',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    },
  })

  if (REDIRECT_STATUSES.has(res.status)) {
    const location = res.headers.get('location')
    if (!location) {
      throw new Error('La página respondió con una redirección inválida.')
    }
    if (redirectsRemaining <= 0) {
      throw new Error('La página generó demasiadas redirecciones.')
    }
    const nextUrl = new URL(location, safeUrl).toString()
    return fetchHtmlWithRedirectValidation(nextUrl, signal, redirectsRemaining - 1)
  }

  if (!res.ok) {
    if (res.status === 403 || res.status === 418 || res.status === 429) {
      throw new Error(
        'El servidor bloqueó el acceso automático a esta página. Copia el texto de la página manualmente y pégalo en el campo de texto.'
      )
    }
    throw new Error(`No se pudo acceder a la página (error ${res.status}). Verifica que la URL sea correcta y pública.`)
  }

  return res.text()
}

export function truncateForAi(text: string): { finalText: string; truncated: boolean } {
  const trimmed = text.trim()
  if (trimmed.length <= MAX_AI_CHARS) {
    return { finalText: trimmed, truncated: false }
  }
  return {
    finalText: `${trimmed.slice(0, MAX_AI_CHARS)}\n[Contenido truncado]`,
    truncated: true,
  }
}

export async function extractWebContent(url: string): Promise<ExtractedContent> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  let html: string
  try {
    html = await fetchHtmlWithRedirectValidation(url, controller.signal)
  } finally {
    clearTimeout(timeout)
  }

  const $ = cheerio.load(html)

  // Remove noise elements
  $('script, style, nav, footer, aside, header, noscript, iframe, svg').remove()

  // Extract title
  const title =
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    null

  // Prefer semantic content containers
  let container = $('article').first()
  if (!container.length) container = $('main').first()
  if (!container.length) container = $('body')

  let text = container.text()

  // Normalize whitespace
  text = text.replace(/\s{3,}/g, '\n\n').trim()

  // Hard cap
  if (text.length > MAX_WEB_CHARS) {
    text = text.slice(0, MAX_WEB_CHARS)
  }

  return { text, title, charCount: text.length }
}

export async function extractPdfContent(
  buffer: Buffer,
  filename: string
): Promise<ExtractedContent> {
  // pdf-parse v2 expects binary input in the `data` field.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require('pdf-parse') as {
    PDFParse: new (opts: { data: Buffer | Uint8Array }) => {
      getText(): Promise<{ text: string }>
      destroy(): Promise<void>
    }
  }
  const parser = new PDFParse({ data: buffer })

  try {
    const data = await parser.getText()
    const text = (data.text ?? '').replace(/\s{3,}/g, '\n\n').trim()
    return { text, title: filename, charCount: text.length }
  } finally {
    await parser.destroy().catch(() => {
      // noop: freeing parser resources is best-effort
    })
  }
}

export async function extractDocxContent(
  buffer: Buffer,
  filename: string
): Promise<ExtractedContent> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammothModule = require('mammoth')
  const mammoth = (mammothModule.default ?? mammothModule) as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
  }
  const result = await mammoth.extractRawText({ buffer })
  const text = (result.value ?? '').replace(/\s{3,}/g, '\n\n').trim()
  return { text, title: filename, charCount: text.length }
}
