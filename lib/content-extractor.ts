import * as cheerio from 'cheerio'

const MAX_WEB_CHARS = 100_000
const MAX_AI_CHARS = 50_000

export interface ExtractedContent {
  text: string
  title: string | null
  charCount: number
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
    const res = await fetch(url, {
      signal: controller.signal,
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
    if (!res.ok) {
      if (res.status === 403 || res.status === 418 || res.status === 429) {
        throw new Error(
          'El servidor bloqueó el acceso automático a esta página. Copia el texto de la página manualmente y pégalo en el campo de texto.'
        )
      }
      throw new Error(`No se pudo acceder a la página (error ${res.status}). Verifica que la URL sea correcta y pública.`)
    }
    html = await res.text()
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
  // pdf-parse is CommonJS only, use require
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (
    buf: Buffer
  ) => Promise<{ text: string; info?: { Title?: string } }>
  const data = await pdfParse(buffer)
  const text = (data.text ?? '').replace(/\s{3,}/g, '\n\n').trim()
  const titleFromMeta = data.info?.Title?.trim() ?? null
  return { text, title: titleFromMeta || filename, charCount: text.length }
}

export async function extractDocxContent(
  buffer: Buffer,
  filename: string
): Promise<ExtractedContent> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
  }
  const result = await mammoth.extractRawText({ buffer })
  const text = (result.value ?? '').replace(/\s{3,}/g, '\n\n').trim()
  return { text, title: filename, charCount: text.length }
}
