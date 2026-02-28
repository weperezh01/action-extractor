export type SourceType = 'youtube' | 'web_url' | 'text'

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
  /youtube\.com\/embed\/([^&\n?#]+)/,
  /youtube\.com\/v\/([^&\n?#]+)/,
]

function isYoutubeUrl(input: string): boolean {
  return YOUTUBE_PATTERNS.some((pattern) => pattern.test(input))
}

function isHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input)
}

export function detectSourceType(input: string): SourceType {
  const trimmed = input.trim()
  if (!trimmed) return 'text'
  if (isYoutubeUrl(trimmed)) return 'youtube'
  if (isHttpUrl(trimmed)) return 'web_url'
  return 'text'
}

/**
 * Extracts the YouTube playlist ID (list parameter) from a URL.
 * Works for:
 *   https://youtube.com/playlist?list=PLxxxx
 *   https://youtube.com/watch?v=xxx&list=PLxxxx
 */
export function extractPlaylistId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (!u.hostname.includes('youtube.com') && !u.hostname.includes('youtu.be')) return null
    return u.searchParams.get('list')
  } catch {
    return null
  }
}

export function isPlaylistUrl(url: string): boolean {
  return extractPlaylistId(url) !== null
}
