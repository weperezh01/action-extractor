import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CloudinaryParsed {
  cloudName: string
  resourceType: string
  version: string | null
  publicId: string // WITHOUT format extension
  format: string
}

function parseCloudinaryDeliveryUrl(rawUrl: string): CloudinaryParsed | null {
  try {
    const url = new URL(rawUrl)
    if (url.hostname !== 'res.cloudinary.com') return null

    const segments = url.pathname.replace(/^\//, '').split('/')
    if (segments.length < 4) return null

    const [cloudName, resourceType, uploadKeyword, ...rest] = segments
    if (uploadKeyword !== 'upload') return null

    // Drop existing signature segment (s--xxx--)
    const remaining = rest.filter((s) => !s.startsWith('s--'))

    let version: string | null = null
    let payload = remaining
    if (payload[0]?.match(/^v\d+$/)) {
      version = payload[0].slice(1)
      payload = payload.slice(1)
    }

    if (payload.length === 0) return null

    const lastSegment = payload[payload.length - 1]
    const dotIdx = lastSegment.lastIndexOf('.')
    if (dotIdx === -1) return null

    const filename = lastSegment.slice(0, dotIdx)
    const format = lastSegment.slice(dotIdx + 1)
    const publicId = [...payload.slice(0, -1), filename].join('/')

    return { cloudName, resourceType, version, publicId, format }
  } catch {
    return null
  }
}

/**
 * Cloudinary URL signing:
 *   toSign = [transformation, v{version}, `${publicId}.${format}`].filter(Boolean).join('/')
 *   signature = SHA-1(toSign + apiSecret) → raw digest → base64url → first 8 chars
 *   (Cloudinary signed delivery requires the format in the string-to-sign).
 */
function buildSignedCloudinaryUrl(options: {
  apiSecret: string
  parsed: CloudinaryParsed
  transformation?: string
}): string {
  const { apiSecret, parsed, transformation = '' } = options
  const { cloudName, resourceType, version, publicId, format } = parsed

  const parts: string[] = []
  if (transformation) parts.push(transformation)
  if (version) parts.push(`v${version}`)
  parts.push(`${publicId}.${format}`)
  const toSign = parts.join('/')

  const rawDigest = createHash('sha1').update(toSign + apiSecret).digest()
  const signature = rawDigest
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .slice(0, 8)

  const urlParts: string[] = [
    `https://res.cloudinary.com/${cloudName}/${resourceType}/upload`,
    `s--${signature}--`,
    ...(transformation ? [transformation] : []),
    ...(version ? [`v${version}`] : []),
    `${publicId}.${format}`,
  ]

  return urlParts.join('/')
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')
  if (!rawUrl) {
    return NextResponse.json({ error: 'Falta el parámetro url.' }, { status: 400 })
  }

  const parsed = parseCloudinaryDeliveryUrl(rawUrl)
  if (!parsed) {
    return NextResponse.json({ error: 'URL de Cloudinary inválida.' }, { status: 400 })
  }

  // Only allow our own cloud name
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME ?? '').trim()
  if (cloudName && parsed.cloudName !== cloudName) {
    return NextResponse.json({ error: 'URL no permitida.' }, { status: 403 })
  }

  // Only allow PDF files
  if (parsed.format.toLowerCase() !== 'pdf') {
    return NextResponse.json({ error: 'Solo se permiten archivos PDF.' }, { status: 400 })
  }

  const apiSecret = (process.env.CLOUDINARY_API_SECRET ?? '').trim()
  if (!apiSecret) {
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 500 })
  }

  // Generate signed URL (no transformation — we set Content-Disposition ourselves)
  const signedUrl = buildSignedCloudinaryUrl({ apiSecret, parsed })
  const toSign = [parsed.version ? `v${parsed.version}` : '', `${parsed.publicId}.${parsed.format}`]
    .filter(Boolean)
    .join('/')

  // Debug mode: return signed URL + server-side fetch result without streaming
  const isDebug = req.nextUrl.searchParams.get('debug') === '1'
  if (isDebug) {
    let fetchStatus: number | string = 'error'
    let fetchContentType = ''
    let fetchCldError = ''
    try {
      const r = await fetch(signedUrl, { cache: 'no-store', headers: { Accept: 'application/pdf,*/*' } })
      fetchStatus = r.status
      fetchContentType = r.headers.get('content-type') ?? ''
      fetchCldError = r.headers.get('x-cld-error') ?? ''
    } catch (e) {
      fetchStatus = `fetch_threw: ${e instanceof Error ? e.message : String(e)}`
    }
    return NextResponse.json({ signedUrl, toSign, fetchStatus, fetchContentType, fetchCldError, parsed })
  }

  // Fetch the PDF from Cloudinary using the signed URL
  let upstream: Response
  try {
    upstream = await fetch(signedUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/pdf,*/*' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pdf-proxy] fetch error:', msg)
    return NextResponse.json({ error: 'No se pudo obtener el PDF.' }, { status: 502 })
  }

  if (!upstream.ok) {
    const cldError = upstream.headers.get('x-cld-error') ?? ''
    const contentType = upstream.headers.get('content-type') ?? ''
    let bodySnippet = ''
    if (contentType.includes('json') || contentType.startsWith('text/') || contentType.includes('xml')) {
      bodySnippet = (await upstream.text().catch(() => '')).slice(0, 300)
    }

    console.error('[pdf-proxy] upstream status:', upstream.status, cldError || bodySnippet)

    if (upstream.status === 401) {
      return NextResponse.json(
        {
          error: 'Cloudinary bloqueó la entrega del PDF (401).',
          detail: cldError || bodySnippet || null,
          hint: 'Habilita "PDF and ZIP files delivery" en Cloudinary Console > Security para este Product Environment.',
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: `Cloudinary devolvió ${upstream.status}`, detail: cldError || bodySnippet || null },
      { status: upstream.status }
    )
  }

  const buffer = await upstream.arrayBuffer()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
