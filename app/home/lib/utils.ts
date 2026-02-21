import type { ParsedSseEvent, Theme } from './types'

const THEME_STORAGE_KEY = 'actionextractor-theme'
const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/i,
  /youtube\.com\/embed\/([^&\n?#]+)/i,
  /youtube\.com\/v\/([^&\n?#]+)/i,
]

export function getThemeStorageKey() {
  return THEME_STORAGE_KEY
}

export function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }
  } catch {
    // noop
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function formatHistoryDate(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function parseSseFrame(frame: string): ParsedSseEvent | null {
  if (!frame.trim()) return null

  const lines = frame.split(/\r?\n/)
  let event = 'message'
  const dataLines: string[] = []

  for (const rawLine of lines) {
    if (rawLine.startsWith('event:')) {
      event = rawLine.slice(6).trim()
      continue
    }

    if (rawLine.startsWith('data:')) {
      dataLines.push(rawLine.slice(5).trimStart())
    }
  }

  return {
    event,
    data: dataLines.join('\n'),
  }
}

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

export function isYoutubeUrlValid(url: string) {
  return extractYoutubeVideoId(url) !== null
}
