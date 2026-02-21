import type { ExtractionMode } from '@/lib/extraction-modes'

export interface Phase {
  id: number
  title: string
  items: string[]
}

export interface ExtractMetadata {
  originalTime: string
  readingTime: string
  difficulty: string
  savedTime: string
}

export interface ExtractResult {
  id?: string
  createdAt?: string
  cached?: boolean
  url?: string
  videoId?: string | null
  videoTitle?: string | null
  thumbnailUrl?: string | null
  mode?: ExtractionMode
  objective: string
  phases: Phase[]
  proTip: string
  metadata: ExtractMetadata
}

export interface HistoryItem extends ExtractResult {
  id: string
  url: string
  createdAt: string
}

export interface SessionUser {
  id: string
  name: string
  email: string
}

export type AuthMode = 'login' | 'register' | 'forgot'
export type Theme = 'light' | 'dark'

export interface ParsedSseEvent {
  event: string
  data: string
}
