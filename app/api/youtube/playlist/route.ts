import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { extractPlaylistId } from '@/lib/source-detector'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_VIDEOS = 20

interface YtSnippet {
  title?: string
  resourceId?: { videoId?: string }
  thumbnails?: { default?: { url?: string }; medium?: { url?: string } }
  position?: number
  videoOwnerChannelTitle?: string
  description?: string
}

interface YtPlaylistItem {
  snippet?: YtSnippet
}

interface YtPlaylistResponse {
  items?: Array<{ snippet?: { title?: string; channelTitle?: string; description?: string } }>
}

interface YtPlaylistItemsResponse {
  items?: YtPlaylistItem[]
  pageInfo?: { totalResults?: number }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`YouTube API error ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YOUTUBE_API_KEY no está configurada. Agrégala en docker-compose.yaml.' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const playlistUrl =
    typeof (body as { playlistUrl?: unknown }).playlistUrl === 'string'
      ? (body as { playlistUrl: string }).playlistUrl.trim()
      : ''

  if (!playlistUrl) {
    return NextResponse.json({ error: 'playlistUrl es requerido.' }, { status: 400 })
  }

  const playlistId = extractPlaylistId(playlistUrl)
  if (!playlistId) {
    return NextResponse.json(
      { error: 'No se pudo extraer el ID de la playlist de la URL proporcionada.' },
      { status: 400 }
    )
  }

  try {
    const base = 'https://www.googleapis.com/youtube/v3'

    // Fetch playlist metadata + items in parallel
    const [playlistData, itemsData] = await Promise.all([
      fetchJson<YtPlaylistResponse>(
        `${base}/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${apiKey}`
      ),
      fetchJson<YtPlaylistItemsResponse>(
        `${base}/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=${MAX_VIDEOS}&key=${apiKey}`
      ),
    ])

    const playlistSnippet = playlistData.items?.[0]?.snippet
    if (!playlistSnippet) {
      return NextResponse.json(
        { error: 'No se encontró la playlist. Verifica que sea pública.' },
        { status: 404 }
      )
    }

    const title = playlistSnippet.title ?? 'Playlist sin título'
    const totalResults = itemsData.pageInfo?.totalResults ?? 0

    const videos = (itemsData.items ?? [])
      .filter((item) => {
        const videoId = item.snippet?.resourceId?.videoId
        return typeof videoId === 'string' && videoId.trim().length > 0
      })
      .map((item, index) => {
        const videoId = item.snippet!.resourceId!.videoId!
        return {
          videoId,
          title: item.snippet?.title ?? `Video ${index + 1}`,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnailUrl:
            item.snippet?.thumbnails?.medium?.url ??
            item.snippet?.thumbnails?.default?.url ??
            null,
          position: typeof item.snippet?.position === 'number' ? item.snippet.position : index,
        }
      })

    return NextResponse.json({
      playlistId,
      title,
      videoCount: totalResults,
      videos,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al consultar la API de YouTube.'
    console.error('[youtube/playlist]', message)

    if (message.includes('403')) {
      return NextResponse.json(
        { error: 'API key de YouTube inválida o sin permisos. Verifica YOUTUBE_API_KEY.' },
        { status: 502 }
      )
    }
    if (message.includes('quotaExceeded')) {
      return NextResponse.json(
        { error: 'Cuota de YouTube API agotada. Intenta mañana.' },
        { status: 429 }
      )
    }

    return NextResponse.json({ error: 'No se pudo cargar la playlist.' }, { status: 500 })
  }
}
