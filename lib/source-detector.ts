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
