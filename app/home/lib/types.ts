import type { ExtractionMode } from '@/lib/extraction-modes'

export type ShareVisibility = 'private' | 'public'

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
  orderNumber?: number
  shareVisibility?: ShareVisibility
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
  orderNumber: number
  shareVisibility: ShareVisibility
  url: string
  createdAt: string
}

export type InteractiveTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'
export type InteractiveTaskEventType = 'note' | 'pending_action' | 'blocker'
export type InteractiveTaskAttachmentType = 'pdf' | 'image' | 'audio' | 'youtube_link'
export type InteractiveTaskAttachmentStorageProvider = 'cloudinary' | 'external'

export interface InteractiveTaskEvent {
  id: string
  taskId: string
  eventType: InteractiveTaskEventType
  content: string
  metadataJson: string
  createdAt: string
}

export interface InteractiveTask {
  id: string
  extractionId: string
  phaseId: number
  phaseTitle: string
  itemIndex: number
  itemText: string
  checked: boolean
  status: InteractiveTaskStatus
  dueAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  events: InteractiveTaskEvent[]
}

export interface InteractiveTaskAttachment {
  id: string
  taskId: string
  extractionId: string
  attachmentType: InteractiveTaskAttachmentType
  storageProvider: InteractiveTaskAttachmentStorageProvider
  url: string
  thumbnailUrl: string | null
  title: string | null
  mimeType: string | null
  sizeBytes: number | null
  metadataJson: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface InteractiveTaskComment {
  id: string
  taskId: string
  extractionId: string
  userId: string
  userName: string | null
  userEmail: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface InteractiveTaskLikeSummary {
  taskId: string
  extractionId: string
  likesCount: number
  likedByMe: boolean
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
