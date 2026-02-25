import type { ExtractionMode } from '@/lib/extraction-modes'

export type ShareVisibility = 'private' | 'circle' | 'unlisted' | 'public'
export type ExtractionAccessRole = 'owner' | 'editor' | 'viewer'

export type SourceType = 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text' | 'manual'

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
  accessRole?: ExtractionAccessRole
  ownerName?: string | null
  ownerEmail?: string | null
  createdAt?: string
  cached?: boolean
  url?: string | null
  videoId?: string | null
  videoTitle?: string | null
  thumbnailUrl?: string | null
  mode?: ExtractionMode
  objective: string
  phases: Phase[]
  proTip: string
  metadata: ExtractMetadata
  sourceType?: SourceType
  sourceLabel?: string | null
  folderId?: string | null
}

export interface HistoryItem extends ExtractResult {
  id: string
  orderNumber: number
  shareVisibility: ShareVisibility
  url: string | null
  createdAt: string
  sourceType?: SourceType
  sourceLabel?: string | null
  folderId?: string | null
}

export interface ExtractionMember {
  extractionId: string
  userId: string
  role: Exclude<ExtractionAccessRole, 'owner'>
  createdAt: string
  userName: string | null
  userEmail: string | null
}

export interface SharedExtractionItem extends HistoryItem {
  accessRole: Exclude<ExtractionAccessRole, 'owner'>
  ownerName: string | null
  ownerEmail: string | null
}

export type InteractiveTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'
export type InteractiveTaskEventType = 'note' | 'pending_action' | 'blocker' | 'resolved'
export type InteractiveTaskAttachmentType = 'pdf' | 'image' | 'audio' | 'youtube_link' | 'note'
export type InteractiveTaskAttachmentStorageProvider = 'cloudinary' | 'external'

export interface InteractiveTaskEvent {
  id: string
  taskId: string
  eventType: InteractiveTaskEventType
  content: string
  metadataJson: string
  createdAt: string
  userName: string | null
  userEmail: string | null
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
  userName: string | null
  userEmail: string | null
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
  sharesCount?: number
  sharedByMe?: boolean
  followersCount?: number
  followingByMe?: boolean
  viewsCount?: number
  viewedByMe?: boolean
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
