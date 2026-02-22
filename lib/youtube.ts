const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/i,
  /youtube\.com\/embed\/([^&\n?#]+)/i,
  /youtube\.com\/v\/([^&\n?#]+)/i,
]

export function extractYoutubeVideoId(url: string): string | null {
  const trimmedUrl = url.trim()
  if (!trimmedUrl) return null

  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = trimmedUrl.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

export function buildYoutubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`
}
