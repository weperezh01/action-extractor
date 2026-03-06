import type { ExtractionMode } from '@/lib/extraction-modes'
import type { PlaybookNode } from '@/lib/playbook-tree'

export type ShareVisibility = 'private' | 'circle' | 'unlisted' | 'public'
export type ExtractionAccessRole = 'owner' | 'editor' | 'viewer'

export type SourceType = 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text' | 'manual'

export interface Phase {
  id: number
  title: string
  items: PlaybookNode[]
}

export interface ExtractMetadata {
  originalTime: string
  readingTime: string
  difficulty: string
  savedTime: string
}

export interface ExtractionTag {
  id: string
  name: string
  color: string
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
  isStarred?: boolean
  tags?: ExtractionTag[]
  sourceFileUrl?: string | null
  sourceFileName?: string | null
  sourceFileSizeBytes?: number | null
  sourceFileMimeType?: string | null
  hasSourceText?: boolean
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
  shareSource?: 'direct' | 'folder' | 'both'
  sharedFolderContext?: {
    rootFolderId: string | null
    rootFolderName: string | null
  } | null
}

export type InteractiveTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed'
export type InteractiveTaskEventType = 'note' | 'pending_action' | 'blocker' | 'resolved'
export type InteractiveTaskAttachmentType = 'pdf' | 'image' | 'audio' | 'youtube_link' | 'note'
export type InteractiveTaskAttachmentStorageProvider = 'cloudinary' | 'external'

export type FlowNodeType = 'process' | 'decision'
export type EdgeType = 'and' | 'xor' | 'loop'

export interface TaskEdge {
  id: string
  extractionId: string
  fromTaskId: string
  toTaskId: string
  edgeType: EdgeType
  label: string | null
  expectedExtraDays: number | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface DecisionSelection {
  extractionId: string
  decisionTaskId: string
  selectedToTaskId: string
}

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
  nodeId?: string
  parentNodeId?: string | null
  depth?: number
  positionPath?: string
  checked: boolean
  status: InteractiveTaskStatus
  dueAt: string | null
  completedAt: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  durationDays: number
  predecessorIds: string[]
  flowNodeType: FlowNodeType
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
  parentCommentId: string | null
  isHidden: boolean
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

// ── Presentation Types ────────────────────────────────────────────────────────

export interface TextElementStyle {
  fontSize?: number
  bold?: boolean
  color?: string
  align?: 'left' | 'center' | 'right'
}

export interface BulletElementStyle {
  fontSize?: number
  color?: string
  lineHeight?: number
}

export type PresentationElement =
  | { id: string; type: 'text'; x: number; y: number; w: number; h: number; z?: number;
      text: string; style?: TextElementStyle }
  | { id: string; type: 'image'; x: number; y: number; w: number; h: number; z?: number;
      url: string; publicId?: string | null; crop?: 'contain' | 'cover' }
  | { id: string; type: 'bullet'; x: number; y: number; w: number; h: number; z?: number;
      items: string[]; style?: BulletElementStyle }

export interface PresentationSlide {
  id: string
  title?: string
  background?: string
  elements: PresentationElement[]
}

export interface PresentationDeck {
  version: number
  theme?: { background?: string; accent?: string }
  slides: PresentationSlide[]
}
