const OEMBED_ENDPOINT = 'https://www.youtube.com/oembed'
const OEMBED_TIMEOUT_MS = 4_500

export interface VideoPreview {
  videoTitle: string | null
  thumbnailUrl: string
}

export function buildYoutubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export async function fetchYoutubeVideoTitle(videoId: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS)

  try {
    const url = new URL(OEMBED_ENDPOINT)
    url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`)
    url.searchParams.set('format', 'json')

    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as { title?: unknown }
    if (typeof payload.title !== 'string') {
      return null
    }

    const trimmed = payload.title.trim()
    return trimmed ? trimmed : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function resolveVideoPreview(input: {
  videoId: string
  titleHint?: string | null
  thumbnailHint?: string | null
}): Promise<VideoPreview> {
  const hintedTitle = typeof input.titleHint === 'string' ? input.titleHint.trim() : ''
  const hintedThumbnail = typeof input.thumbnailHint === 'string' ? input.thumbnailHint.trim() : ''

  const videoTitle = hintedTitle || (await fetchYoutubeVideoTitle(input.videoId))
  const thumbnailUrl = hintedThumbnail || buildYoutubeThumbnailUrl(input.videoId)

  return {
    videoTitle: videoTitle || null,
    thumbnailUrl,
  }
}
