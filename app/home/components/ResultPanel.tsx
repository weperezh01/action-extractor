import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignLeft,
  AlertTriangle,
  Bell,
  Eye,
  EyeOff,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Globe,
  GripVertical,
  ImageIcon,
  Link2,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Music2,
  Pencil,
  PenLine,
  Play,
  Plus,
  Save,
  Share2,
  Star,
  ThumbsUp,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import {
  EXTRACTION_MODE_OPTIONS,
  getExtractionModeLabel,
  normalizeExtractionMode,
  type ExtractionMode,
} from '@/lib/extraction-modes'
import {
  addChildNode,
  addSiblingNode,
  buildNewNode,
  countNodes,
  deleteNode,
  findNode,
  flattenItemsAsText,
  flattenPhaseNodes,
  normalizePlaybookPhases,
  updateNodeText,
} from '@/lib/playbook-tree'
import type {
  ExtractionAccessRole,
  ExtractionMember,
  ExtractResult,
  InteractiveTaskAttachment,
  InteractiveTaskComment,
  InteractiveTaskLikeSummary,
  InteractiveTask,
  InteractiveTaskEventType,
  InteractiveTaskStatus,
  Phase,
  ShareVisibility,
  SourceType,
} from '@/app/home/lib/types'
import type { FolderItem } from '@/app/home/components/FolderDock'
import {
  isShareVisibilityShareable,
  getShareVisibilityLabel,
} from '@/app/home/lib/share-visibility'

interface ResultPanelProps {
  result: ExtractResult
  viewerUserId?: string | null
  url: string
  extractionMode: ExtractionMode
  activePhase: number | null
  onTogglePhase: (id: number) => void

  isExportingPdf: boolean
  shareLoading: boolean
  shareCopied: boolean
  shareVisibility: ShareVisibility
  shareVisibilityLoading: boolean
  isProcessing: boolean

  notionConfigured: boolean
  notionConnected: boolean
  notionWorkspaceName: string | null
  notionLoading: boolean
  notionExportLoading: boolean

  trelloConfigured: boolean
  trelloConnected: boolean
  trelloUsername: string | null
  trelloLoading: boolean
  trelloExportLoading: boolean

  todoistConfigured: boolean
  todoistConnected: boolean
  todoistUserLabel: string | null
  todoistLoading: boolean
  todoistExportLoading: boolean

  googleDocsConfigured: boolean
  googleDocsConnected: boolean
  googleDocsUserEmail: string | null
  googleDocsLoading: boolean
  googleDocsExportLoading: boolean

  onDownloadPdf: () => void | Promise<void>
  onCopyShareLink: () => void | Promise<void>
  onCopyMarkdown: () => void | Promise<void>
  onShareVisibilityChange: (visibility: ShareVisibility) => void | Promise<void>
  onSavePhases: (phases: Phase[]) => Promise<boolean>
  onSaveMeta: (meta: { title: string; thumbnailUrl: string | null; objective: string }) => Promise<boolean>
  onReExtractMode: (mode: ExtractionMode) => void

  onExportToNotion: () => void | Promise<void>
  onConnectNotion: () => void | Promise<void>

  onExportToTrello: () => void | Promise<void>
  onConnectTrello: () => void | Promise<void>

  onExportToTodoist: () => void | Promise<void>
  onConnectTodoist: () => void | Promise<void>

  onExportToGoogleDocs: () => void | Promise<void>
  onConnectGoogleDocs: () => void | Promise<void>

  isBookClosed?: boolean
  bookFolderLabel?: string | null
  onClose?: () => void
  folders?: FolderItem[]
  onAssignFolder?: (extractionId: string, folderId: string | null) => void | Promise<void>
  accessRole?: ExtractionAccessRole
  members?: ExtractionMember[]
  membersLoading?: boolean
  memberMutationLoading?: boolean
  onAddMember?: (input: { email: string; role: 'editor' | 'viewer' }) => Promise<boolean>
  onRemoveMember?: (memberUserId: string) => Promise<boolean>
  onOpenPlaybookReference?: (playbookIdentifier: string) => void
  onStarResult?: (starred: boolean) => void
  allTags?: import('@/app/home/lib/types').ExtractionTag[]
  onAddTag?: (name: string, color: string) => Promise<void>
  onRemoveTag?: (tagId: string) => Promise<void>
}

type PlaybookCloseStage = 'idle' | 'folding' | 'cover'
type PlaybookCoverMotion = 'opening' | 'closing'
type PlaybookPageTurnStage = 'idle' | 'primed' | 'turning'
const PLAYBOOK_COVER_OPEN_MS = 860
const PLAYBOOK_COVER_CLOSE_MS = 1380
const PLAYBOOK_PAGE_TURN_MS = 1760

interface PlaybookPageTurnSnapshot {
  sourceSectionLabel: string
  sourceDisplayTitle: string
  objective: string
  phases: Phase[]
  savedTime: string
  difficulty: string
  modeLabel: string
}

const TASK_STATUS_OPTIONS: Array<{
  value: InteractiveTaskStatus
  label: string
  chipClassName: string
}> = [
  {
    value: 'pending',
    label: 'Pendiente',
    chipClassName:
      'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    value: 'in_progress',
    label: 'En progreso',
    chipClassName:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-300',
  },
  {
    value: 'blocked',
    label: 'Bloqueada',
    chipClassName:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300',
  },
  {
    value: 'completed',
    label: 'Completada',
    chipClassName:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300',
  },
]

const TASK_EVENT_TYPE_OPTIONS: Array<{ value: InteractiveTaskEventType; label: string }> = [
  { value: 'note', label: 'Observación' },
  { value: 'pending_action', label: 'Acción pendiente' },
  { value: 'blocker', label: 'Impedimento' },
  { value: 'resolved', label: 'Resuelto' },
]

function getTaskStatusLabel(status: InteractiveTaskStatus) {
  return TASK_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Pendiente'
}

function getTaskStatusChipClassName(status: InteractiveTaskStatus) {
  return (
    TASK_STATUS_OPTIONS.find((option) => option.value === status)?.chipClassName ??
    TASK_STATUS_OPTIONS[0].chipClassName
  )
}

function getTaskEventTypeLabel(eventType: InteractiveTaskEventType) {
  return TASK_EVENT_TYPE_OPTIONS.find((option) => option.value === eventType)?.label ?? 'Nota'
}

interface PlaybookReferenceToken {
  start: number
  end: number
  id: string
  label: string
}

const PLAYBOOK_REFERENCE_REGEX =
  /\[\[\s*playbook:([^\]\|\s]+)(?:\|([^\]]+))?\s*\]\]|\[([^\]]+)\]\(\s*playbook:([^) \t\r\n]+)\s*\)|\bplaybook:([A-Za-z0-9][A-Za-z0-9._-]*)\b/gi

function parsePlaybookReferenceTokens(text: unknown): PlaybookReferenceToken[] {
  const tokens: PlaybookReferenceToken[] = []
  if (typeof text !== 'string') return tokens
  if (!text.trim()) return tokens

  PLAYBOOK_REFERENCE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null = PLAYBOOK_REFERENCE_REGEX.exec(text)
  while (match) {
    const rawId = (match[1] ?? match[4] ?? match[5] ?? '').trim()
    if (rawId) {
      const rawLabel = (match[2] ?? match[3] ?? '').trim()
      tokens.push({
        start: match.index,
        end: match.index + match[0].length,
        id: rawId,
        label: rawLabel || `playbook:${rawId}`,
      })
    }
    match = PLAYBOOK_REFERENCE_REGEX.exec(text)
  }

  return tokens
}

function formatTaskEventDate(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return 'Fecha desconocida'

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: true,
  }).format(parsed)
}

function formatPlaybookCreatedAt(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return null

  return {
    date: new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parsed),
    time: new Intl.DateTimeFormat('es-ES', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(parsed),
  }
}

interface TaskCommentNode extends InteractiveTaskComment {
  replies: TaskCommentNode[]
}

function buildTaskCommentTree(comments: InteractiveTaskComment[]) {
  const sorted = [...comments].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime()
    const timeB = new Date(b.createdAt).getTime()
    if (Number.isNaN(timeA) || Number.isNaN(timeB) || timeA === timeB) {
      return a.id.localeCompare(b.id)
    }
    return timeA - timeB
  })

  const nodeById = new Map<string, TaskCommentNode>()
  for (const comment of sorted) {
    nodeById.set(comment.id, { ...comment, replies: [] })
  }

  const roots: TaskCommentNode[] = []
  for (const comment of sorted) {
    const node = nodeById.get(comment.id)
    if (!node) continue

    const parentId = comment.parentCommentId?.trim() || null
    if (!parentId || parentId === comment.id) {
      roots.push(node)
      continue
    }

    const parent = nodeById.get(parentId)
    if (!parent) {
      roots.push(node)
      continue
    }

    parent.replies.push(node)
  }

  return roots
}

function formatAttachmentSize(sizeBytes: number | null) {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return null
  const kb = 1024
  const mb = kb * 1024
  if (sizeBytes >= mb) return `${(sizeBytes / mb).toFixed(1)} MB`
  return `${Math.max(1, Math.round(sizeBytes / kb))} KB`
}

function getAttachmentTypeLabel(type: InteractiveTaskAttachment['attachmentType']) {
  if (type === 'image') return 'Imagen'
  if (type === 'audio') return 'Audio'
  if (type === 'youtube_link') return 'YouTube'
  if (type === 'note') return 'Nota'
  return 'PDF'
}

/**
 * Deriva la URL de miniatura (primera página como JPG) de un PDF de Cloudinary.
 * Funciona tanto para thumbnailUrl ya generados como para retrocompatibilidad
 * con PDFs viejos que tenían la URL del PDF como thumbnailUrl.
 */
function resolvePdfPreviewUrl(attachment: InteractiveTaskAttachment): string | null {
  if (attachment.attachmentType !== 'pdf') return null
  // thumbnailUrl correcto: termina en .jpg/.jpeg/.png (ya es imagen)
  const thumb = attachment.thumbnailUrl
  if (thumb && !/\.pdf$/i.test(thumb)) return thumb
  // Retrocompatibilidad: derivar thumbnail desde la URL del PDF en Cloudinary
  const url = attachment.url
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    return url
      .replace('/upload/', '/upload/pg_1,f_jpg,q_70,w_600,ar_16:9,c_fill/')
      .replace(/\.pdf$/i, '.jpg')
  }
  return null
}

/**
 * Devuelve la URL del proxy para abrir un PDF con Content-Type: application/pdf
 * y Content-Disposition: inline, evitando el error "We can't open this file" en Edge.
 */
function pdfOpenUrl(url: string): string {
  if (url.includes('cloudinary.com')) {
    return `/api/pdf-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

export function ResultPanel({
  result,
  viewerUserId = null,
  url,
  extractionMode,
  activePhase,
  onTogglePhase,
  isExportingPdf,
  shareLoading,
  shareCopied,
  shareVisibility,
  shareVisibilityLoading,
  isProcessing,

  notionConfigured,
  notionConnected,
  notionWorkspaceName,
  notionLoading,
  notionExportLoading,

  trelloConfigured,
  trelloConnected,
  trelloUsername,
  trelloLoading,
  trelloExportLoading,

  todoistConfigured,
  todoistConnected,
  todoistUserLabel,
  todoistLoading,
  todoistExportLoading,

  googleDocsConfigured,
  googleDocsConnected,
  googleDocsUserEmail,
  googleDocsLoading,
  googleDocsExportLoading,

  onDownloadPdf,
  onCopyShareLink,
  onCopyMarkdown,
  onShareVisibilityChange,
  onSavePhases,
  onSaveMeta,
  onReExtractMode,

  onExportToNotion,
  onConnectNotion,

  onExportToTrello,
  onConnectTrello,

  onExportToTodoist,
  onConnectTodoist,

  onExportToGoogleDocs,
  onConnectGoogleDocs,
  isBookClosed = false,
  bookFolderLabel,
  onClose,
  folders = [],
  onAssignFolder,
  accessRole = 'owner',
  members = [],
  membersLoading = false,
  memberMutationLoading = false,
  onAddMember,
  onRemoveMember,
  onOpenPlaybookReference,
  onStarResult,
  allTags = [],
  onAddTag,
  onRemoveTag,
}: ResultPanelProps) {
  const resolvedMode = normalizeExtractionMode(result.mode ?? extractionMode)
  const sourceUrl = (result.url ?? url).trim()
  const resolvedSourceType: SourceType = result.sourceType ?? (result.videoId ? 'youtube' : 'text')

  const sourceSectionLabel = (() => {
    switch (resolvedSourceType) {
      case 'youtube': return 'Video Fuente'
      case 'web_url': return 'Página Web Fuente'
      case 'pdf': return 'Documento PDF'
      case 'docx': return 'Documento Word'
      case 'manual': return 'Extracción Manual'
      default: return 'Contenido Analizado'
    }
  })()

  const sourceDisplayTitle = (() => {
    if (result.videoTitle) return result.videoTitle
    if (result.sourceLabel) return result.sourceLabel
    if (resolvedSourceType === 'manual') return 'Extracción manual'
    if (sourceUrl) {
      try { return new URL(sourceUrl).hostname } catch { return sourceUrl }
    }
    return 'Análisis de texto'
  })()
  const playbookCreatedAt = useMemo(
    () => (result.createdAt ? formatPlaybookCreatedAt(result.createdAt) : null),
    [result.createdAt]
  )
  const coverFolderLabel =
    typeof bookFolderLabel === 'string' && bookFolderLabel.trim().length > 0
      ? bookFolderLabel.trim()
      : 'General'
  const playbookOwnerSignature = useMemo(() => {
    const ownerName = result.ownerName?.trim()
    if (ownerName) return ownerName
    const ownerEmail = result.ownerEmail?.trim()
    if (ownerEmail) return ownerEmail
    return 'Propietario'
  }, [result.ownerEmail, result.ownerName])
  const isShareableVisibility = isShareVisibilityShareable(shareVisibility)
  const isOwnerAccess = accessRole === 'owner'
  const canEditTaskContent = accessRole === 'owner' || accessRole === 'editor'
  const canEditMeta = isOwnerAccess
  const canEditStructure = canEditTaskContent
  const canManageFolder = isOwnerAccess
  const canManageVisibility = isOwnerAccess
  const canManageMembers = isOwnerAccess
  const isGuestExtraction = (result.id?.trim() ?? '').startsWith('g-')
  const currentPageTurnSnapshot = useMemo<PlaybookPageTurnSnapshot>(
    () => ({
      sourceSectionLabel,
      sourceDisplayTitle,
      objective: result.objective ?? '',
      phases: normalizePlaybookPhases(result.phases),
      savedTime: result.metadata.savedTime,
      difficulty: result.metadata.difficulty,
      modeLabel: getExtractionModeLabel(resolvedMode),
    }),
    [
      sourceSectionLabel,
      sourceDisplayTitle,
      result.objective,
      result.phases,
      result.metadata.savedTime,
      result.metadata.difficulty,
      resolvedMode,
    ]
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copiedPhaseId, setCopiedPhaseId] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // ── Tags ──────────────────────────────────────────────────────────────────
  const [tagInput, setTagInput] = useState('')
  const [tagLoading, setTagLoading] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  const resultTags = result.tags ?? []
  const resultTagIds = new Set(resultTags.map((t) => t.id))

  const filteredTagSuggestions = allTags.filter(
    (t) => !resultTagIds.has(t.id) && t.name.includes(tagInput.toLowerCase().trim())
  )

  const handleTagKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !tagInput.trim() || tagLoading || !onAddTag) return
    e.preventDefault()
    const name = tagInput.trim().toLowerCase()
    setTagLoading(true)
    setTagInput('')
    setShowTagDropdown(false)
    try { await onAddTag(name, 'indigo') } finally { setTagLoading(false) }
  }

  const handlePickSuggestion = async (tag: import('@/app/home/lib/types').ExtractionTag) => {
    if (tagLoading || !onAddTag) return
    setTagLoading(true)
    setShowTagDropdown(false)
    setTagInput('')
    try { await onAddTag(tag.name, tag.color) } finally { setTagLoading(false) }
  }

  const handleRemoveTag = async (tagId: string) => {
    if (tagLoading || !onRemoveTag) return
    setTagLoading(true)
    try { await onRemoveTag(tagId) } finally { setTagLoading(false) }
  }

  const handleToggleFullscreen = useCallback(() => {
    const el = panelRef.current ?? document.documentElement
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => undefined)
    } else {
      void document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const handleCopyPhase = useCallback((phase: Phase) => {
    const items = flattenItemsAsText(phase.items)
    const lines = [`## ${phase.title}`, '', ...items.map((t) => `- ${t}`)]
    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedPhaseId(phase.id)
      window.setTimeout(() => setCopiedPhaseId((p) => (p === phase.id ? null : p)), 2000)
    })
  }, [])

  const [isActionsExpanded, setIsActionsExpanded] = useState(false)
  const [collapseAfterAsyncAction, setCollapseAfterAsyncAction] = useState(false)
  const asyncActionLoadingRef = useRef(false)
  const [isReextractExpanded, setIsReextractExpanded] = useState(false)
  const [collapseAfterReextract, setCollapseAfterReextract] = useState(false)
  const reextractProcessingRef = useRef(false)
  const rightControlsRef = useRef<HTMLDivElement | null>(null)
  const [interactiveTasks, setInteractiveTasks] = useState<InteractiveTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [taskMenuOpenId, setTaskMenuOpenId] = useState<string | null>(null)
  const [taskCommentMenuOpenId, setTaskCommentMenuOpenId] = useState<string | null>(null)
  const [taskMutationLoadingId, setTaskMutationLoadingId] = useState<string | null>(null)
  const [eventDraftContent, setEventDraftContent] = useState('')
  const [idCopied, setIdCopied] = useState(false)
  const [playbookLinkCopied, setPlaybookLinkCopied] = useState(false)
  const [isAssigningFolder, setIsAssigningFolder] = useState(false)
  const [closeStage, setCloseStage] = useState<PlaybookCloseStage>('cover')
  const [coverMotion, setCoverMotion] = useState<PlaybookCoverMotion>(
    isBookClosed ? 'closing' : 'opening'
  )
  const closeTimersRef = useRef<number[]>([])
  const [pageTurnStage, setPageTurnStage] = useState<PlaybookPageTurnStage>('idle')
  const [pageTurnSnapshot, setPageTurnSnapshot] = useState<PlaybookPageTurnSnapshot | null>(null)
  const pageTurnTimersRef = useRef<number[]>([])
  const latestPageTurnSnapshotRef = useRef<PlaybookPageTurnSnapshot>(currentPageTurnSnapshot)
  const previousResultIdRef = useRef<string | null>(result.id?.trim() ?? null)
  const [isStructureEditing, setIsStructureEditing] = useState(false)
  const [phaseDrafts, setPhaseDrafts] = useState<Phase[]>(normalizePlaybookPhases(result.phases))
  const [structureSaving, setStructureSaving] = useState(false)
  const [structureError, setStructureError] = useState<string | null>(null)
  const [dragOverPhaseIndex, setDragOverPhaseIndex] = useState<number | null>(null)
  const [dragOverSubItem, setDragOverSubItem] = useState<{ phaseId: number; index: number } | null>(null)
  const dragPhaseRef = useRef<number | null>(null)
  const dragSubItemRef = useRef<{ phaseId: number; index: number } | null>(null)
  const [taskAttachmentsByTaskId, setTaskAttachmentsByTaskId] = useState<
    Record<string, InteractiveTaskAttachment[]>
  >({})
  const [taskAttachmentLoadingId, setTaskAttachmentLoadingId] = useState<string | null>(null)
  const [taskAttachmentMutationId, setTaskAttachmentMutationId] = useState<string | null>(null)
  const [taskAttachmentErrorByTaskId, setTaskAttachmentErrorByTaskId] = useState<
    Record<string, string | null>
  >({})
  const [youtubeAttachmentDraftByTaskId, setYoutubeAttachmentDraftByTaskId] = useState<
    Record<string, string>
  >({})
  const [taskCommentsByTaskId, setTaskCommentsByTaskId] = useState<
    Record<string, InteractiveTaskComment[]>
  >({})
  const [taskLikeSummaryByTaskId, setTaskLikeSummaryByTaskId] = useState<
    Record<string, InteractiveTaskLikeSummary>
  >({})
  const [taskCommunityLoadingId, setTaskCommunityLoadingId] = useState<string | null>(null)
  const [taskCommunityMutationId, setTaskCommunityMutationId] = useState<string | null>(null)
  const [taskCommunityErrorByTaskId, setTaskCommunityErrorByTaskId] = useState<
    Record<string, string | null>
  >({})
  const [taskCommentDraftByTaskId, setTaskCommentDraftByTaskId] = useState<Record<string, string>>({})
  const [taskReplyDraftByTaskId, setTaskReplyDraftByTaskId] = useState<Record<string, string>>({})
  const [taskReplyParentByTaskId, setTaskReplyParentByTaskId] = useState<
    Record<string, string | null>
  >({})
  const [collapsedReplyThreadsByCommentKey, setCollapsedReplyThreadsByCommentKey] = useState<
    Record<string, boolean>
  >({})
  const [taskShareCopiedByTaskId, setTaskShareCopiedByTaskId] = useState<Record<string, boolean>>({})
  const [taskOpenSectionByTaskId, setTaskOpenSectionByTaskId] = useState<
    Record<string, 'gestion' | 'actividad' | null>
  >({})
  // One selected task at a time — community renders only for the selected task
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Per-task community visibility (true = shown, false = hidden by user toggle)
  // Defaults to true when the task is first selected
  const [taskCommunityOpenByTaskId, setTaskCommunityOpenByTaskId] = useState<
    Record<string, boolean>
  >({})
  // Per-task evidence visibility (true = shown, false = hidden by user toggle)
  // Defaults to true when the task is first selected
  const [taskEvidenceOpenByTaskId, setTaskEvidenceOpenByTaskId] = useState<
    Record<string, boolean>
  >({})
  // Tracks tasks whose community data has already been auto-fetched (per mount)
  const autoFetchedCommunityRef = useRef<Set<string>>(new Set())
  const [taskEstadoExpandedByTaskId, setTaskEstadoExpandedByTaskId] = useState<
    Record<string, boolean>
  >({})
  const [taskAddEvidenceExpandedByTaskId, setTaskAddEvidenceExpandedByTaskId] = useState<
    Record<string, boolean>
  >({})
  const [copiedAttachmentId, setCopiedAttachmentId] = useState<string | null>(null)
  const [openAttachmentMenuId, setOpenAttachmentMenuId] = useState<string | null>(null)
  const [mobileSheetTaskId, setMobileSheetTaskId] = useState<string | null>(null)
  const [mobileSheetTab, setMobileSheetTab] = useState<'gestion' | 'actividad' | 'evidencias' | 'comunidad'>('gestion')
  const [noteDraftByTaskId, setNoteDraftByTaskId] = useState<Record<string, string>>({})
  const taskFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [isMetaEditing, setIsMetaEditing] = useState(false)
  const [metaTitleDraft, setMetaTitleDraft] = useState('')
  const [metaObjectiveDraft, setMetaObjectiveDraft] = useState('')
  const [metaThumbnailUrl, setMetaThumbnailUrl] = useState<string | null>(null)
  const [metaThumbnailPreview, setMetaThumbnailPreview] = useState<string | null>(null)
  const [isUploadingMetaThumb, setIsUploadingMetaThumb] = useState(false)
  const [metaThumbError, setMetaThumbError] = useState<string | null>(null)
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [metaCloudinaryAvailable, setMetaCloudinaryAvailable] = useState<boolean | null>(null)
  const [memberEmailDraft, setMemberEmailDraft] = useState('')
  const [memberRoleDraft, setMemberRoleDraft] = useState<'editor' | 'viewer'>('viewer')
  const [memberError, setMemberError] = useState<string | null>(null)
  const metaThumbInputRef = useRef<HTMLInputElement>(null)
  const phasesSignature = useMemo(() => JSON.stringify(result.phases), [result.phases])
  const isAnyActionLoading =
    isExportingPdf ||
    shareLoading ||
    notionLoading ||
    notionExportLoading ||
    trelloLoading ||
    trelloExportLoading ||
    todoistLoading ||
    todoistExportLoading ||
    googleDocsLoading ||
    googleDocsExportLoading
  const isBookFullyClosed = closeStage === 'cover'
  const isBookOpen = closeStage === 'idle'
  const isPageTurning = pageTurnStage !== 'idle'
  const shouldHideBookContent =
    isBookFullyClosed || (closeStage === 'folding' && coverMotion === 'closing')
  const showBookCover = true
  const coverOpenedToLeft =
    closeStage === 'idle' || (closeStage === 'folding' && coverMotion === 'opening')
  const showPageTurnLeaf = isBookOpen && !isBookClosed && isPageTurning && Boolean(pageTurnSnapshot)
  const pageTurnTransform =
    pageTurnStage === 'turning'
      ? 'perspective(2800px) rotateY(-98deg) rotateX(1.15deg) skewY(-1.2deg) skewX(-0.8deg) scaleX(0.994) scaleY(0.983)'
      : 'perspective(2800px) rotateY(0deg) rotateX(0deg) skewY(0deg) skewX(0deg) scaleX(1) scaleY(1)'
  const pageTurnBorderRadius =
    pageTurnStage === 'turning'
      ? '2px 66px 84px 2px / 2px 82px 106px 2px'
      : '2px 12px 14px 2px / 2px 16px 18px 2px'
  const pageTurnShadow =
    pageTurnStage === 'turning'
      ? 'inset -24px 0 34px rgba(128, 100, 58, 0.24), inset -66px 0 44px rgba(255, 255, 255, 0.22), 12px 0 28px -15px rgba(64, 43, 20, 0.56)'
      : 'inset 0 0 0 1px rgba(255, 255, 255, 0.5), 8px 0 18px -14px rgba(64, 43, 20, 0.42)'
  const isPageTurnAtBend = pageTurnStage === 'turning'

  useEffect(() => {
    return () => {
      closeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      closeTimersRef.current = []
      pageTurnTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      pageTurnTimersRef.current = []
    }
  }, [])

  useEffect(() => {
    closeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    closeTimersRef.current = []

    if (isBookClosed) {
      setCoverMotion('closing')
      setCloseStage('folding')
      const closeTimer = window.setTimeout(() => setCloseStage('cover'), PLAYBOOK_COVER_CLOSE_MS)
      closeTimersRef.current = [closeTimer]
      return
    }

    setCoverMotion('opening')
    setCloseStage('folding')
    const openTimer = window.setTimeout(() => setCloseStage('idle'), PLAYBOOK_COVER_OPEN_MS)
    closeTimersRef.current = [openTimer]
  }, [isBookClosed])

  useEffect(() => {
    const nextResultId = result.id?.trim() ?? null
    const previousResultId = previousResultIdRef.current

    const shouldAnimateTurn =
      previousResultId !== null &&
      nextResultId !== null &&
      previousResultId !== nextResultId &&
      closeStage === 'idle' &&
      !isBookClosed

    pageTurnTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    pageTurnTimersRef.current = []

    if (shouldAnimateTurn) {
      setPageTurnSnapshot(latestPageTurnSnapshotRef.current)
      setPageTurnStage('primed')
      const startTimer = window.setTimeout(() => setPageTurnStage('turning'), 20)
      const endTimer = window.setTimeout(() => {
        setPageTurnStage('idle')
        setPageTurnSnapshot(null)
      }, PLAYBOOK_PAGE_TURN_MS + 120)
      pageTurnTimersRef.current = [startTimer, endTimer]
    } else {
      setPageTurnStage('idle')
      setPageTurnSnapshot(null)
    }

    previousResultIdRef.current = nextResultId
  }, [result.id, closeStage, isBookClosed])

  useEffect(() => {
    latestPageTurnSnapshotRef.current = currentPageTurnSnapshot
  }, [currentPageTurnSnapshot])

  useEffect(() => {
    if (!collapseAfterAsyncAction) return

    if (isAnyActionLoading) {
      asyncActionLoadingRef.current = true
      return
    }

    if (!asyncActionLoadingRef.current) return

    setIsActionsExpanded(false)
    setCollapseAfterAsyncAction(false)
    asyncActionLoadingRef.current = false
  }, [collapseAfterAsyncAction, isAnyActionLoading])

  useEffect(() => {
    if (!collapseAfterReextract) return

    if (isProcessing) {
      reextractProcessingRef.current = true
      return
    }

    if (!reextractProcessingRef.current) return

    setIsReextractExpanded(false)
    setCollapseAfterReextract(false)
    reextractProcessingRef.current = false
  }, [collapseAfterReextract, isProcessing])

  useEffect(() => {
    if (!isActionsExpanded && !isReextractExpanded) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return

      const controls = rightControlsRef.current
      if (!controls || controls.contains(target)) return

      setIsActionsExpanded(false)
      setIsReextractExpanded(false)
      setCollapseAfterAsyncAction(false)
      setCollapseAfterReextract(false)
      asyncActionLoadingRef.current = false
      reextractProcessingRef.current = false
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isActionsExpanded, isReextractExpanded])

  useEffect(() => {
    setIdCopied(false)
  }, [result.id])

  // Reset meta edit mode when extraction changes
  useEffect(() => {
    setIsMetaEditing(false)
    setMetaError(null)
    setMetaCloudinaryAvailable(null)
    setMemberEmailDraft('')
    setMemberRoleDraft('viewer')
    setMemberError(null)
  }, [result.id])

  // Probe Cloudinary availability when meta edit mode opens
  useEffect(() => {
    if (!isMetaEditing || metaCloudinaryAvailable !== null) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/extract/thumbnail', { method: 'POST', body: new FormData() })
        if (!cancelled) setMetaCloudinaryAvailable(res.status !== 503)
      } catch {
        if (!cancelled) setMetaCloudinaryAvailable(false)
      }
    })()
    return () => { cancelled = true }
  }, [isMetaEditing, metaCloudinaryAvailable])

  useEffect(() => {
    setTaskAttachmentsByTaskId({})
    setTaskAttachmentErrorByTaskId({})
    setYoutubeAttachmentDraftByTaskId({})
    setTaskAttachmentLoadingId(null)
    setTaskAttachmentMutationId(null)
    setTaskCommentsByTaskId({})
    setTaskLikeSummaryByTaskId({})
    setTaskCommunityLoadingId(null)
    setTaskCommunityMutationId(null)
    setTaskCommunityErrorByTaskId({})
    setTaskCommentDraftByTaskId({})
    setTaskReplyDraftByTaskId({})
    setTaskReplyParentByTaskId({})
    setTaskCommentMenuOpenId(null)
    setTaskOpenSectionByTaskId({})
    setSelectedTaskId(null)
    setTaskCommunityOpenByTaskId({})
    setTaskEvidenceOpenByTaskId({})
    autoFetchedCommunityRef.current = new Set()
    setTaskEstadoExpandedByTaskId({})
    setTaskAddEvidenceExpandedByTaskId({})
    taskFileInputRefs.current = {}
  }, [result.id])

  useEffect(() => {
    if (isStructureEditing) return
    setPhaseDrafts(normalizePlaybookPhases(result.phases))
    setStructureError(null)
  }, [isStructureEditing, result.phases])

  useEffect(() => {
    const extractionId = result.id?.trim()
    if (!extractionId) {
      setInteractiveTasks([])
      setTasksLoading(false)
      setTasksError(null)
      setActiveTaskId(null)
      return
    }

    const controller = new AbortController()

    const loadTasks = async () => {
      setTasksLoading(true)
      setTasksError(null)
      try {
        const response = canEditTaskContent
          ? await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'sync',
                phases: result.phases,
              }),
              signal: controller.signal,
            })
          : await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/tasks`, {
              method: 'GET',
              signal: controller.signal,
            })

        const payload = (await response.json().catch(() => null)) as
          | { tasks?: unknown; error?: unknown }
          | null

        if (!response.ok) {
          const message =
            typeof payload?.error === 'string' && payload.error.trim()
              ? payload.error
              : 'No se pudo cargar el checklist interactivo.'
          throw new Error(message)
        }

        const tasks = Array.isArray(payload?.tasks) ? (payload.tasks as InteractiveTask[]) : []
        if (controller.signal.aborted) return

        setInteractiveTasks(tasks)
        setActiveTaskId((previous) => (tasks.some((task) => task.id === previous) ? previous : null))
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : 'No se pudo cargar el checklist interactivo.'
        setTasksError(message)
      } finally {
        if (!controller.signal.aborted) {
          setTasksLoading(false)
        }
      }
    }

    void loadTasks()

    return () => {
      controller.abort()
    }
  }, [canEditTaskContent, phasesSignature, result.id, result.phases])

  useEffect(() => {
    setEventDraftContent('')
  }, [activeTaskId])

  const tasksByPhaseItem = useMemo(() => {
    const map = new Map<string, InteractiveTask>()
    for (const task of interactiveTasks) {
      map.set(`${task.phaseId}:${task.itemIndex}`, task)
    }
    return map
  }, [interactiveTasks])

  const tasksByNodeId = useMemo(() => {
    const map = new Map<string, InteractiveTask>()
    for (const task of interactiveTasks) {
      const key = task.nodeId?.trim()
      if (!key) continue
      map.set(key, task)
    }
    return map
  }, [interactiveTasks])

  const fetchTaskAttachments = async (taskId: string) => {
    const extractionId = result.id?.trim()
    if (!extractionId) return false

    setTaskAttachmentLoadingId(taskId)
    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          taskId
        )}/attachments`,
        { cache: 'no-store' }
      )
      const payload = (await response.json().catch(() => null)) as
        | { attachments?: unknown; error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'No se pudieron cargar las evidencias.'
        setTaskAttachmentErrorByTaskId((previous) => ({
          ...previous,
          [taskId]: message,
        }))
        return false
      }

      const attachments = Array.isArray(payload?.attachments)
        ? (payload.attachments as InteractiveTaskAttachment[])
        : []
      setTaskAttachmentsByTaskId((previous) => ({
        ...previous,
        [taskId]: attachments,
      }))
      return true
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: 'No se pudieron cargar las evidencias.',
      }))
      return false
    } finally {
      setTaskAttachmentLoadingId((previous) => (previous === taskId ? null : previous))
    }
  }

  const fetchTaskCommunity = async (taskId: string) => {
    const extractionId = result.id?.trim()
    if (!extractionId) return false

    setTaskCommunityLoadingId(taskId)
    setTaskCommunityErrorByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          taskId
        )}/community`,
        { cache: 'no-store' }
      )
      const payload = (await response.json().catch(() => null)) as
        | { comments?: unknown; likeSummary?: unknown; error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'No se pudo cargar la comunidad.'
        setTaskCommunityErrorByTaskId((previous) => ({
          ...previous,
          [taskId]: message,
        }))
        return false
      }

      const comments = Array.isArray(payload?.comments)
        ? (payload.comments as InteractiveTaskComment[])
        : []
      const likeSummary =
        payload?.likeSummary && typeof payload.likeSummary === 'object'
          ? (payload.likeSummary as InteractiveTaskLikeSummary)
          : {
              taskId,
              extractionId,
              likesCount: 0,
              likedByMe: false,
              sharesCount: 0,
              sharedByMe: false,
              followersCount: 0,
              followingByMe: false,
              viewsCount: 0,
              viewedByMe: false,
            }

      setTaskCommentsByTaskId((previous) => ({
        ...previous,
        [taskId]: comments,
      }))
      setTaskLikeSummaryByTaskId((previous) => ({
        ...previous,
        [taskId]: likeSummary,
      }))
      return true
    } catch {
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: 'No se pudo cargar la comunidad.',
      }))
      return false
    } finally {
      setTaskCommunityLoadingId((previous) => (previous === taskId ? null : previous))
    }
  }

  useEffect(() => {
    const extractionId = result.id?.trim()
    if (!extractionId || !activeTaskId) return
    void fetchTaskAttachments(activeTaskId)
  }, [activeTaskId, result.id])


  // Interceptar botón "atrás" del dispositivo para cerrar el modal en lugar de navegar
  useEffect(() => {
    if (!mobileSheetTaskId) return

    const taskIdSnapshot = mobileSheetTaskId
    // Empujar una entrada falsa con la misma URL para que el "atrás" llegue aquí primero
    window.history.pushState({ mobileSheet: taskIdSnapshot }, '')

    const onPopState = () => {
      // El usuario presionó "atrás" — cerrar modal sin navegar
      setMobileSheetTaskId(null)
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      // Si el modal se cerró por otro medio (botón X), limpiar la entrada falsa del historial
      if (window.history.state?.mobileSheet === taskIdSnapshot) {
        window.history.back()
      }
    }
  }, [mobileSheetTaskId])

  // Auto-fetch comunidad cuando el sheet mobile está en esa pestaña
  useEffect(() => {
    if (!mobileSheetTaskId || mobileSheetTab !== 'comunidad') return
    if (autoFetchedCommunityRef.current.has(mobileSheetTaskId)) return
    autoFetchedCommunityRef.current.add(mobileSheetTaskId)
    void fetchTaskCommunity(mobileSheetTaskId)
  }, [mobileSheetTaskId, mobileSheetTab])

  useEffect(() => {
    const extractionId = result.id?.trim()
    const realtimeTaskId = mobileSheetTaskId ?? selectedTaskId
    if (!extractionId || !realtimeTaskId) return
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    const streamUrl = `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
      realtimeTaskId
    )}/community/stream`
    const stream = new EventSource(streamUrl)

    const refreshCommunity = () => {
      void fetchTaskCommunity(realtimeTaskId)
    }

    const handleReady = () => {
      refreshCommunity()
    }

    const handleRefresh = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as { taskId?: unknown }
        const eventTaskId = typeof data?.taskId === 'string' ? data.taskId : realtimeTaskId
        if (eventTaskId !== realtimeTaskId) return
      } catch {
        // Ignore malformed payloads and still refresh conservatively
      }
      refreshCommunity()
    }

    stream.addEventListener('community_ready', handleReady as EventListener)
    stream.addEventListener('community_refresh', handleRefresh as EventListener)

    return () => {
      stream.removeEventListener('community_ready', handleReady as EventListener)
      stream.removeEventListener('community_refresh', handleRefresh as EventListener)
      stream.close()
    }
  }, [mobileSheetTaskId, result.id, selectedTaskId])

  useEffect(() => {
    if (!taskMenuOpenId) return

    const handleOutsideTaskMenuClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-task-menu-root="true"]')) return
      setTaskMenuOpenId(null)
    }

    document.addEventListener('mousedown', handleOutsideTaskMenuClick)
    document.addEventListener('touchstart', handleOutsideTaskMenuClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideTaskMenuClick)
      document.removeEventListener('touchstart', handleOutsideTaskMenuClick)
    }
  }, [taskMenuOpenId])

  useEffect(() => {
    if (!taskCommentMenuOpenId) return

    const handleOutsideCommentMenuClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-task-comment-menu-root="true"]')) return
      setTaskCommentMenuOpenId(null)
    }

    document.addEventListener('mousedown', handleOutsideCommentMenuClick)
    document.addEventListener('touchstart', handleOutsideCommentMenuClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideCommentMenuClick)
      document.removeEventListener('touchstart', handleOutsideCommentMenuClick)
    }
  }, [taskCommentMenuOpenId])

  const refreshTaskCollection = async (payload: Record<string, unknown>) => {
    const extractionId = result.id?.trim()
    if (!extractionId) return false

    const response = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = (await response.json().catch(() => null)) as
      | { tasks?: unknown; error?: unknown }
      | null

    if (!response.ok) {
      const message =
        typeof data?.error === 'string' && data.error.trim()
          ? data.error
          : 'No se pudo actualizar el checklist interactivo.'
      setTasksError(message)
      return false
    }

    const tasks = Array.isArray(data?.tasks) ? (data.tasks as InteractiveTask[]) : []
    setInteractiveTasks(tasks)
    setActiveTaskId((previous) => (tasks.some((task) => task.id === previous) ? previous : null))
    setTasksError(null)
    return true
  }

  const handleTaskToggle = async (task: InteractiveTask, checked: boolean) => {
    if (!canEditTaskContent) return
    setTaskMutationLoadingId(task.id)
    try {
      await refreshTaskCollection({
        action: 'update',
        taskId: task.id,
        checked,
      })
    } finally {
      setTaskMutationLoadingId(null)
    }
  }

  const handleTaskStatusChange = async (task: InteractiveTask, status: InteractiveTaskStatus) => {
    if (!canEditTaskContent) return
    setTaskMutationLoadingId(task.id)
    try {
      await refreshTaskCollection({
        action: 'update',
        taskId: task.id,
        status,
      })
    } finally {
      setTaskMutationLoadingId(null)
    }
  }

  const handleAddTaskEvent = async (task: InteractiveTask, eventType: InteractiveTaskEventType) => {
    if (!canEditTaskContent) return
    const content = eventDraftContent.trim()
    if (!content) return

    setTaskMutationLoadingId(task.id)
    try {
      const ok = await refreshTaskCollection({
        action: 'add_event',
        taskId: task.id,
        eventType,
        content,
      })

      if (ok) {
        setEventDraftContent('')
      }
    } finally {
      setTaskMutationLoadingId(null)
    }
  }

  const handleOpenTaskFilePicker = (taskId: string) => {
    if (!canEditTaskContent) return
    const node = taskFileInputRefs.current[taskId]
    if (!node) return
    node.click()
  }

  const handleTaskFileSelected = async (task: InteractiveTask, file: File | null) => {
    if (!canEditTaskContent) return
    if (!file) return
    const extractionId = result.id?.trim()
    if (!extractionId) return

    setTaskAttachmentMutationId(task.id)
    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))

    try {
      const formData = new FormData()
      formData.set('file', file)

      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          task.id
        )}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      )
      const payload = (await response.json().catch(() => null)) as
        | { error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'No se pudo subir la evidencia.'
        setTaskAttachmentErrorByTaskId((previous) => ({
          ...previous,
          [task.id]: message,
        }))
        return
      }

      await fetchTaskAttachments(task.id)
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: 'No se pudo subir la evidencia.',
      }))
    } finally {
      setTaskAttachmentMutationId((previous) => (previous === task.id ? null : previous))
      const node = taskFileInputRefs.current[task.id]
      if (node) node.value = ''
    }
  }

  const handleTaskYoutubeDraftChange = (taskId: string, value: string) => {
    setYoutubeAttachmentDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value,
    }))
  }

  const handleAddTaskYoutubeLink = async (task: InteractiveTask) => {
    if (!canEditTaskContent) return
    const extractionId = result.id?.trim()
    if (!extractionId) return

    const youtubeUrl = (youtubeAttachmentDraftByTaskId[task.id] ?? '').trim()
    if (!youtubeUrl) return

    setTaskAttachmentMutationId(task.id)
    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          task.id
        )}/attachments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeUrl }),
        }
      )
      const payload = (await response.json().catch(() => null)) as
        | { error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'No se pudo guardar el enlace.'
        setTaskAttachmentErrorByTaskId((previous) => ({
          ...previous,
          [task.id]: message,
        }))
        return
      }

      setYoutubeAttachmentDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
      await fetchTaskAttachments(task.id)
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: 'No se pudo guardar el enlace.',
      }))
    } finally {
      setTaskAttachmentMutationId((previous) => (previous === task.id ? null : previous))
    }
  }

  const handleDeleteTaskAttachment = async (
    task: InteractiveTask,
    attachment: InteractiveTaskAttachment
  ) => {
    if (!canEditTaskContent) return
    const extractionId = result.id?.trim()
    if (!extractionId) return

    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm('¿Eliminar esta evidencia del subítem?')
    if (!confirmed) return

    setTaskAttachmentMutationId(task.id)
    setTaskAttachmentErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          task.id
        )}/attachments/${encodeURIComponent(attachment.id)}`,
        {
          method: 'DELETE',
        }
      )
      const payload = (await response.json().catch(() => null)) as
        | { error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'No se pudo eliminar la evidencia.'
        setTaskAttachmentErrorByTaskId((previous) => ({
          ...previous,
          [task.id]: message,
        }))
        return
      }

      await fetchTaskAttachments(task.id)
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: 'No se pudo eliminar la evidencia.',
      }))
    } finally {
      setTaskAttachmentMutationId((previous) => (previous === task.id ? null : previous))
    }
  }

  const handleAddTaskNote = async (task: InteractiveTask) => {
    if (!canEditTaskContent) return
    const extractionId = result.id?.trim()
    if (!extractionId) return
    const noteText = (noteDraftByTaskId[task.id] ?? '').trim()
    if (!noteText) return

    setTaskAttachmentMutationId(task.id)
    setTaskAttachmentErrorByTaskId((previous) => ({ ...previous, [task.id]: null }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(task.id)}/attachments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteText }),
        }
      )
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'No se pudo guardar la nota.'
        setTaskAttachmentErrorByTaskId((previous) => ({ ...previous, [task.id]: message }))
        return
      }
      setNoteDraftByTaskId((previous) => ({ ...previous, [task.id]: '' }))
      await fetchTaskAttachments(task.id)
    } catch {
      setTaskAttachmentErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: 'No se pudo guardar la nota.',
      }))
    } finally {
      setTaskAttachmentMutationId((previous) => (previous === task.id ? null : previous))
    }
  }

  const handleCopyAttachmentLink = (attachmentId: string, url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedAttachmentId(attachmentId)
      setTimeout(() => setCopiedAttachmentId((previous) => (previous === attachmentId ? null : previous)), 2000)
    })
  }

  const handleTaskCommentDraftChange = (taskId: string, value: string) => {
    setTaskCommentDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value,
    }))
  }

  const handleTaskReplyDraftChange = (taskId: string, value: string) => {
    setTaskReplyDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value,
    }))
  }

  const handleStartTaskReply = (taskId: string, commentId: string) => {
    const replyThreadKey = `${taskId}:${commentId}`
    setTaskCommunityOpenByTaskId((previous) => ({
      ...previous,
      [taskId]: true,
    }))
    setTaskCommentMenuOpenId(null)
    setTaskReplyParentByTaskId((previous) => ({
      ...previous,
      [taskId]: commentId,
    }))
    setTaskReplyDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: '',
    }))
    setCollapsedReplyThreadsByCommentKey((previous) => ({
      ...previous,
      [replyThreadKey]: false,
    }))
  }

  const handleCancelTaskReply = (taskId: string) => {
    setTaskReplyParentByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))
    setTaskReplyDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: '',
    }))
  }

  const handleToggleTaskCommentReplies = (taskId: string, commentId: string) => {
    const replyThreadKey = `${taskId}:${commentId}`
    setCollapsedReplyThreadsByCommentKey((previous) => ({
      ...previous,
      [replyThreadKey]: !previous[replyThreadKey],
    }))
  }

  const mutateTaskCommunity = async (taskId: string, payload: Record<string, unknown>) => {
    const extractionId = result.id?.trim()
    if (!extractionId) return false

    setTaskCommunityMutationId(taskId)
    setTaskCommunityErrorByTaskId((previous) => ({
      ...previous,
      [taskId]: null,
    }))

    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(
          taskId
        )}/community`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = (await response.json().catch(() => null)) as
        | { comments?: unknown; likeSummary?: unknown; error?: unknown }
        | null

      if (!response.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo actualizar la comunidad.'
        setTaskCommunityErrorByTaskId((previous) => ({
          ...previous,
          [taskId]: message,
        }))
        return false
      }

      const comments = Array.isArray(data?.comments) ? (data.comments as InteractiveTaskComment[]) : []
      const likeSummary =
        data?.likeSummary && typeof data.likeSummary === 'object'
          ? (data.likeSummary as InteractiveTaskLikeSummary)
          : {
              taskId,
              extractionId,
              likesCount: 0,
              likedByMe: false,
              sharesCount: 0,
              sharedByMe: false,
              followersCount: 0,
              followingByMe: false,
              viewsCount: 0,
              viewedByMe: false,
            }

      setTaskCommentsByTaskId((previous) => ({
        ...previous,
        [taskId]: comments,
      }))
      setTaskLikeSummaryByTaskId((previous) => ({
        ...previous,
        [taskId]: likeSummary,
      }))
      return true
    } catch {
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: 'No se pudo actualizar la comunidad.',
      }))
      return false
    } finally {
      setTaskCommunityMutationId((previous) => (previous === taskId ? null : previous))
    }
  }

  const handleAddTaskComment = async (task: InteractiveTask) => {
    const content = (taskCommentDraftByTaskId[task.id] ?? '').trim()
    if (!content) return

    const ok = await mutateTaskCommunity(task.id, {
      action: 'add_comment',
      content,
    })
    if (ok) {
      setTaskCommentDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
    }
  }

  const handleAddTaskReply = async (task: InteractiveTask, parentCommentId: string) => {
    const content = (taskReplyDraftByTaskId[task.id] ?? '').trim()
    if (!content) return

    const parentExists = (taskCommentsByTaskId[task.id] ?? []).some((comment) => comment.id === parentCommentId)
    if (!parentExists) {
      handleCancelTaskReply(task.id)
      return
    }

    const ok = await mutateTaskCommunity(task.id, {
      action: 'add_comment',
      content,
      parentCommentId,
    })
    if (ok) {
      setTaskReplyDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
      setTaskReplyParentByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
    }
  }

  const handleDeleteTaskComment = async (task: InteractiveTask, commentId: string) => {
    const confirmed =
      typeof window === 'undefined' ? false : window.confirm('¿Eliminar este comentario?')
    if (!confirmed) return

    setTaskCommentMenuOpenId(null)
    const ok = await mutateTaskCommunity(task.id, {
      action: 'delete_comment',
      commentId,
    })
    if (ok && taskReplyParentByTaskId[task.id] === commentId) {
      setTaskReplyParentByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      setTaskReplyDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
    }
  }

  const handleToggleTaskCommentHidden = async (
    task: InteractiveTask,
    commentId: string,
    currentlyHidden: boolean
  ) => {
    const nextHidden = !currentlyHidden
    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(nextHidden ? '¿Ocultar este comentario?' : '¿Mostrar este comentario?')
    if (!confirmed) return

    setTaskCommentMenuOpenId(null)
    const ok = await mutateTaskCommunity(task.id, {
      action: 'toggle_hide_comment',
      commentId,
      hidden: nextHidden,
    })
    if (ok && taskReplyParentByTaskId[task.id] === commentId) {
      setTaskReplyParentByTaskId((previous) => ({
        ...previous,
        [task.id]: null,
      }))
      setTaskReplyDraftByTaskId((previous) => ({
        ...previous,
        [task.id]: '',
      }))
    }
  }

  const handleToggleTaskLike = async (task: InteractiveTask) => {
    await mutateTaskCommunity(task.id, {
      action: 'toggle_like',
    })
  }

  const handleToggleTaskFollow = async (task: InteractiveTask) => {
    if (isGuestExtraction) {
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: 'Seguir subítems requiere una cuenta registrada.',
      }))
      return
    }

    await mutateTaskCommunity(task.id, {
      action: 'toggle_follow',
    })
  }

  const handleShareTask = async (task: InteractiveTask) => {
    if (typeof window === 'undefined') return

    const extractionId = result.id?.trim()
    if (!extractionId) return

    setTaskCommunityErrorByTaskId((previous) => ({
      ...previous,
      [task.id]: null,
    }))

    const taskHash = `#task-${task.id}`
    const fallbackShareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${taskHash}`
    let shareUrl = fallbackShareUrl

    if (!isGuestExtraction && canManageVisibility && isShareableVisibility) {
      try {
        const response = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extractionId }),
        })
        const payload = (await response.json().catch(() => null)) as
          | { token?: unknown; error?: unknown }
          | null

        if (response.ok) {
          const token = typeof payload?.token === 'string' ? payload.token.trim() : ''
          if (token) {
            shareUrl = `${window.location.origin}/share/${token}${taskHash}`
          }
        } else {
          const message =
            typeof payload?.error === 'string' && payload.error.trim()
              ? payload.error
              : 'No se pudo generar el enlace compartible del subítem.'
          setTaskCommunityErrorByTaskId((previous) => ({
            ...previous,
            [task.id]: message,
          }))
        }
      } catch {
        setTaskCommunityErrorByTaskId((previous) => ({
          ...previous,
          [task.id]: 'No se pudo generar el enlace compartible del subítem.',
        }))
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setTaskShareCopiedByTaskId((previous) => ({
        ...previous,
        [task.id]: true,
      }))
      window.setTimeout(() => {
        setTaskShareCopiedByTaskId((previous) => ({
          ...previous,
          [task.id]: false,
        }))
      }, 1800)
    } catch {
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [task.id]: 'No se pudo copiar el enlace del subítem.',
      }))
      return
    }

    if (!isGuestExtraction) {
      await mutateTaskCommunity(task.id, {
        action: 'record_share',
      })
    }
  }

  const collapseActionsSection = () => {
    setIsActionsExpanded(false)
    setCollapseAfterAsyncAction(false)
    asyncActionLoadingRef.current = false
  }

  const triggerAsyncAction = (action: () => void | Promise<void>) => {
    const maybePromise = action()
    if (maybePromise && typeof (maybePromise as PromiseLike<void>).then === 'function') {
      void Promise.resolve(maybePromise).finally(() => {
        collapseActionsSection()
      })
      return
    }

    setCollapseAfterAsyncAction(true)
    asyncActionLoadingRef.current = false
  }

  const triggerInstantAction = (action: () => void | Promise<void>) => {
    const maybePromise = action()
    if (maybePromise && typeof (maybePromise as PromiseLike<void>).then === 'function') {
      void Promise.resolve(maybePromise).finally(() => {
        collapseActionsSection()
      })
      return
    }

    collapseActionsSection()
  }

  const triggerReextractMode = (mode: ExtractionMode) => {
    setCollapseAfterReextract(true)
    reextractProcessingRef.current = false
    onReExtractMode(mode)
  }

  const handleToggleActions = () => {
    setCollapseAfterAsyncAction(false)
    asyncActionLoadingRef.current = false
    setIsActionsExpanded((previous) => {
      const next = !previous
      if (next) {
        setIsReextractExpanded(false)
        setCollapseAfterReextract(false)
        reextractProcessingRef.current = false
      }
      return next
    })
  }

  const handleToggleReextract = () => {
    setCollapseAfterReextract(false)
    reextractProcessingRef.current = false
    setIsReextractExpanded((previous) => {
      const next = !previous
      if (next) {
        setIsActionsExpanded(false)
        setCollapseAfterAsyncAction(false)
        asyncActionLoadingRef.current = false
      }
      return next
    })
  }

  const handleCopyExtractionId = async () => {
    const extractionId = result.id?.trim()
    if (!extractionId) return

    try {
      await navigator.clipboard.writeText(extractionId)
      setIdCopied(true)
      window.setTimeout(() => setIdCopied(false), 2200)
    } catch {
      setIdCopied(false)
    }
  }

  const handleCopyPlaybookReference = async () => {
    const extractionId = result.id?.trim()
    if (!extractionId) return

    try {
      await navigator.clipboard.writeText(`playbook:${extractionId}`)
      setPlaybookLinkCopied(true)
      window.setTimeout(() => setPlaybookLinkCopied(false), 2200)
    } catch {
      setPlaybookLinkCopied(false)
    }
  }

  const renderTextWithPlaybookReferences = (text: unknown) => {
    const safeText = typeof text === 'string' ? text : text == null ? '' : String(text)
    const tokens = parsePlaybookReferenceTokens(safeText)
    if (tokens.length === 0) return safeText

    const parts: Array<string | JSX.Element> = []
    let cursor = 0

    tokens.forEach((token, index) => {
      if (token.start > cursor) {
        parts.push(safeText.slice(cursor, token.start))
      }

      parts.push(
        <span
          key={`playbook-reference-${token.id}-${token.start}-${index}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onOpenPlaybookReference?.(token.id)
          }}
          className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.86em] ${
            onOpenPlaybookReference
              ? 'cursor-pointer border-violet-300 bg-violet-50 text-violet-700 underline decoration-violet-500/70 underline-offset-2 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/25 dark:text-violet-200 dark:hover:bg-violet-900/40'
              : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
          title={`Abrir playbook ${token.id}`}
        >
          {token.label}
        </span>
      )

      cursor = token.end
    })

    if (cursor < safeText.length) {
      parts.push(safeText.slice(cursor))
    }

    return parts
  }

  const handleStartStructureEditing = () => {
    if (!canEditStructure) return
    setPhaseDrafts(normalizePlaybookPhases(result.phases))
    setStructureError(null)
    setIsStructureEditing(true)
  }

  const handleCancelStructureEditing = () => {
    setPhaseDrafts(normalizePlaybookPhases(result.phases))
    setStructureError(null)
    setIsStructureEditing(false)
  }

  const handleDraftPhaseTitleChange = (phaseId: number, title: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => (phase.id === phaseId ? { ...phase, title } : phase))
    )
  }

  const handleDraftSubItemChange = (phaseId: number, nodeId: string, value: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        return {
          ...phase,
          items: updateNodeText(phase.items, nodeId, value),
        }
      })
    )
  }

  const handleAddDraftPhase = () => {
    setPhaseDrafts((previous) => {
      const nextId = previous.reduce((max, phase) => Math.max(max, phase.id), 0) + 1
      return [
        ...previous,
        {
          id: nextId,
          title: `Ítem principal ${previous.length + 1}`,
          items: [buildNewNode('Nuevo ítem')],
        },
      ]
    })
  }

  const handleDeleteDraftPhase = (phaseId: number) => {
    setPhaseDrafts((previous) => previous.filter((phase) => phase.id !== phaseId))
  }

  const handleAddDraftSubItem = (phaseId: number) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) =>
        phase.id === phaseId
          ? {
              ...phase,
              items: [...phase.items, buildNewNode('Nuevo ítem')],
            }
          : phase
      )
    )
  }

  const handleAddDraftChildSubItem = (phaseId: number, parentNodeId: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        return {
          ...phase,
          items: addChildNode(phase.items, parentNodeId, buildNewNode('Nuevo hijo')),
        }
      })
    )
  }

  const handleAddDraftSiblingSubItem = (phaseId: number, siblingNodeId: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        if (findNode(phase.items, siblingNodeId) == null) return phase
        return {
          ...phase,
          items: addSiblingNode(phase.items, siblingNodeId, buildNewNode('Nuevo ítem')),
        }
      })
    )
  }

  const handleDeleteDraftSubItem = (phaseId: number, nodeId: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        const remaining = deleteNode(phase.items, nodeId)
        if (remaining.length === 0) {
          return {
            ...phase,
            items: [buildNewNode('Nuevo ítem')],
          }
        }
        return {
          ...phase,
          items: remaining,
        }
      })
    )
  }

  const handlePhaseDragStart = (e: React.DragEvent, index: number) => {
    dragPhaseRef.current = index
    e.dataTransfer.effectAllowed = 'move'
  }

  const handlePhaseDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverPhaseIndex !== index) setDragOverPhaseIndex(index)
  }

  const handlePhaseDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const fromIndex = dragPhaseRef.current
    dragPhaseRef.current = null
    setDragOverPhaseIndex(null)
    if (fromIndex === null || fromIndex === dropIndex) return
    setPhaseDrafts((prev) => {
      const next = [...prev]
      const [removed] = next.splice(fromIndex, 1)
      next.splice(dropIndex, 0, removed)
      return next
    })
  }

  const handlePhaseDragEnd = () => {
    dragPhaseRef.current = null
    setDragOverPhaseIndex(null)
  }

  const handleSubItemDragStart = (e: React.DragEvent, phaseId: number, index: number) => {
    dragSubItemRef.current = { phaseId, index }
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }

  const handleSubItemDragOver = (e: React.DragEvent, phaseId: number, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (!dragOverSubItem || dragOverSubItem.phaseId !== phaseId || dragOverSubItem.index !== index) {
      setDragOverSubItem({ phaseId, index })
    }
  }

  const handleSubItemDrop = (e: React.DragEvent, phaseId: number, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const from = dragSubItemRef.current
    dragSubItemRef.current = null
    setDragOverSubItem(null)
    if (!from || from.phaseId !== phaseId || from.index === dropIndex) return
    setPhaseDrafts((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase
        const items = [...phase.items]
        const [removed] = items.splice(from.index, 1)
        items.splice(dropIndex, 0, removed)
        return { ...phase, items }
      })
    )
  }

  const handleSubItemDragEnd = () => {
    dragSubItemRef.current = null
    setDragOverSubItem(null)
  }

  const handleSaveStructure = async () => {
    if (!canEditStructure) return
    const normalized = normalizePlaybookPhases(phaseDrafts)
      .map((phase, index) => ({
        id: index + 1,
        title: phase.title.trim(),
        items: phase.items,
      }))
      .filter((phase) => phase.title.length > 0 || phase.items.length > 0)

    if (normalized.length === 0) {
      setStructureError('Debes conservar al menos un ítem principal.')
      return
    }

    const hasInvalidPhase = normalized.some(
      (phase) => !phase.title || phase.items.length === 0 || countNodes(phase.items) === 0
    )
    if (hasInvalidPhase) {
      setStructureError('Cada ítem principal debe tener título y al menos un subítem.')
      return
    }

    setStructureSaving(true)
    setStructureError(null)
    try {
      const ok = await onSavePhases(normalized)
      if (!ok) {
        setStructureError('No se pudo guardar la edición del contenido.')
        return
      }

      setIsStructureEditing(false)
      setPhaseDrafts(normalized)
      setActiveTaskId(null)
    } finally {
      setStructureSaving(false)
    }
  }

  const handleStartMetaEdit = () => {
    if (!canEditMeta) return
    setMetaTitleDraft(sourceDisplayTitle)
    setMetaObjectiveDraft(result.objective)
    setMetaThumbnailUrl(result.thumbnailUrl ?? null)
    setMetaThumbnailPreview(result.thumbnailUrl ?? null)
    setMetaError(null)
    setMetaThumbError(null)
    setIsMetaEditing(true)
  }

  const handleCancelMetaEdit = () => {
    setIsMetaEditing(false)
    setMetaError(null)
    setMetaThumbError(null)
  }

  const handleMetaThumbSelect = async (file: File) => {
    if (!canEditMeta) return
    setMetaThumbError(null)
    setIsUploadingMetaThumb(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract/thumbnail', { method: 'POST', body: formData })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok) {
        setMetaThumbError(data?.error ?? 'No se pudo subir la imagen.')
        return
      }
      const url = data?.url ?? null
      setMetaThumbnailUrl(url)
      setMetaThumbnailPreview(url)
    } catch {
      setMetaThumbError('Error al subir la imagen.')
    } finally {
      setIsUploadingMetaThumb(false)
    }
  }

  const handleSaveMeta = async () => {
    if (!canEditMeta) return
    setMetaSaving(true)
    const ok = await onSaveMeta({
      title: metaTitleDraft.trim() || 'Sin título',
      thumbnailUrl: metaThumbnailUrl,
      objective: metaObjectiveDraft.trim(),
    })
    setMetaSaving(false)
    if (ok) setIsMetaEditing(false)
    else setMetaError('No se pudo guardar. Intenta de nuevo.')
  }

  const handleClose = () => {
    if (!onClose || closeStage !== 'idle' || isBookClosed) return
    closeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    closeTimersRef.current = []

    setCoverMotion('closing')
    setCloseStage('folding')
    onClose()
  }

  const handleAssignCurrentFolder = (folderId: string | null) => {
    const extractionId = result.id?.trim()
    if (!canManageFolder || !extractionId || !onAssignFolder || isAssigningFolder) return
    setIsAssigningFolder(true)
    void Promise.resolve(onAssignFolder(extractionId, folderId)).finally(() => {
      setIsAssigningFolder(false)
    })
  }

  const handleAddMember = async () => {
    if (!canManageMembers || !onAddMember || memberMutationLoading) return

    const email = memberEmailDraft.trim().toLowerCase()
    if (!email) {
      setMemberError('Debes indicar un correo válido.')
      return
    }

    setMemberError(null)
    const ok = await onAddMember({ email, role: memberRoleDraft })
    if (!ok) {
      setMemberError('No se pudo agregar el miembro.')
      return
    }

    setMemberEmailDraft('')
  }

  const handleRemoveMember = async (memberUserId: string) => {
    if (!canManageMembers || !onRemoveMember || memberMutationLoading) return
    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm('¿Eliminar este miembro del círculo?')
    if (!confirmed) return

    setMemberError(null)
    const ok = await onRemoveMember(memberUserId)
    if (!ok) {
      setMemberError('No se pudo eliminar el miembro.')
    }
  }

  const renderTaskCommentThread = (input: {
    task: InteractiveTask
    comments: InteractiveTaskComment[]
    isCommunityMutating: boolean
    replyParentCommentId: string | null
    replyDraft: string
    compact: boolean
  }) => {
    const roots = buildTaskCommentTree(input.comments)

    const renderNodes = (nodes: TaskCommentNode[], depth: number): JSX.Element => (
      <ul className={depth === 0 ? (input.compact ? 'space-y-3' : 'mt-3 space-y-2') : 'mt-2 space-y-2'}>
        {nodes.map((comment) => {
          const isReplyTarget = input.replyParentCommentId === comment.id
          const commentMenuKey = `${input.task.id}:${comment.id}`
          const isCommentMenuOpen = taskCommentMenuOpenId === commentMenuKey
          const replyThreadKey = `${input.task.id}:${comment.id}`
          const replyCount = comment.replies.length
          const hasReplies = replyCount > 0
          const isRepliesCollapsed =
            hasReplies && collapsedReplyThreadsByCommentKey[replyThreadKey] === true
          const repliesLabel = `${replyCount} ${replyCount === 1 ? 'respuesta' : 'respuestas'}`
          const repliesContainerId = `task-comment-replies-${input.compact ? 'compact' : 'full'}-${input.task.id}-${comment.id}`
          const canHideComment = isOwnerAccess && !isGuestExtraction
          const canDeleteComment =
            isGuestExtraction || (viewerUserId !== null && viewerUserId === comment.userId)
          const canOpenCommentMenu = canDeleteComment || canHideComment
          const isHiddenComment = comment.isHidden === true
          const displayContent =
            !isOwnerAccess && isHiddenComment
              ? 'Comentario oculto por el propietario.'
              : comment.content
          return (
            <li key={comment.id} style={depth > 0 ? { marginLeft: `${Math.min(depth, 5) * 14}px` } : undefined}>
              <div
                className={`rounded-lg border bg-white p-2 dark:bg-slate-900 ${
                  isHiddenComment
                    ? 'border-amber-300/80 bg-amber-50/70 dark:border-amber-800/70 dark:bg-amber-950/20'
                    : depth > 0
                    ? 'border-indigo-200/80 dark:border-indigo-900/60'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare
                    size={input.compact ? 14 : 13}
                    className={`mt-0.5 flex-shrink-0 ${
                      isHiddenComment
                        ? 'text-amber-500 dark:text-amber-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {comment.userName?.trim() || comment.userEmail?.trim() || 'Usuario'}
                          </p>
                          {isOwnerAccess && (
                            <span
                              className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                                isHiddenComment
                                  ? 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300'
                              }`}
                            >
                              {isHiddenComment ? 'Oculto' : 'Visible'}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{displayContent}</p>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          {formatTaskEventDate(comment.createdAt)}
                        </p>
                      </div>
                      {canOpenCommentMenu && (
                        <div className="relative flex-shrink-0" data-task-comment-menu-root="true">
                          <button
                            type="button"
                            onClick={() =>
                              setTaskCommentMenuOpenId((previous) =>
                                previous === commentMenuKey ? null : commentMenuKey
                              )
                            }
                            disabled={input.isCommunityMutating}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            aria-label="Opciones del comentario"
                          >
                            <MoreHorizontal size={13} />
                          </button>
                          {isCommentMenuOpen && (
                            <div className="absolute right-0 top-full z-20 mt-1 min-w-[132px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteTaskComment(input.task, comment.id)}
                                  disabled={input.isCommunityMutating}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                >
                                  <Trash2 size={11} />
                                  Borrar
                                </button>
                              )}
                              {canHideComment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleToggleTaskCommentHidden(
                                      input.task,
                                      comment.id,
                                      comment.isHidden
                                    )
                                  }
                                  disabled={input.isCommunityMutating}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300 dark:hover:bg-amber-900/30"
                                >
                                  {comment.isHidden ? <Eye size={11} /> : <EyeOff size={11} />}
                                  {comment.isHidden ? 'Mostrar' : 'Ocultar'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartTaskReply(input.task.id, comment.id)}
                        disabled={input.isCommunityMutating}
                        className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          isReplyTarget
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isReplyTarget ? 'Respondiendo' : 'Responder'}
                      </button>
                      {hasReplies && (
                        <button
                          type="button"
                          onClick={() => handleToggleTaskCommentReplies(input.task.id, comment.id)}
                          className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-expanded={!isRepliesCollapsed}
                          aria-controls={repliesContainerId}
                        >
                          {isRepliesCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                          {isRepliesCollapsed ? `Ver ${repliesLabel}` : `Ocultar ${repliesLabel}`}
                        </button>
                      )}
                    </div>

                    {isReplyTarget && (
                      <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50/70 p-2 dark:border-indigo-800 dark:bg-indigo-900/20">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={input.replyDraft}
                            autoFocus
                            onChange={(event) =>
                              handleTaskReplyDraftChange(input.task.id, event.target.value)
                            }
                            placeholder="Escribe tu respuesta..."
                            disabled={input.isCommunityMutating}
                            className={`min-w-0 flex-1 rounded-lg border border-indigo-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60 ${
                              input.compact ? 'h-10' : 'h-9'
                            }`}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleAddTaskReply(input.task, comment.id)}
                              disabled={input.isCommunityMutating || input.replyDraft.trim().length === 0}
                              className={`inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40 ${
                                input.compact ? 'h-10' : 'h-9'
                              }`}
                            >
                              Responder
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelTaskReply(input.task.id)}
                              disabled={input.isCommunityMutating}
                              className={`inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 ${
                                input.compact ? 'h-10' : 'h-9'
                              }`}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {hasReplies && !isRepliesCollapsed && (
                <div id={repliesContainerId}>
                  {renderNodes(comment.replies, depth + 1)}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )

    return renderNodes(roots, 0)
  }

  return (
    <div
      ref={panelRef}
      className={`animate-fade-slide relative${isFullscreen ? ' overflow-y-auto h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8' : ''}`}
      style={{
        transition: 'transform 0.55s ease',
        transform:
          closeStage === 'idle'
            ? 'translateY(0) scale(1)'
            : closeStage === 'folding'
              ? 'translateY(0) scale(0.998)'
              : 'translateY(0) scale(0.995)',
        pointerEvents: closeStage === 'idle' && !isPageTurning ? undefined : 'none',
      }}
    >
      <div
        className={`paper-playbook bg-white rounded-sm shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 dark:shadow-none ${
          shouldHideBookContent
            ? 'paper-playbook-closed min-h-screen min-h-[100dvh]'
            : ''
        }`}
        style={{
          transition: 'transform 0.55s ease',
          transform:
            closeStage === 'idle'
              ? 'perspective(1400px) rotateX(0deg)'
              : closeStage === 'folding'
                ? 'perspective(1400px) rotateX(6deg)'
                : 'perspective(1400px) rotateX(0deg)',
        }}
      >
        <span aria-hidden="true" className="paper-playbook-fold" />
        <div
          className={`border-b border-slate-200/80 bg-transparent px-0 pt-5 pb-6 transition-all duration-300 dark:border-slate-800 ${
            shouldHideBookContent
              ? 'max-h-0 -translate-y-2 overflow-hidden opacity-0 py-0'
              : 'max-h-80 translate-y-0 opacity-100'
          }`}
          style={{ marginInline: '4.5%' }}
        >
          {playbookCreatedAt && (
            <div className="mb-1 flex justify-end">
              <p className="paper-playbook-date-note" aria-label={`Creado el ${playbookCreatedAt.date} a las ${playbookCreatedAt.time}`}>
                <span className="paper-playbook-date-note-label">Fecha:</span> {playbookCreatedAt.date}
                <br />
                <span className="paper-playbook-date-note-label">Hora:</span> {playbookCreatedAt.time}
              </p>
            </div>
          )}
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
            <div className="flex flex-wrap items-center justify-start gap-2.5">
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                <Clock size={14} /> Tiempo ahorrado: {result.metadata.savedTime}
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                <Brain size={14} /> Dificultad: {result.metadata.difficulty}
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300">
                <Zap size={14} /> Modo: {getExtractionModeLabel(resolvedMode)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {result.id && onStarResult && (
                <button
                  type="button"
                  onClick={() => onStarResult(!result.isStarred)}
                  aria-label={result.isStarred ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    result.isStarred
                      ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                      : 'border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:text-amber-400'
                  }`}
                >
                  <Star size={13} fill={result.isStarred ? 'currentColor' : 'none'} />
                  {result.isStarred ? 'Favorito' : 'Guardar'}
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                {isFullscreen ? 'Reducir' : 'Ampliar'}
              </button>
              {onClose && isBookOpen && (
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Cerrar playbook"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X size={13} />
                  Cerrar
                </button>
              )}
            </div>
          </div>
          <p className="mx-auto mt-10 mb-3 max-w-3xl text-center text-xl font-bold leading-tight text-slate-700 dark:text-slate-100">
            {sourceDisplayTitle}
          </p>
        </div>
        <div
          className="p-6 border-b border-slate-100 bg-transparent dark:bg-transparent dark:border-slate-800"
          style={{ marginInline: '4.5%' }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {sourceSectionLabel}
              </h2>
              <span
                title={`Carpeta: ${coverFolderLabel}`}
                className="inline-flex min-w-0 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-200"
              >
                <Folder size={12} />
                <span className="max-w-[220px] truncate">{coverFolderLabel}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {result.id && onAssignFolder && canManageFolder && (
                <label className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Folder size={12} />
                  <select
                    value={result.folderId ?? ''}
                    disabled={isAssigningFolder}
                    onChange={(event) => handleAssignCurrentFolder(event.target.value || null)}
                    className="bg-transparent pr-1 outline-none"
                    aria-label="Asignar carpeta"
                  >
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {result.id && !isMetaEditing && canEditMeta && (
                <button
                  type="button"
                  onClick={handleStartMetaEdit}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Pencil size={12} /> Editar
                </button>
              )}
            </div>
          </div>

          {/* ── Tag chips ─────────────────────────────────────────────────── */}
          {result.id && (onAddTag || resultTags.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {resultTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                >
                  #{tag.name}
                  {onRemoveTag && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveTag(tag.id)}
                      disabled={tagLoading}
                      aria-label={`Eliminar tag ${tag.name}`}
                      className="ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
                    >
                      <X size={9} />
                    </button>
                  )}
                </span>
              ))}
              {onAddTag && (
                <div className="relative">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); setShowTagDropdown(true) }}
                    onKeyDown={(e) => void handleTagKeyDown(e)}
                    onFocus={() => setShowTagDropdown(true)}
                    onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)}
                    placeholder="+ tag"
                    disabled={tagLoading}
                    className="h-6 w-20 rounded-full border border-dashed border-slate-300 bg-transparent px-2 text-[11px] text-slate-500 outline-none placeholder:text-slate-300 focus:border-indigo-400 focus:text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-400 dark:focus:border-indigo-500"
                  />
                  {showTagDropdown && filteredTagSuggestions.length > 0 && (
                    <div className="absolute left-0 top-full z-30 mt-1 min-w-[140px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      {filteredTagSuggestions.slice(0, 6).map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); void handlePickSuggestion(tag) }}
                          className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <span className="inline-block h-2 w-2 rounded-full bg-indigo-400" />
                          #{tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row">
              {/* Thumbnail — edit or display */}
              {isMetaEditing ? (
                <div className="flex flex-col gap-2 w-full md:w-56 shrink-0">
                  <div className="relative h-32 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {metaThumbnailPreview ? (
                      <Image
                        src={metaThumbnailPreview}
                        alt="Miniatura"
                        fill
                        sizes="224px"
                        className="object-cover"
                      />
                    ) : (
                      <ImageIcon size={28} className="text-slate-400 dark:text-slate-600" />
                    )}
                    {isUploadingMetaThumb && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <Loader2 size={24} className="animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  {metaCloudinaryAvailable === true && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => metaThumbInputRef.current?.click()}
                        disabled={isUploadingMetaThumb}
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Upload size={11} /> {metaThumbnailPreview ? 'Cambiar' : 'Subir'}
                      </button>
                      {metaThumbnailPreview && (
                        <button
                          type="button"
                          onClick={() => { setMetaThumbnailUrl(null); setMetaThumbnailPreview(null) }}
                          disabled={isUploadingMetaThumb}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  )}
                  <input
                    ref={metaThumbInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleMetaThumbSelect(file)
                      e.target.value = ''
                    }}
                  />
                  {metaThumbError && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">{metaThumbError}</p>
                  )}
                </div>
              ) : result.thumbnailUrl ? (
                <div className="relative h-32 w-full md:w-56">
                  <Image
                    src={result.thumbnailUrl}
                    alt={result.videoTitle ?? 'Miniatura del video'}
                    fill
                    sizes="(min-width: 768px) 224px, 100vw"
                    className="rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                </div>
              ) : (
                <div className="h-32 w-full rounded-xl bg-slate-100 border border-slate-200 md:w-56 dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-600">
                  {resolvedSourceType === 'youtube' && <Play size={32} />}
                  {resolvedSourceType === 'web_url' && <Globe size={32} />}
                  {(resolvedSourceType === 'pdf' || resolvedSourceType === 'docx') && <FileText size={32} />}
                  {resolvedSourceType === 'text' && <AlignLeft size={32} />}
                  {resolvedSourceType === 'manual' && <PenLine size={32} />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {isMetaEditing && (
                  <input
                    type="text"
                    value={metaTitleDraft}
                    onChange={(e) => setMetaTitleDraft(e.target.value)}
                    maxLength={300}
                    placeholder="Título"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                )}
                {sourceUrl && (
                  <p className={`break-all text-xs text-slate-500 dark:text-slate-400 ${isMetaEditing ? 'mt-2' : 'mt-0'}`}>
                    {sourceUrl}
                  </p>
                )}
                {(result.orderNumber || result.id) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {result.orderNumber && result.orderNumber > 0 && (
                      <p className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">
                        #{result.orderNumber}
                      </p>
                    )}
                    {result.id && (
                      <p className="inline-flex max-w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <span className="truncate" title={result.id}>
                          ID: {result.id}
                        </span>
                      </p>
                    )}
                    {result.id && canManageVisibility && (
                      <div className="inline-flex h-7 items-center overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => onShareVisibilityChange('private')}
                          disabled={shareVisibilityLoading}
                          className={`h-full px-2 text-[11px] font-semibold transition-colors ${
                            shareVisibility === 'private'
                              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                          aria-label="Marcar contenido como privado"
                        >
                          Privado
                        </button>
                        <button
                          type="button"
                          onClick={() => onShareVisibilityChange('circle')}
                          disabled={shareVisibilityLoading}
                          className={`h-full px-2 text-[11px] font-semibold transition-colors ${
                            shareVisibility === 'circle'
                              ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-sky-950'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                          aria-label="Marcar contenido como círculo"
                        >
                          Círculo
                        </button>
                        <button
                          type="button"
                          onClick={() => onShareVisibilityChange('unlisted')}
                          disabled={shareVisibilityLoading}
                          className={`h-full px-2 text-[11px] font-semibold transition-colors ${
                            shareVisibility === 'unlisted'
                              ? 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                          aria-label="Marcar contenido como solo con enlace"
                        >
                          Enlace
                        </button>
                        <button
                          type="button"
                          onClick={() => onShareVisibilityChange('public')}
                          disabled={shareVisibilityLoading}
                          className={`h-full px-2 text-[11px] font-semibold transition-colors ${
                            shareVisibility === 'public'
                              ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                          aria-label="Marcar contenido como público"
                        >
                          Público
                        </button>
                      </div>
                    )}
                    {result.id && !canManageVisibility && (
                      <span className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-700 dark:bg-sky-900/25 dark:text-sky-300">
                        Visibilidad: {getShareVisibilityLabel(shareVisibility)}
                      </span>
                    )}
                    {result.id && (
                      <button
                        type="button"
                        onClick={handleCopyExtractionId}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        aria-label="Copiar ID único"
                      >
                        <Copy size={12} />
                        {idCopied ? 'Copiado' : 'Copiar'}
                      </button>
                    )}
                    {result.id && (
                      <button
                        type="button"
                        onClick={handleCopyPlaybookReference}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/25 dark:text-violet-200 dark:hover:bg-violet-900/40"
                        aria-label="Copiar enlace interno de playbook"
                      >
                        <Link2 size={12} />
                        {playbookLinkCopied ? 'Link copiado' : 'Link interno'}
                      </button>
                    )}
                    {result.id && canManageVisibility && (
                      <button
                        type="button"
                        onClick={onCopyShareLink}
                        disabled={shareLoading || !isShareableVisibility}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-wait disabled:opacity-70 dark:border-violet-700 dark:bg-violet-900/25 dark:text-violet-300 dark:hover:bg-violet-900/40"
                        aria-label="Compartir extracción"
                      >
                        <Share2 size={12} />
                        {shareLoading
                          ? 'Compartiendo...'
                          : !isShareableVisibility
                            ? 'Público o enlace'
                            : shareCopied
                              ? 'Compartido'
                              : 'Compartir'}
                      </button>
                    )}
                  </div>
                )}
                {result.id && canManageMembers && shareVisibility === 'circle' && (
                  <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-800 dark:bg-sky-900/20">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                      Miembros del Círculo
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={memberEmailDraft}
                        onChange={(event) => setMemberEmailDraft(event.target.value)}
                        placeholder="correo@dominio.com"
                        disabled={memberMutationLoading}
                        className="h-8 min-w-0 flex-1 rounded-md border border-sky-200 bg-white px-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-sky-800 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <select
                        value={memberRoleDraft}
                        onChange={(event) => setMemberRoleDraft(event.target.value === 'editor' ? 'editor' : 'viewer')}
                        disabled={memberMutationLoading}
                        className="h-8 rounded-md border border-sky-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none dark:border-sky-800 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleAddMember()}
                        disabled={memberMutationLoading || !memberEmailDraft.trim()}
                        className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                      >
                        <Plus size={12} />
                        Agregar
                      </button>
                    </div>
                    {memberError && (
                      <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">{memberError}</p>
                    )}
                    {membersLoading ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Cargando miembros...</p>
                    ) : members.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Aún no hay miembros en este círculo.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {members.map((member) => (
                          <li
                            key={member.userId}
                            className="flex items-center justify-between gap-2 rounded-md border border-sky-100 bg-white px-2 py-1.5 text-xs dark:border-sky-900 dark:bg-slate-900"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-700 dark:text-slate-200">
                                {member.userName?.trim() || member.userEmail}
                              </p>
                              <p className="truncate text-slate-500 dark:text-slate-400">
                                {member.userEmail} · {member.role}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleRemoveMember(member.userId)}
                              disabled={memberMutationLoading}
                              className="inline-flex h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
                            >
                              Quitar
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-[22rem] lg:shrink-0">
              <div ref={rightControlsRef} className="flex flex-col gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-slate-700 dark:bg-slate-800/45">
                <button
                  type="button"
                  onClick={handleToggleActions}
                  aria-expanded={isActionsExpanded}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-700/30"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                      Acciones y Exportación
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {isActionsExpanded
                        ? 'Selecciona una acción o exportación.'
                        : 'Haz clic para desplegar opciones.'}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-500 ease-out dark:text-slate-300 ${
                      isActionsExpanded ? 'rotate-180' : 'rotate-0'
                    }`}
                  />
                </button>

                <div
                  aria-hidden={!isActionsExpanded}
                  className={`grid transition-[grid-template-rows,opacity,margin-top] duration-700 ease-out ${
                    isActionsExpanded
                      ? 'visible mt-3 grid-rows-[1fr] opacity-100'
                      : 'invisible mt-0 grid-rows-[0fr] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div
                      className={`transition-transform duration-700 ease-out ${
                        isActionsExpanded ? 'translate-y-0' : '-translate-y-2'
                      }`}
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                        <button
                          onClick={() => triggerAsyncAction(onDownloadPdf)}
                          disabled={isExportingPdf}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Download size={15} />
                          {isExportingPdf ? 'Generando...' : 'Guardar PDF'}
                        </button>

                        <button
                          onClick={() => triggerAsyncAction(onCopyShareLink)}
                          disabled={!canManageVisibility || !result.id || shareLoading || !isShareableVisibility}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Share2 size={15} />
                          {shareLoading
                            ? 'Generando...'
                            : !isShareableVisibility
                              ? 'Público o enlace'
                              : shareCopied
                                ? 'Copiado'
                                : 'Compartir'}
                        </button>

                        <button
                          onClick={() => triggerInstantAction(onCopyMarkdown)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Copy size={15} />
                          Copiar Markdown
                        </button>
                      </div>

                      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                          Integraciones
                        </p>

                        <div className="mt-2 grid grid-cols-1 gap-2">
                          {notionConnected ? (
                            <button
                              onClick={() => triggerAsyncAction(onExportToNotion)}
                              disabled={!result.id || notionExportLoading}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              <Zap size={14} />
                              {notionExportLoading ? 'Exportando a Notion...' : 'Exportar a Notion'}
                            </button>
                          ) : (
                            <button
                              onClick={() => triggerAsyncAction(onConnectNotion)}
                              disabled={notionLoading || !notionConfigured}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              <Zap size={14} />
                              {notionLoading
                                ? 'Conectando Notion...'
                                : notionConfigured
                                  ? 'Conectar Notion'
                                  : 'Notion no configurado'}
                            </button>
                          )}

                          {trelloConnected ? (
                            <button
                              onClick={() => triggerAsyncAction(onExportToTrello)}
                              disabled={!result.id || trelloExportLoading}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              <Zap size={14} />
                              {trelloExportLoading ? 'Exportando a Trello...' : 'Exportar a Trello'}
                            </button>
                          ) : (
                            <button
                              onClick={() => triggerAsyncAction(onConnectTrello)}
                              disabled={trelloLoading || !trelloConfigured}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              <Zap size={14} />
                              {trelloLoading
                                ? 'Conectando Trello...'
                                : trelloConfigured
                                  ? 'Conectar Trello'
                                  : 'Trello no configurado'}
                            </button>
                          )}

                          {todoistConnected ? (
                            <button
                              onClick={() => triggerAsyncAction(onExportToTodoist)}
                              disabled={!result.id || todoistExportLoading}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              <Zap size={14} />
                              {todoistExportLoading ? 'Exportando a Todoist...' : 'Exportar a Todoist'}
                            </button>
                          ) : (
                            <button
                              onClick={() => triggerAsyncAction(onConnectTodoist)}
                              disabled={todoistLoading || !todoistConfigured}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              <Zap size={14} />
                              {todoistLoading
                                ? 'Conectando Todoist...'
                                : todoistConfigured
                                  ? 'Conectar Todoist'
                                  : 'Todoist no configurado'}
                            </button>
                          )}

                          {googleDocsConnected ? (
                            <button
                              onClick={() => triggerAsyncAction(onExportToGoogleDocs)}
                              disabled={!result.id || googleDocsExportLoading}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              <Zap size={14} />
                              {googleDocsExportLoading
                                ? 'Exportando a Google Docs...'
                                : 'Exportar a Google Docs'}
                            </button>
                          ) : (
                            <button
                              onClick={() => triggerAsyncAction(onConnectGoogleDocs)}
                              disabled={googleDocsLoading || !googleDocsConfigured}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                            >
                              <Zap size={14} />
                              {googleDocsLoading
                                ? 'Conectando Google Docs...'
                                : googleDocsConfigured
                                  ? 'Conectar Google Docs'
                                  : 'Google Docs no configurado'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {notionConnected && notionWorkspaceName && (
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            Notion: {notionWorkspaceName}
                          </span>
                        )}
                        {trelloConnected && trelloUsername && (
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            Trello: @{trelloUsername}
                          </span>
                        )}
                        {todoistConnected && todoistUserLabel && (
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            Todoist: {todoistUserLabel}
                          </span>
                        )}
                        {googleDocsConnected && googleDocsUserEmail && (
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            Google: {googleDocsUserEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                </div>

                {sourceUrl && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                    <button
                      type="button"
                      onClick={handleToggleReextract}
                      aria-expanded={isReextractExpanded}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-indigo-100/70 dark:hover:bg-indigo-900/20"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                          Re-extraer en otro modo
                        </p>
                        <p className="mt-0.5 text-[11px] text-indigo-500/90 dark:text-indigo-300/80">
                          {isReextractExpanded
                            ? 'Selecciona un modo para generar una nueva extracción.'
                            : 'Haz clic para desplegar opciones.'}
                        </p>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-indigo-500 transition-transform duration-500 ease-out dark:text-indigo-300 ${
                          isReextractExpanded ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                    </button>

                    <div
                      aria-hidden={!isReextractExpanded}
                      className={`grid transition-[grid-template-rows,opacity,margin-top] duration-700 ease-out ${
                        isReextractExpanded
                          ? 'visible mt-3 grid-rows-[1fr] opacity-100'
                          : 'invisible mt-0 grid-rows-[0fr] opacity-0 pointer-events-none'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div
                          className={`transition-transform duration-700 ease-out ${
                            isReextractExpanded ? 'translate-y-0' : '-translate-y-2'
                          }`}
                        >
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            Usa este mismo video sin copiar la URL para descubrir los otros modos.
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {EXTRACTION_MODE_OPTIONS.map((option) => {
                              const isActive = option.value === resolvedMode
                              const isDisabled = isProcessing || isActive

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => triggerReextractMode(option.value)}
                                  disabled={isDisabled}
                                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                                    isActive
                                      ? 'border-indigo-300 bg-white text-indigo-700 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300'
                                      : isProcessing
                                        ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
                                        : 'border-indigo-100 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-100/60 dark:border-indigo-900/60 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40'
                                  }`}
                                >
                                  <p className="text-sm font-semibold">
                                    {option.label}
                                    {isActive ? ' (actual)' : ''}
                                  </p>
                                  <p className="mt-0.5 text-xs opacity-80">{option.description}</p>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className="bg-slate-50 p-6 border-b border-slate-100 dark:bg-slate-800/40 dark:border-slate-800"
          style={{ marginInline: '4.5%' }}
        >
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Objetivo del Resultado
          </h2>
          {isMetaEditing ? (
            <div>
              <textarea
                value={metaObjectiveDraft}
                onChange={(e) => setMetaObjectiveDraft(e.target.value)}
                rows={4}
                placeholder="Objetivo de la extracción"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
              />
              {metaError && (
                <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{metaError}</p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelMetaEdit}
                  disabled={metaSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveMeta()}
                  disabled={metaSaving || isUploadingMetaThumb}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  {metaSaving ? (
                    <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                  ) : (
                    <><Save size={14} /> Guardar cambios</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-lg font-medium text-slate-800 leading-relaxed dark:text-slate-100">
              {renderTextWithPlaybookReferences(result.objective)}
            </p>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ítems y Subítems</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Define y organiza la estructura accionable del contenido.
              </p>
            </div>
            {result.id && !isStructureEditing && canEditStructure && (
              <button
                type="button"
                onClick={handleStartStructureEditing}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
              >
                <Pencil size={14} />
                Editar contenido
              </button>
            )}
          </div>

          {isStructureEditing && (
            <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
              {structureError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                  {structureError}
                </p>
              )}

              <div className="space-y-3">
                {phaseDrafts.map((phase, phaseIndex) => (
                  <div
                    key={phase.id}
                    draggable={!structureSaving}
                    onDragStart={(e) => handlePhaseDragStart(e, phaseIndex)}
                    onDragOver={(e) => handlePhaseDragOver(e, phaseIndex)}
                    onDrop={(e) => handlePhaseDrop(e, phaseIndex)}
                    onDragEnd={handlePhaseDragEnd}
                    className={`rounded-xl border bg-white p-3 transition-colors dark:bg-slate-900 ${
                      dragOverPhaseIndex === phaseIndex && dragPhaseRef.current !== phaseIndex
                        ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-900/20'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex-shrink-0 cursor-grab touch-none text-slate-300 active:cursor-grabbing dark:text-slate-600"
                        title="Arrastrar para reordenar"
                      >
                        <GripVertical size={16} />
                      </span>
                      <input
                        type="text"
                        value={phase.title}
                        onChange={(event) => handleDraftPhaseTitleChange(phase.id, event.target.value)}
                        placeholder="Título del ítem principal"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteDraftPhase(phase.id)}
                        disabled={phaseDrafts.length <= 1 || structureSaving}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                        aria-label={`Eliminar ítem principal ${phase.title || phase.id}`}
                      >
                        <Trash2 size={13} />
                        Borrar
                      </button>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/30">
                      <p className="mb-2 pl-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                        Subítems
                      </p>
                      <div className="ml-2 space-y-2 border-l border-dashed border-slate-300 pl-3 dark:border-slate-600">
                        {flattenPhaseNodes(phase.id, phase.items).map((node) => {
                          const canDelete = countNodes(phase.items) > 1
                          return (
                            <div
                              key={`${phase.id}-draft-item-${node.nodeId}`}
                              className="rounded-lg border border-slate-200/80 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                              style={{ marginLeft: `${Math.max(0, node.depth - 1) * 14}px` }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-6 min-w-[2.3rem] items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 font-mono text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  {node.fullPath}
                                </span>
                                <input
                                  type="text"
                                  value={node.text}
                                  onChange={(event) =>
                                    handleDraftSubItemChange(phase.id, node.nodeId, event.target.value)
                                  }
                                  placeholder="Texto del ítem"
                                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddDraftChildSubItem(phase.id, node.nodeId)}
                                  disabled={structureSaving}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-2 text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-900/25 dark:text-sky-300 dark:hover:bg-sky-900/40"
                                  title="Agregar hijo"
                                  aria-label="Agregar hijo"
                                >
                                  <Plus size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddDraftSiblingSubItem(phase.id, node.nodeId)}
                                  disabled={structureSaving}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                  title="Agregar hermano"
                                  aria-label="Agregar hermano"
                                >
                                  <Plus size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDraftSubItem(phase.id, node.nodeId)}
                                  disabled={!canDelete || structureSaving}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                  aria-label="Eliminar ítem"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddDraftSubItem(phase.id)}
                      disabled={structureSaving}
                      className="mt-3 ml-2 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Plus size={13} />
                      Agregar ítem raíz
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddDraftPhase}
                  disabled={structureSaving}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                >
                  <Plus size={14} />
                  Agregar ítem principal
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveStructure()}
                  disabled={structureSaving}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {structureSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar cambios
                </button>
                <button
                  type="button"
                  onClick={handleCancelStructureEditing}
                  disabled={structureSaving}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X size={14} />
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!isStructureEditing &&
            result.phases.map((phase: Phase) => {
              const isPhaseExpanded = activePhase === phase.id

              return (
                <div
                  key={phase.id}
                  className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:border-indigo-200 hover:shadow-sm group dark:border-slate-700 dark:hover:border-indigo-700"
                >
                  <button
                    onClick={() => onTogglePhase(phase.id)}
                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                          isPhaseExpanded
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-700 dark:text-slate-300 dark:group-hover:bg-indigo-900/40 dark:group-hover:text-indigo-300'
                        }`}
                      >
                        {phase.id}
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{phase.title}</span>
                    </div>
                    {isPhaseExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </button>

                  <div
                    aria-hidden={!isPhaseExpanded}
                    className={`grid transition-[grid-template-rows,opacity] duration-700 ease-out ${
                      isPhaseExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div
                        className={`border-t border-slate-100 bg-slate-50/50 p-4 pt-0 transition-transform duration-700 ease-out dark:border-slate-800 dark:bg-slate-800/40 ${
                          isPhaseExpanded ? 'translate-y-0' : '-translate-y-2 pointer-events-none'
                        }`}
                      >
                        <div className="mt-4 space-y-2">
                          {tasksLoading && (
                            <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                              <Loader2 size={13} className="animate-spin" />
                              Sincronizando checklist interactivo...
                            </p>
                          )}
                          {tasksError && (
                            <p className="text-xs font-medium text-rose-600 dark:text-rose-300">{tasksError}</p>
                          )}
                          {!result.id && (
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              Para guardar el avance necesitas una extracción persistida en historial.
                            </p>
                          )}
                        </div>

                        <div className="mt-4">
                          <div className="mb-3 flex items-center gap-2">
                            <CheckCircle2 size={14} className="text-indigo-400 dark:text-indigo-500" />
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                              Subítems
                            </p>
                          </div>
                          <ul className="space-y-3 md:ml-2 md:space-y-4 md:border-l-2 md:border-dashed md:border-slate-300 md:pl-4 md:dark:border-slate-700">
                            {flattenPhaseNodes(phase.id, phase.items).map((node, idx) => {
                              const itemText = node.text
                              const normalizedItemText =
                                typeof itemText === 'string' ? itemText : itemText == null ? '' : String(itemText)
                              const itemDisplayText = normalizedItemText.trim()
                                ? renderTextWithPlaybookReferences(normalizedItemText)
                                : 'Subítem sin texto'
                              const subItemNumber = node.fullPath
                              const task =
                                tasksByNodeId.get(node.nodeId) ??
                                tasksByPhaseItem.get(`${phase.id}:${idx}`) ??
                                null
                              const isTaskMutating = task ? taskMutationLoadingId === task.id : false
                              const taskAttachments = task ? (taskAttachmentsByTaskId[task.id] ?? []) : []
                              const taskAttachmentError = task
                                ? (taskAttachmentErrorByTaskId[task.id] ?? null)
                                : null
                              const taskYoutubeDraft = task
                                ? (youtubeAttachmentDraftByTaskId[task.id] ?? '')
                                : ''
                              const isTaskAttachmentLoading = task
                                ? taskAttachmentLoadingId === task.id
                                : false
                              const isTaskAttachmentMutating = task
                                ? taskAttachmentMutationId === task.id
                                : false
                              const taskComments = task ? (taskCommentsByTaskId[task.id] ?? []) : []
                              const taskLikeSummary = task
                                ? (taskLikeSummaryByTaskId[task.id] ?? {
                                    taskId: task.id,
                                    extractionId: task.extractionId,
                                    likesCount: 0,
                                    likedByMe: false,
                                    sharesCount: 0,
                                    sharedByMe: false,
                                    followersCount: 0,
                                    followingByMe: false,
                                    viewsCount: 0,
                                    viewedByMe: false,
                                  })
                                : null
                              const taskCommentDraft = task ? (taskCommentDraftByTaskId[task.id] ?? '') : ''
                              const taskReplyDraft = task ? (taskReplyDraftByTaskId[task.id] ?? '') : ''
                              const taskReplyParentCommentId = task
                                ? (taskReplyParentByTaskId[task.id] ?? null)
                                : null
                              const isTaskShareCopied = task
                                ? (taskShareCopiedByTaskId[task.id] ?? false)
                                : false
                              const taskCommunityError = task
                                ? (taskCommunityErrorByTaskId[task.id] ?? null)
                                : null
                              const isTaskCommunityLoading = task
                                ? taskCommunityLoadingId === task.id
                                : false
                              const isTaskCommunityMutating = task
                                ? taskCommunityMutationId === task.id
                                : false
                              const openSection = task
                                ? (taskOpenSectionByTaskId[task.id] ?? null)
                                : null
                              const isTaskActivityExpanded = openSection === 'actividad'
                              const isTaskGestionExpanded = openSection === 'gestion'
                              // Community shows only for the selected task, and only if not hidden by user
                              const isTaskSelected = task ? task.id === selectedTaskId : false
                              const isTaskCommunityExpanded =
                                isTaskSelected && (taskCommunityOpenByTaskId[task?.id ?? ''] ?? false)
                              // Evidence shows only for the selected task, and only if not hidden by user
                              const isTaskEvidenceExpanded =
                                isTaskSelected && (taskEvidenceOpenByTaskId[task?.id ?? ''] ?? false)
                              // Auto-fetch community the first time the selected task's community becomes visible
                              if (isTaskCommunityExpanded && task && !(task.id in taskCommentsByTaskId) && !autoFetchedCommunityRef.current.has(task.id)) {
                                autoFetchedCommunityRef.current.add(task.id)
                                void fetchTaskCommunity(task.id)
                              }
                              const isTaskEstadoExpanded = task
                                ? (taskEstadoExpandedByTaskId[task.id] ?? false)
                                : false
                              const isTaskAddEvidenceExpanded = task
                                ? (taskAddEvidenceExpandedByTaskId[task.id] ?? false)
                                : false

                              return (
                                <li
                                  key={`${phase.id}-${node.nodeId}`}
                                  id={task ? `task-${task.id}` : undefined}
                                  className={`relative flex flex-col overflow-hidden rounded-xl border bg-white/90 shadow-sm ring-1 transition-all duration-200 dark:bg-slate-900/70 ${
                                    isTaskSelected
                                      ? 'border-indigo-300 ring-indigo-200 shadow-md dark:border-indigo-600 dark:ring-indigo-900/50'
                                      : 'border-slate-200/90 ring-slate-200/70 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:ring-slate-700/70 dark:hover:border-slate-600'
                                  }`}
                                  style={{ marginLeft: `${Math.max(0, node.depth - 1) * 10}px` }}
                                >
                                  <span
                                    aria-hidden="true"
                                    className="hidden md:block absolute -left-[1.1rem] top-5 h-2.5 w-2.5 rounded-full border-2 border-indigo-400 bg-white dark:border-indigo-500 dark:bg-slate-900"
                                  />
                                  <span
                                    aria-hidden="true"
                                    className={`absolute inset-y-0 left-0 w-1 ${
                                      isTaskSelected
                                        ? 'bg-indigo-400 dark:bg-indigo-500'
                                        : 'bg-slate-200/80 dark:bg-slate-700/80'
                                    }`}
                                  />
                                  <div className="order-1 p-3">
                                    {/* Content column — full width */}
                                    <div className="min-w-0">
                                      {/* Top bar: checkbox + index + stats | activity/evidence + status + three-dots */}
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        {/* ── Left: checkbox · number · community stats ── */}
                                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                          <button
                                            type="button"
                                            role="checkbox"
                                            aria-checked={task?.checked ?? false}
                                            disabled={!task || !canEditTaskContent || isTaskMutating}
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              if (!task) return
                                              void handleTaskToggle(task, !task.checked)
                                            }}
                                            className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border-2 shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                                              task?.checked
                                                ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                                                : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-indigo-500'
                                            }`}
                                          >
                                            <Check
                                              size={11}
                                              strokeWidth={3}
                                              className={`text-white transition-all duration-150 ${task?.checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                                            />
                                          </button>
                                          <span className="inline-flex h-6 w-fit min-w-[2.3rem] items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 font-mono text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                            {subItemNumber}
                                          </span>
                                          {/* Community micro-stats */}
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Me gusta">
                                              <ThumbsUp size={10} />
                                              {taskLikeSummary?.likesCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Compartidos">
                                              <Share2 size={10} />
                                              {taskLikeSummary?.sharesCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Seguidores">
                                              <Bell size={10} />
                                              {taskLikeSummary?.followersCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Visualizaciones">
                                              <Eye size={10} />
                                              {taskLikeSummary?.viewsCount ?? 0}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Comentarios">
                                              <MessageSquare size={10} />
                                              {taskComments.length}
                                            </span>
                                          </div>
                                        </div>
                                        {/* ── Right: activity · evidence · status · three-dots ── */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          {task && task.events.length > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Actividad">
                                              <Zap size={10} />
                                              {task.events.length}
                                            </span>
                                          )}
                                          {task && taskAttachments.length > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Evidencias">
                                              <ImageIcon size={10} />
                                              {taskAttachments.length}
                                            </span>
                                          )}
                                          {task && (taskCommentsByTaskId[task.id]?.length ?? 0) > 0 && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500" title="Participantes">
                                              <Users size={10} />
                                              {taskCommentsByTaskId[task.id]?.length ?? 0}
                                            </span>
                                          )}
                                          {task && (
                                            <>
                                              {/* Mobile: icono compacto con color de estado */}
                                              <span
                                                className={`md:hidden inline-flex items-center justify-center rounded-full border p-[3px] ${getTaskStatusChipClassName(task.status)}`}
                                                title={getTaskStatusLabel(task.status)}
                                              >
                                                {task.status === 'completed' && <CheckCircle2 size={10} />}
                                                {task.status === 'in_progress' && <Zap size={10} />}
                                                {task.status === 'blocked' && <AlertTriangle size={10} />}
                                                {task.status === 'pending' && <Clock size={10} />}
                                              </span>
                                              {/* Desktop: chip con texto */}
                                              <span className={`hidden md:inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getTaskStatusChipClassName(task.status)}`}>
                                                {getTaskStatusLabel(task.status)}
                                              </span>
                                            </>
                                          )}
                                          {task && (
                                            <div className="relative hidden md:block" data-task-menu-root="true">
                                              <button
                                                type="button"
                                                onClick={() => setTaskMenuOpenId((prev) => (prev === task.id ? null : task.id))}
                                                className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                              >
                                                <MoreHorizontal size={12} />
                                              </button>
                                              {taskMenuOpenId === task.id && (
                                                <div className="absolute right-0 top-full z-20 mt-1 min-w-[130px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setTaskMenuOpenId(null)
                                                      setTaskOpenSectionByTaskId((prev) => ({
                                                        ...prev,
                                                        [task.id]: prev[task.id] === 'actividad' ? null : 'actividad',
                                                      }))
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                                  >
                                                    <MessageSquare size={10} className="text-slate-400" />
                                                    Actividad
                                                    {task.events.length > 0 && (
                                                      <span className="ml-auto rounded-full bg-slate-100 px-1.5 text-[9px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                                        {task.events.length}
                                                      </span>
                                                    )}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setTaskMenuOpenId(null)
                                                      setTaskOpenSectionByTaskId((prev) => ({
                                                        ...prev,
                                                        [task.id]: prev[task.id] === 'gestion' ? null : 'gestion',
                                                      }))
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                                  >
                                                    <Zap size={10} className="text-slate-400" />
                                                    Gestión
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setTaskMenuOpenId(null)
                                                      setSelectedTaskId(task.id)
                                                      setActiveTaskId(task.id)
                                                      setTaskEvidenceOpenByTaskId((prev) => ({
                                                        ...prev,
                                                        [task.id]: true,
                                                      }))
                                                    }}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                                                  >
                                                    <ImageIcon size={10} className="text-slate-400" />
                                                    Evidencias
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Text — click to select this task (opens community on desktop, sheet on mobile) */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!task) return
                                          if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                            setMobileSheetTaskId(task.id)
                                            setMobileSheetTab('comunidad')
                                          } else {
                                            const nextSelectedTaskId = isTaskSelected ? null : task.id
                                            setSelectedTaskId(nextSelectedTaskId)
                                            setActiveTaskId(nextSelectedTaskId)
                                            if (nextSelectedTaskId) {
                                              setTaskCommunityOpenByTaskId((prev) => ({
                                                ...prev,
                                                [nextSelectedTaskId]: false,
                                              }))
                                              setTaskEvidenceOpenByTaskId((prev) => ({
                                                ...prev,
                                                [nextSelectedTaskId]: false,
                                              }))
                                            }
                                          }
                                        }}
                                        className={`w-full text-left rounded-lg px-1 py-0.5 transition-colors ${
                                          isTaskSelected
                                            ? 'bg-violet-50 dark:bg-violet-900/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                        }`}
                                      >
                                        <span className="text-slate-600 leading-relaxed text-sm dark:text-slate-300">
                                          {itemDisplayText}
                                        </span>
                                      </button>

                                      {isTaskMutating && (
                                        <Loader2 size={14} className="mt-1 animate-spin text-indigo-500 dark:text-indigo-300" />
                                      )}
                                    </div>
                                  </div>{/* p-3 wrapper */}

                                  {/* Actividad inline collapsible (desktop only) */}
                                  <div
                                    aria-hidden={!isTaskActivityExpanded || !task}
                                    className={`order-2 hidden md:grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
                                      isTaskActivityExpanded && task
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div
                                        className={`border-t border-slate-200 p-3 transition-transform duration-500 ease-out dark:border-slate-700 ${
                                          isTaskActivityExpanded && task
                                            ? 'translate-y-0'
                                            : '-translate-y-1 pointer-events-none'
                                        }`}
                                      >
                                        {task && (
                                          <>
                                            <div className="mb-2 flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setTaskOpenSectionByTaskId((prev) => ({
                                                    ...prev,
                                                    [task.id]: null,
                                                  }))
                                                }
                                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                                aria-label="Cerrar actividad"
                                                title="Cerrar actividad"
                                              >
                                                <X size={12} />
                                              </button>
                                            </div>
                                            {task.events.length === 0 ? (
                                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                                No hay eventos registrados todavía.
                                              </p>
                                            ) : (
                                              <ul className="space-y-2">
                                                {task.events.map((event) => (
                                                  <li
                                                    key={event.id}
                                                    className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                                                  >
                                                    <div className="flex items-start gap-2">
                                                      {event.eventType === 'blocker' ? (
                                                        <AlertTriangle size={13} className="mt-0.5 text-rose-500 dark:text-rose-300" />
                                                      ) : event.eventType === 'pending_action' ? (
                                                        <Clock size={13} className="mt-0.5 text-amber-500 dark:text-amber-400" />
                                                      ) : event.eventType === 'resolved' ? (
                                                        <CheckCircle2 size={13} className="mt-0.5 text-emerald-500 dark:text-emerald-400" />
                                                      ) : (
                                                        <Pencil size={13} className="mt-0.5 text-slate-400 dark:text-slate-500" />
                                                      )}
                                                      <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                          {getTaskEventTypeLabel(event.eventType)}
                                                        </p>
                                                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                                                          {event.content}
                                                        </p>
                                                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                                          <span className="font-medium text-slate-500 dark:text-slate-400">
                                                            {event.userName?.trim() || event.userEmail?.trim() || 'Usuario'}
                                                          </span>
                                                          {' · '}
                                                          {formatTaskEventDate(event.createdAt)}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Gestión inline collapsible (desktop only) */}
                                  <div
                                    aria-hidden={!isTaskGestionExpanded || !task}
                                    className={`order-3 hidden md:grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                      isTaskGestionExpanded && task
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
                                        {task && (
                                          <>
                                            <div className="mb-2 flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setTaskOpenSectionByTaskId((prev) => ({
                                                    ...prev,
                                                    [task.id]: null,
                                                  }))
                                                }
                                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                                aria-label="Cerrar gestión"
                                                title="Cerrar gestión"
                                              >
                                                <X size={12} />
                                              </button>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setTaskEstadoExpandedByTaskId((prev) => ({
                                                  ...prev,
                                                  [task.id]: !isTaskEstadoExpanded,
                                                }))
                                              }
                                              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                                            >
                                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                Estado
                                              </span>
                                              <span className="flex items-center gap-2">
                                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getTaskStatusChipClassName(task.status)}`}>
                                                  {getTaskStatusLabel(task.status)}
                                                </span>
                                                {isTaskEstadoExpanded ? (
                                                  <ChevronUp size={12} className="text-slate-400" />
                                                ) : (
                                                  <ChevronDown size={12} className="text-slate-400" />
                                                )}
                                              </span>
                                            </button>
                                            <div
                                              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                                isTaskEstadoExpanded
                                                  ? 'grid-rows-[1fr] opacity-100'
                                                  : 'grid-rows-[0fr] opacity-0'
                                              }`}
                                            >
                                              <div className="overflow-hidden">
                                                <div className="grid grid-cols-2 gap-1.5 pt-2">
                                                  {TASK_STATUS_OPTIONS.map((option) => {
                                                    const isActive = task.status === option.value
                                                    return (
                                                      <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => void handleTaskStatusChange(task, option.value)}
                                                        disabled={!canEditTaskContent || isTaskMutating || isActive}
                                                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-semibold transition-all disabled:cursor-not-allowed ${
                                                          isActive
                                                            ? option.chipClassName + ' shadow-sm'
                                                            : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:text-slate-300'
                                                        }`}
                                                      >
                                                        {option.value === 'completed' && <CheckCircle2 size={11} />}
                                                        {option.value === 'in_progress' && <Zap size={11} />}
                                                        {option.value === 'blocked' && <AlertTriangle size={11} />}
                                                        {option.value === 'pending' && <Clock size={11} />}
                                                        {option.label}
                                                      </button>
                                                    )
                                                  })}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="mt-4">
                                              <p className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                Registrar en actividad
                                              </p>
                                              <input
                                                type="text"
                                                value={eventDraftContent}
                                                onChange={(event) => setEventDraftContent(event.target.value)}
                                                onKeyDown={(event) => {
                                                  if (event.key === 'Enter' && !event.shiftKey && eventDraftContent.trim()) {
                                                    void handleAddTaskEvent(task, 'note')
                                                  }
                                                }}
                                                placeholder="Escribe una observación, acción o bloqueo..."
                                                disabled={!canEditTaskContent || isTaskMutating}
                                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                              />
                                              <div className="mt-2 flex flex-wrap gap-1.5">
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'note')} disabled={!canEditTaskContent || isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"><Pencil size={11} />Observación</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'pending_action')} disabled={!canEditTaskContent || isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"><Clock size={11} />Acción pendiente</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'blocker')} disabled={!canEditTaskContent || isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"><AlertTriangle size={11} />Impedimento</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'resolved')} disabled={!canEditTaskContent || isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"><CheckCircle2 size={11} />Resuelto</button>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Comunidad — solo visible cuando el ítem está seleccionado (desktop only) */}
                                  {isTaskSelected && task && (
                                    <div className="order-5 hidden md:block border-t border-slate-100 dark:border-slate-800">
                                      {/* Header siempre visible: toggle comunidad */}
                                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2 pb-1">
                                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setTaskCommunityOpenByTaskId((prev) => ({
                                                ...prev,
                                                [task.id]: !(prev[task.id] ?? true),
                                              }))
                                            }}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 transition-colors"
                                          >
                                            <MessageSquare size={12} />
                                            Comunidad
                                            {isTaskCommunityExpanded ? (
                                              <ChevronUp size={10} className="opacity-60" />
                                            ) : (
                                              <ChevronDown size={10} className="opacity-60" />
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setTaskCommunityOpenByTaskId((prev) => ({
                                                ...prev,
                                                [task.id]: true,
                                              }))
                                              handleCancelTaskReply(task.id)
                                            }}
                                            className="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[11px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                          >
                                            <MessageSquare size={11} />
                                            Comentar
                                          </button>
                                          {taskLikeSummary && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => void handleToggleTaskLike(task)}
                                                disabled={isTaskCommunityMutating}
                                                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                  taskLikeSummary.likedByMe
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50'
                                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                                }`}
                                              >
                                                <ThumbsUp size={11} />
                                                Me gusta
                                                <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                  {taskLikeSummary.likesCount}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void handleShareTask(task)}
                                                disabled={isTaskCommunityMutating}
                                                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                  isTaskShareCopied
                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40'
                                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                                }`}
                                              >
                                                <Share2 size={11} />
                                                {isTaskShareCopied ? 'Copiado' : 'Compartir'}
                                                <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                  {taskLikeSummary.sharesCount ?? 0}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void handleToggleTaskFollow(task)}
                                                disabled={isTaskCommunityMutating || isGuestExtraction}
                                                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                  taskLikeSummary.followingByMe
                                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50'
                                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                                }`}
                                              >
                                                <Bell size={11} />
                                                {taskLikeSummary.followingByMe ? 'Siguiendo' : 'Seguir'}
                                                <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                  {taskLikeSummary.followersCount ?? 0}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void fetchTaskCommunity(task.id)}
                                                disabled={isTaskCommunityLoading || isTaskCommunityMutating}
                                                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                                              >
                                                <Eye size={11} />
                                                Vistas
                                                <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                  {taskLikeSummary.viewsCount ?? 0}
                                                </span>
                                              </button>
                                            </>
                                          )}
                                        </div>
                                        {(isTaskCommunityLoading || isTaskCommunityMutating) && (
                                          <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            <Loader2 size={12} className="animate-spin" />
                                            Actualizando...
                                          </p>
                                        )}
                                      </div>

                                      {/* Contenido colapsable */}
                                      <div
                                        aria-hidden={!isTaskCommunityExpanded}
                                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                          isTaskCommunityExpanded
                                            ? 'grid-rows-[1fr] opacity-100'
                                            : 'grid-rows-[0fr] opacity-0'
                                        }`}
                                      >
                                        <div className="overflow-hidden">
                                          <div className="px-3 pb-3">
                                            {taskCommunityError && (
                                              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                                                {taskCommunityError}
                                              </p>
                                            )}

                                            <div className="mt-2 flex gap-2">
                                              <input
                                                type="text"
                                                value={taskCommentDraft}
                                                onChange={(event) =>
                                                  handleTaskCommentDraftChange(task.id, event.target.value)
                                                }
                                                placeholder="Escribe un comentario para este subítem..."
                                                disabled={isTaskCommunityMutating}
                                                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => void handleAddTaskComment(task)}
                                                disabled={isTaskCommunityMutating || taskCommentDraft.trim().length === 0}
                                                className="inline-flex h-9 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                              >
                                                Comentar
                                              </button>
                                            </div>

                                            {isTaskCommunityLoading ? (
                                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                Cargando comentarios...
                                              </p>
                                            ) : taskComments.length === 0 ? (
                                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                Aún no hay comentarios en este subítem.
                                              </p>
                                            ) : (
                                              renderTaskCommentThread({
                                                task,
                                                comments: taskComments,
                                                isCommunityMutating: isTaskCommunityMutating,
                                                replyParentCommentId: taskReplyParentCommentId,
                                                replyDraft: taskReplyDraft,
                                                compact: false,
                                              })
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Evidencias inline collapsible (desktop only) */}
                                  <div
                                    aria-hidden={!isTaskSelected || !task}
                                    className={`order-4 hidden md:grid transition-[grid-template-rows,opacity] duration-700 ease-out ${
                                      isTaskSelected && task
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div
                                        className={`border-t border-slate-200 bg-slate-100/60 p-3 transition-transform duration-700 ease-out dark:border-slate-700 dark:bg-slate-900/80 ${
                                          isTaskSelected && task
                                            ? 'translate-y-0'
                                            : '-translate-y-2 pointer-events-none'
                                        }`}
                                      >
                                        {task && (
                                          <>
                                            <div className="rounded-xl border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setTaskEvidenceOpenByTaskId((prev) => ({
                                                    ...prev,
                                                    [task.id]: !(prev[task.id] ?? true),
                                                  }))
                                                }
                                                className="flex w-full items-center justify-between px-3 py-2.5"
                                              >
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                                                  Evidencias
                                                  {taskAttachments.length > 0 && (
                                                    <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                      {taskAttachments.length}
                                                    </span>
                                                  )}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                  {(isTaskAttachmentLoading || isTaskAttachmentMutating) && (
                                                    <Loader2 size={12} className="animate-spin text-slate-400" />
                                                  )}
                                                  {isTaskEvidenceExpanded ? (
                                                    <ChevronUp size={13} className="text-slate-400" />
                                                  ) : (
                                                    <ChevronDown size={13} className="text-slate-400" />
                                                  )}
                                                </div>
                                              </button>

                                              <div
                                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                                  isTaskEvidenceExpanded
                                                    ? 'grid-rows-[1fr] opacity-100'
                                                    : 'grid-rows-[0fr] opacity-0'
                                                }`}
                                              >
                                              <div className="overflow-hidden">
                                              <div className="px-3 pb-3">

                                              {taskAttachmentError && (
                                                <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                                                  {taskAttachmentError}
                                                </p>
                                              )}

                                              {/* Toggle agregar evidencia */}
                                              <div className="mt-3 flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setTaskAddEvidenceExpandedByTaskId((prev) => ({
                                                    ...prev,
                                                    [task.id]: !isTaskAddEvidenceExpanded,
                                                  }))
                                                }
                                                disabled={!canEditTaskContent}
                                                className="flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/10 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
                                              >
                                                <Plus size={12} className="text-indigo-600 dark:text-indigo-400" />
                                                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                                  Agregar evidencia
                                                </span>
                                                {isTaskAddEvidenceExpanded ? (
                                                  <ChevronUp size={13} className="text-indigo-400" />
                                                ) : (
                                                  <ChevronDown size={13} className="text-indigo-400" />
                                                )}
                                              </button>
                                              </div>

                                              <div
                                                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                                  isTaskAddEvidenceExpanded
                                                    ? 'grid-rows-[1fr] opacity-100'
                                                    : 'grid-rows-[0fr] opacity-0'
                                                }`}
                                              >
                                              <div className="overflow-hidden">
                                              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">

                                              {/* Nota de texto */}
                                              <div className="space-y-1.5">
                                                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                  <Pencil size={10} />
                                                  Nota de texto
                                                </p>
                                                <textarea
                                                  value={noteDraftByTaskId[task.id] ?? ''}
                                                  onChange={(event) =>
                                                    setNoteDraftByTaskId((previous) => ({
                                                      ...previous,
                                                      [task.id]: event.target.value,
                                                    }))
                                                  }
                                                  placeholder="Escribe tu nota aquí..."
                                                  disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                  style={{ minHeight: '4.5rem' }}
                                                  onInput={(event) => {
                                                    const el = event.currentTarget
                                                    el.style.height = 'auto'
                                                    el.style.height = `${el.scrollHeight}px`
                                                  }}
                                                  className="w-full resize-none overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/40"
                                                />
                                                <div className="flex justify-end">
                                                  <button
                                                    type="button"
                                                    onClick={() => void handleAddTaskNote(task)}
                                                    disabled={
                                                      !canEditTaskContent ||
                                                      isTaskAttachmentMutating ||
                                                      !(noteDraftByTaskId[task.id] ?? '').trim()
                                                    }
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                  >
                                                    <Save size={11} />
                                                    Guardar nota
                                                  </button>
                                                </div>
                                              </div>

                                              <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-700" />

                                              {/* Archivo */}
                                              <div className="space-y-1.5">
                                                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                  <Upload size={10} />
                                                  Archivo
                                                </p>
                                                <input
                                                  ref={(node) => {
                                                    taskFileInputRefs.current[task.id] = node
                                                  }}
                                                  type="file"
                                                  accept=".pdf,application/pdf,image/*,audio/*"
                                                  className="hidden"
                                                  disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                  onChange={(event) => {
                                                    const file = event.target.files?.[0] ?? null
                                                    void handleTaskFileSelected(task, file)
                                                  }}
                                                />
                                                <div className="flex justify-end">
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenTaskFilePicker(task.id)}
                                                  disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                  className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-300"
                                                >
                                                  <Upload size={13} />
                                                  PDF · imagen · audio
                                                </button>
                                                </div>
                                              </div>

                                              <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-700" />

                                              {/* YouTube */}
                                              <div className="space-y-1.5">
                                                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                  <Link2 size={10} />
                                                  YouTube
                                                </p>
                                                <div className="flex gap-2">
                                                  <input
                                                    type="text"
                                                    value={taskYoutubeDraft}
                                                    onChange={(event) =>
                                                      handleTaskYoutubeDraftChange(task.id, event.target.value)
                                                    }
                                                    placeholder="Pega la URL del video..."
                                                    disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                    className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => void handleAddTaskYoutubeLink(task)}
                                                    disabled={
                                                      !canEditTaskContent ||
                                                      isTaskAttachmentMutating ||
                                                      taskYoutubeDraft.trim().length === 0
                                                    }
                                                    className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-[11px] font-semibold text-white shadow-sm transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                  >
                                                    <Plus size={11} />
                                                    Agregar
                                                  </button>
                                                </div>
                                              </div>

                                              </div>{/* inner card */}
                                              </div>{/* overflow-hidden */}
                                              </div>{/* grid colapsable */}

                                              {isTaskAttachmentLoading ? (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                  Cargando evidencias...
                                                </p>
                                              ) : taskAttachments.length === 0 ? (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                  Este subítem aún no tiene evidencias.
                                                </p>
                                              ) : (
                                                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                  {taskAttachments.map((attachment) => {
                                                    const attachmentLabel = getAttachmentTypeLabel(
                                                      attachment.attachmentType
                                                    )
                                                    const attachmentSize = formatAttachmentSize(
                                                      attachment.sizeBytes
                                                    )
                                                    const previewUrl =
                                                      attachment.attachmentType === 'image' ||
                                                      attachment.attachmentType === 'youtube_link'
                                                        ? attachment.thumbnailUrl || attachment.url
                                                        : resolvePdfPreviewUrl(attachment)

                                                    const isNote = attachment.attachmentType === 'note'
                                                    const noteContent =
                                                      isNote
                                                        ? (attachment.metadata?.content as string | undefined) ??
                                                          attachment.title ??
                                                          ''
                                                        : ''

                                                    return (
                                                      <li
                                                        key={attachment.id}
                                                        className="relative group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                                                      >
                                                        {isNote ? (
                                                          <div className="flex-1 bg-amber-50 px-3 py-2.5 dark:bg-amber-950/20">
                                                            <p className="line-clamp-5 whitespace-pre-wrap break-words text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                                                              {noteContent || '(nota vacía)'}
                                                            </p>
                                                          </div>
                                                        ) : previewUrl ? (
                                                          <a
                                                            href={attachment.attachmentType === 'pdf' ? pdfOpenUrl(attachment.url) : attachment.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
                                                          >
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                              src={previewUrl}
                                                              alt={attachment.title || attachmentLabel}
                                                              className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                                                            />
                                                          </a>
                                                        ) : (
                                                          <div className="flex aspect-video w-full items-center justify-center bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                                            {attachment.attachmentType === 'audio' ? (
                                                              <Music2 size={22} />
                                                            ) : attachment.attachmentType === 'youtube_link' ? (
                                                              <Link2 size={22} />
                                                            ) : attachment.attachmentType === 'image' ? (
                                                              <ImageIcon size={22} />
                                                            ) : (
                                                              <FileText size={22} />
                                                            )}
                                                          </div>
                                                        )}

                                                        <div className="flex flex-shrink-0 flex-col p-2">
                                                          {!isNote && (
                                                            <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                              {attachment.title?.trim() ||
                                                                attachment.url ||
                                                                'Evidencia'}
                                                            </p>
                                                          )}
                                                          <div className={`flex flex-wrap items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 ${isNote ? '' : 'mt-1'}`}>
                                                            <span className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">
                                                              {attachmentLabel}
                                                            </span>
                                                            {attachmentSize && <span>{attachmentSize}</span>}
                                                          </div>
                                                          <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-slate-500">
                                                            {attachment.userName?.trim() || attachment.userEmail?.trim() || 'Usuario'}
                                                            {' · '}
                                                            {formatTaskEventDate(attachment.createdAt)}
                                                          </p>
                                                          {attachment.attachmentType === 'audio' && (
                                                            <audio
                                                              controls
                                                              preload="none"
                                                              src={attachment.url}
                                                              className="mt-2 w-full"
                                                            />
                                                          )}
                                                        </div>

                                                        {/* Botón flotante ··· */}
                                                        <div className="absolute right-1.5 top-1.5 z-30">
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              setOpenAttachmentMenuId((previous) =>
                                                                previous === attachment.id ? null : attachment.id
                                                              )
                                                            }
                                                            className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all duration-150 ${
                                                              isNote
                                                                ? openAttachmentMenuId === attachment.id
                                                                  ? 'bg-amber-800/70 text-white'
                                                                  : 'bg-amber-800/25 text-amber-900 opacity-70 hover:bg-amber-800/45 hover:opacity-100 group-hover:opacity-100 dark:bg-amber-200/20 dark:text-amber-200'
                                                                : openAttachmentMenuId === attachment.id
                                                                  ? 'bg-black/70 text-white backdrop-blur-sm'
                                                                  : 'bg-black/30 text-white opacity-60 hover:bg-black/55 hover:opacity-100 group-hover:opacity-100 backdrop-blur-sm'
                                                            }`}
                                                            aria-label="Opciones de la evidencia"
                                                          >
                                                            <MoreHorizontal size={13} />
                                                          </button>

                                                          {openAttachmentMenuId === attachment.id && (
                                                            <>
                                                              <div
                                                                className="fixed inset-0 z-40"
                                                                aria-hidden="true"
                                                                onClick={() => setOpenAttachmentMenuId(null)}
                                                              />
                                                              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                                                {!isNote && (
                                                                  <>
                                                                    <a
                                                                      href={attachment.attachmentType === 'pdf' ? pdfOpenUrl(attachment.url) : attachment.url}
                                                                      target="_blank"
                                                                      rel="noreferrer"
                                                                      onClick={() => setOpenAttachmentMenuId(null)}
                                                                      className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                                                    >
                                                                      <ExternalLink size={13} className="flex-shrink-0 text-slate-400" />
                                                                      Abrir
                                                                    </a>
                                                                    <a
                                                                      href={attachment.url}
                                                                      download
                                                                      onClick={() => setOpenAttachmentMenuId(null)}
                                                                      className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                                                    >
                                                                      <Download size={13} className="flex-shrink-0 text-slate-400" />
                                                                      Descargar
                                                                    </a>
                                                                  </>
                                                                )}
                                                                <button
                                                                  type="button"
                                                                  onClick={() => {
                                                                    handleCopyAttachmentLink(
                                                                      attachment.id,
                                                                      isNote ? noteContent : attachment.url
                                                                    )
                                                                    setOpenAttachmentMenuId(null)
                                                                  }}
                                                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                                                >
                                                                  {copiedAttachmentId === attachment.id ? (
                                                                    <>
                                                                      <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-500" />
                                                                      <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                                                                    </>
                                                                  ) : (
                                                                    <>
                                                                      <Share2 size={13} className="flex-shrink-0 text-slate-400" />
                                                                      {isNote ? 'Copiar nota' : 'Compartir enlace'}
                                                                    </>
                                                                  )}
                                                                </button>
                                                                <div className="mx-3 border-t border-slate-100 dark:border-slate-800" />
                                                                <button
                                                                  type="button"
                                                                  onClick={() => {
                                                                    setOpenAttachmentMenuId(null)
                                                                    void handleDeleteTaskAttachment(task, attachment)
                                                                  }}
                                                                  disabled={!canEditTaskContent || isTaskAttachmentMutating}
                                                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-900/20"
                                                                >
                                                                  <Trash2 size={13} className="flex-shrink-0" />
                                                                  Quitar evidencia
                                                                </button>
                                                              </div>
                                                            </>
                                                          )}
                                                        </div>
                                                      </li>
                                                    )
                                                  })}
                                                </ul>
                                              )}
                                              </div>{/* px-3 pb-3 */}
                                              </div>{/* overflow-hidden */}
                                              </div>{/* grid */}
                                            </div>{/* Evidencias card */}

                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleCopyPhase(phase)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                              {copiedPhaseId === phase.id ? (
                                <><Check size={11} className="text-emerald-500" /> Copiado</>
                              ) : (
                                <><Copy size={11} /> Copiar fase</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        <div className="mx-6 mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-4 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="text-amber-500 flex-shrink-0 mt-1 dark:text-amber-300">
            <Zap size={24} fill="currentColor" className="opacity-20" />
          </div>
          <div>
            <h4 className="font-bold text-amber-800 mb-1 text-sm dark:text-amber-200">
              Consejo Pro (Gold Nugget)
            </h4>
            <p className="text-sm text-amber-700 leading-relaxed italic dark:text-amber-300">
              &ldquo;{result.proTip}&rdquo;
            </p>
          </div>
        </div>

        <div className="mx-6 mb-5 mt-1 flex justify-end">
          <p
            title={`Dueño: ${playbookOwnerSignature}`}
            className="paper-playbook-owner-signature"
          >
            {playbookOwnerSignature}
          </p>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════
          MOBILE BOTTOM SHEET — sub-item detail (md:hidden)
          ══════════════════════════════════════════════════ */}
      {(() => {
        if (!mobileSheetTaskId) return null
        const sheetTask = interactiveTasks.find((t) => t.id === mobileSheetTaskId) ?? null
        if (!sheetTask) return null

        const sheetTaskAttachments = taskAttachmentsByTaskId[sheetTask.id] ?? []
        const sheetTaskAttachmentError = taskAttachmentErrorByTaskId[sheetTask.id] ?? null
        const sheetTaskYoutubeDraft = youtubeAttachmentDraftByTaskId[sheetTask.id] ?? ''
        const sheetIsAttachmentLoading = taskAttachmentLoadingId === sheetTask.id
        const sheetIsAttachmentMutating = taskAttachmentMutationId === sheetTask.id
        const sheetTaskComments = taskCommentsByTaskId[sheetTask.id] ?? []
        const sheetTaskLikeSummary = taskLikeSummaryByTaskId[sheetTask.id] ?? {
          taskId: sheetTask.id,
          extractionId: sheetTask.extractionId,
          likesCount: 0,
          likedByMe: false,
          sharesCount: 0,
          sharedByMe: false,
          followersCount: 0,
          followingByMe: false,
          viewsCount: 0,
          viewedByMe: false,
        }
        const sheetCommentDraft = taskCommentDraftByTaskId[sheetTask.id] ?? ''
        const sheetReplyDraft = taskReplyDraftByTaskId[sheetTask.id] ?? ''
        const sheetReplyParentCommentId = taskReplyParentByTaskId[sheetTask.id] ?? null
        const sheetIsShareCopied = taskShareCopiedByTaskId[sheetTask.id] ?? false
        const sheetCommunityError = taskCommunityErrorByTaskId[sheetTask.id] ?? null
        const sheetIsCommunityLoading = taskCommunityLoadingId === sheetTask.id
        const sheetIsCommunityMutating = taskCommunityMutationId === sheetTask.id
        const sheetIsTaskMutating = taskMutationLoadingId === sheetTask.id
        const sheetEstadoExpanded = taskEstadoExpandedByTaskId[sheetTask.id] ?? false
        const sheetAddEvidenceExpanded = taskAddEvidenceExpandedByTaskId[sheetTask.id] ?? false
        const sheetNoteContent = noteDraftByTaskId[sheetTask.id] ?? ''
        const sheetTaskDisplayText =
          typeof sheetTask.itemText === 'string'
            ? sheetTask.itemText.trim()
              ? renderTextWithPlaybookReferences(sheetTask.itemText)
              : 'Subítem sin texto'
            : sheetTask.itemText == null
              ? 'Subítem sin texto'
              : renderTextWithPlaybookReferences(String(sheetTask.itemText))

        const TABS = [
          { key: 'gestion', label: 'Gestión' },
          { key: 'actividad', label: 'Actividad' },
          { key: 'evidencias', label: 'Evidencias' },
          { key: 'comunidad', label: 'Comunidad' },
        ] as const

        return createPortal(
            <div
              className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-900 md:hidden"
            >
              {/* Header */}
              <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {sheetTask.positionPath?.trim() || `${sheetTask.phaseId}.${sheetTask.itemIndex + 1}`}
                    <span className={`ml-2 rounded-md border px-1.5 py-0.5 text-[10px] ${getTaskStatusChipClassName(sheetTask.status)}`}>
                      {getTaskStatusLabel(sheetTask.status)}
                    </span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {sheetTaskDisplayText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSheetTaskId(null)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMobileSheetTab(tab.key)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                      mobileSheetTab === tab.key
                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scrollable content */}
              <div key={`${mobileSheetTaskId}-${mobileSheetTab}`} className="flex-1 overflow-y-auto overscroll-contain p-4">

                {/* ── TAB: GESTIÓN ── */}
                {mobileSheetTab === 'gestion' && (
                  <div className="space-y-4">
                    {/* Checkbox + Estado */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={sheetTask.checked}
                        disabled={!canEditTaskContent || sheetIsTaskMutating}
                        onClick={() => void handleTaskToggle(sheetTask, !sheetTask.checked)}
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] border-2 shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                          sheetTask.checked
                            ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                            : 'border-slate-300 bg-white hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900'
                        }`}
                      >
                        <Check
                          size={13}
                          strokeWidth={3}
                          className={`text-white transition-all duration-150 ${sheetTask.checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                        />
                      </button>
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {sheetTask.checked ? 'Marcada como completada' : 'Pendiente de completar'}
                      </span>
                    </div>

                    {/* Estado selector */}
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setTaskEstadoExpandedByTaskId((prev) => ({
                            ...prev,
                            [sheetTask.id]: !sheetEstadoExpanded,
                          }))
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                      >
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Estado</span>
                        <span className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTaskStatusChipClassName(sheetTask.status)}`}>
                            {getTaskStatusLabel(sheetTask.status)}
                          </span>
                          {sheetEstadoExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </span>
                      </button>
                      {sheetEstadoExpanded && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {TASK_STATUS_OPTIONS.map((option) => {
                            const isActive = sheetTask.status === option.value
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => void handleTaskStatusChange(sheetTask, option.value)}
                                disabled={!canEditTaskContent || sheetIsTaskMutating || isActive}
                                className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
                                  isActive
                                    ? option.chipClassName + ' shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                                }`}
                              >
                                {option.value === 'completed' && <CheckCircle2 size={13} />}
                                {option.value === 'in_progress' && <Zap size={13} />}
                                {option.value === 'blocked' && <AlertTriangle size={13} />}
                                {option.value === 'pending' && <Clock size={13} />}
                                {option.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Registrar en actividad */}
                    <div>
                      <p className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Registrar en actividad
                      </p>
                      <input
                        type="text"
                        value={eventDraftContent}
                        onChange={(event) => setEventDraftContent(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey && eventDraftContent.trim()) {
                            void handleAddTaskEvent(sheetTask, 'note')
                          }
                        }}
                        placeholder="Escribe una observación, acción o bloqueo..."
                        disabled={!canEditTaskContent || sheetIsTaskMutating}
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                      />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => void handleAddTaskEvent(sheetTask, 'note')} disabled={!canEditTaskContent || sheetIsTaskMutating || !eventDraftContent.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"><Pencil size={12} />Observación</button>
                        <button type="button" onClick={() => void handleAddTaskEvent(sheetTask, 'pending_action')} disabled={!canEditTaskContent || sheetIsTaskMutating || !eventDraftContent.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"><Clock size={12} />Pendiente</button>
                        <button type="button" onClick={() => void handleAddTaskEvent(sheetTask, 'blocker')} disabled={!canEditTaskContent || sheetIsTaskMutating || !eventDraftContent.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"><AlertTriangle size={12} />Impedimento</button>
                        <button type="button" onClick={() => void handleAddTaskEvent(sheetTask, 'resolved')} disabled={!canEditTaskContent || sheetIsTaskMutating || !eventDraftContent.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"><CheckCircle2 size={12} />Resuelto</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB: ACTIVIDAD ── */}
                {mobileSheetTab === 'actividad' && (
                  <div>
                    {sheetTask.events.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No hay eventos registrados todavía.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {sheetTask.events.map((event) => (
                          <li
                            key={event.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                          >
                            <div className="flex items-start gap-3">
                              {event.eventType === 'blocker' ? (
                                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-rose-500 dark:text-rose-300" />
                              ) : event.eventType === 'pending_action' ? (
                                <Clock size={14} className="mt-0.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
                              ) : event.eventType === 'resolved' ? (
                                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <Pencil size={14} className="mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                  {getTaskEventTypeLabel(event.eventType)}
                                </p>
                                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                                  {event.content}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  <span className="font-medium text-slate-500 dark:text-slate-400">
                                    {event.userName?.trim() || event.userEmail?.trim() || 'Usuario'}
                                  </span>
                                  {' · '}
                                  {formatTaskEventDate(event.createdAt)}
                                </p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* ── TAB: EVIDENCIAS ── */}
                {mobileSheetTab === 'evidencias' && (
                  <div>
                    {sheetTaskAttachmentError && (
                      <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                        {sheetTaskAttachmentError}
                      </p>
                    )}

                    {/* Toggle agregar evidencia */}
                    <div className="mb-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setTaskAddEvidenceExpandedByTaskId((prev) => ({
                            ...prev,
                            [sheetTask.id]: !sheetAddEvidenceExpanded,
                          }))
                        }
                        disabled={!canEditTaskContent}
                        className="flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/60 px-3 py-2 transition-colors hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-900/10"
                      >
                        <Plus size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          Agregar evidencia
                        </span>
                        {sheetAddEvidenceExpanded ? <ChevronUp size={13} className="text-indigo-400" /> : <ChevronDown size={13} className="text-indigo-400" />}
                      </button>
                    </div>

                    {sheetAddEvidenceExpanded && (
                      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
                        {/* Nota de texto */}
                        <div className="space-y-2">
                          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <Pencil size={10} />Nota de texto
                          </p>
                          <textarea
                            value={sheetNoteContent}
                            onChange={(event) =>
                              setNoteDraftByTaskId((prev) => ({ ...prev, [sheetTask.id]: event.target.value }))
                            }
                            placeholder="Escribe tu nota aquí..."
                            disabled={!canEditTaskContent || sheetIsAttachmentMutating}
                            style={{ minHeight: '5rem' }}
                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleAddTaskNote(sheetTask)}
                              disabled={!canEditTaskContent || sheetIsAttachmentMutating || !sheetNoteContent.trim()}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Save size={12} />Guardar nota
                            </button>
                          </div>
                        </div>

                        <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-700" />

                        {/* Archivo */}
                        <div className="space-y-2">
                          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <Upload size={10} />Archivo
                          </p>
                          <input
                            ref={(node) => { taskFileInputRefs.current[sheetTask.id] = node }}
                            type="file"
                            accept=".pdf,application/pdf,image/*,audio/*"
                            className="hidden"
                            disabled={!canEditTaskContent || sheetIsAttachmentMutating}
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null
                              void handleTaskFileSelected(sheetTask, file)
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleOpenTaskFilePicker(sheetTask.id)}
                            disabled={!canEditTaskContent || sheetIsAttachmentMutating}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-400"
                          >
                            <Upload size={14} />PDF · imagen · audio
                          </button>
                        </div>

                        <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-700" />

                        {/* YouTube */}
                        <div className="space-y-2">
                          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <Link2 size={10} />YouTube
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={sheetTaskYoutubeDraft}
                              onChange={(event) => handleTaskYoutubeDraftChange(sheetTask.id, event.target.value)}
                              placeholder="Pega la URL del video..."
                              disabled={!canEditTaskContent || sheetIsAttachmentMutating}
                              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => void handleAddTaskYoutubeLink(sheetTask)}
                              disabled={!canEditTaskContent || sheetIsAttachmentMutating || sheetTaskYoutubeDraft.trim().length === 0}
                              className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
                            >
                              <Plus size={12} />Agregar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {sheetIsAttachmentLoading ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Cargando evidencias...</p>
                    ) : sheetTaskAttachments.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Este subítem aún no tiene evidencias.
                      </p>
                    ) : (
                      <ul className="grid grid-cols-2 gap-3">
                        {sheetTaskAttachments.map((attachment) => {
                          const attachmentLabel = getAttachmentTypeLabel(attachment.attachmentType)
                          const attachmentSize = formatAttachmentSize(attachment.sizeBytes)
                          const previewUrl =
                            attachment.attachmentType === 'image' || attachment.attachmentType === 'youtube_link'
                              ? attachment.thumbnailUrl || attachment.url
                              : resolvePdfPreviewUrl(attachment)
                          const isNote = attachment.attachmentType === 'note'
                          const noteContent = isNote
                            ? (attachment.metadata?.content as string | undefined) ?? attachment.title ?? ''
                            : ''

                          return (
                            <li
                              key={attachment.id}
                              className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                            >
                              {isNote ? (
                                <div className="flex-1 bg-amber-50 px-3 py-2.5 dark:bg-amber-950/20">
                                  <p className="line-clamp-5 whitespace-pre-wrap break-words text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                                    {noteContent || '(nota vacía)'}
                                  </p>
                                </div>
                              ) : previewUrl ? (
                                <a
                                  href={attachment.attachmentType === 'pdf' ? pdfOpenUrl(attachment.url) : attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={previewUrl} alt={attachment.title || attachmentLabel} className="h-full w-full object-cover" />
                                </a>
                              ) : (
                                <a
                                  href={attachment.attachmentType === 'pdf' ? pdfOpenUrl(attachment.url) : attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex aspect-video w-full items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
                                >
                                  {attachment.attachmentType === 'pdf' ? (
                                    <FileText size={28} />
                                  ) : (
                                    <Music2 size={28} />
                                  )}
                                </a>
                              )}
                              <div className="px-2 py-1.5">
                                <p className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                  {attachment.title || attachmentLabel}
                                </p>
                                {attachmentSize && (
                                  <p className="text-[10px] text-slate-400">{attachmentSize}</p>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {/* ── TAB: COMUNIDAD ── */}
                {mobileSheetTab === 'comunidad' && (
                  <div>
                    {sheetCommunityError && (
                      <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                        {sheetCommunityError}
                      </p>
                    )}

                    {/* Like / Compartir / Seguir / Visualizaciones */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggleTaskLike(sheetTask)}
                        disabled={sheetIsCommunityMutating}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          sheetTaskLikeSummary.likedByMe
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                        }`}
                      >
                        <ThumbsUp size={14} />
                        {sheetTaskLikeSummary.likedByMe ? 'Te gusta' : 'Me gusta'}
                        <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-xs dark:bg-slate-700/80">
                          {sheetTaskLikeSummary.likesCount}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleShareTask(sheetTask)}
                        disabled={sheetIsCommunityMutating}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          sheetIsShareCopied
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                        }`}
                      >
                        <Share2 size={14} />
                        {sheetIsShareCopied ? 'Copiado' : 'Compartir'}
                        <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-xs dark:bg-slate-700/80">
                          {sheetTaskLikeSummary.sharesCount ?? 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleTaskFollow(sheetTask)}
                        disabled={sheetIsCommunityMutating || isGuestExtraction}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          sheetTaskLikeSummary.followingByMe
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                        }`}
                      >
                        <Bell size={14} />
                        {sheetTaskLikeSummary.followingByMe ? 'Siguiendo' : 'Seguir'}
                        <span className="rounded bg-slate-200/60 px-1.5 py-0.5 text-xs dark:bg-slate-700/80">
                          {sheetTaskLikeSummary.followersCount ?? 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void fetchTaskCommunity(sheetTask.id)}
                        disabled={sheetIsCommunityLoading || sheetIsCommunityMutating}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Eye size={14} />
                        {sheetTaskLikeSummary.viewsCount ?? 0}
                      </button>
                    </div>

                    {/* Comentar */}
                    <div className="mb-4 flex gap-2">
                      <input
                        type="text"
                        value={sheetCommentDraft}
                        onChange={(event) => handleTaskCommentDraftChange(sheetTask.id, event.target.value)}
                        placeholder="Escribe un comentario..."
                        disabled={sheetIsCommunityMutating}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddTaskComment(sheetTask)}
                        disabled={sheetIsCommunityMutating || sheetCommentDraft.trim().length === 0}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300"
                      >
                        Comentar
                      </button>
                    </div>

                    {sheetIsCommunityLoading ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Cargando comentarios...</p>
                    ) : sheetTaskComments.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Aún no hay comentarios en este subítem.
                      </p>
                    ) : (
                      renderTaskCommentThread({
                        task: sheetTask,
                        comments: sheetTaskComments,
                        isCommunityMutating: sheetIsCommunityMutating,
                        replyParentCommentId: sheetReplyParentCommentId,
                        replyDraft: sheetReplyDraft,
                        compact: true,
                      })
                    )}
                  </div>
                )}

              </div>
            </div>,
          typeof document !== 'undefined' ? document.body : null as unknown as Element
        )
      })()}

      {showPageTurnLeaf && pageTurnSnapshot && (
        <div
          aria-hidden="true"
          className={`paper-playbook-page-turn${isPageTurnAtBend ? ' paper-playbook-page-turn-active' : ''}`}
          style={{
            transform: pageTurnTransform,
            borderRadius: pageTurnBorderRadius,
            boxShadow: pageTurnShadow,
          }}
        >
          <div className="paper-playbook-page-turn-sheet">
            <div className="flex h-full flex-col" style={{ marginInline: '4.5%' }}>
              <div className="border-b border-slate-200/70 px-0 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    Tiempo: {pageTurnSnapshot.savedTime}
                  </span>
                  <span className="rounded-md border border-orange-200/80 bg-orange-50/70 px-2 py-1 text-[10px] font-semibold text-orange-700">
                    Dificultad: {pageTurnSnapshot.difficulty}
                  </span>
                  <span className="rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                    Modo: {pageTurnSnapshot.modeLabel}
                  </span>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {pageTurnSnapshot.sourceSectionLabel}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-700">
                  {pageTurnSnapshot.sourceDisplayTitle}
                </p>
              </div>

              <div className="border-b border-slate-200/70 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Objetivo del resultado
                </p>
                <p className="mt-1 line-clamp-4 text-[12px] leading-5 text-slate-700">
                  {pageTurnSnapshot.objective || 'Sin objetivo.'}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden py-3">
                <div className="space-y-2">
                  {pageTurnSnapshot.phases.slice(0, 5).map((phase) => (
                    <div key={phase.id} className="rounded-md border border-slate-200/60 bg-white/35 px-2.5 py-2">
                      <p className="truncate text-[11px] font-semibold text-slate-700">{phase.title}</p>
                      <ul className="mt-1 space-y-0.5">
                        {flattenItemsAsText(phase.items).slice(0, 2).map((item, itemIndex) => (
                          <li key={`${phase.id}-${itemIndex}`} className="line-clamp-1 text-[10px] text-slate-600">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <span className="paper-playbook-page-turn-crease" />
          </div>
        </div>
      )}

      {showBookCover && (
        <div
          aria-hidden="true"
          className="paper-playbook-cover"
          style={{
            transition:
              coverMotion === 'closing'
                ? 'transform 1.35s cubic-bezier(0.2, 0.75, 0.2, 1)'
                : 'transform 0.9s cubic-bezier(0.24, 0.7, 0.28, 1)',
            transform: coverOpenedToLeft
              ? 'perspective(2400px) rotateY(-104deg) rotateX(0.5deg)'
              : 'perspective(2400px) rotateY(0deg) rotateX(0deg)',
          }}
        >
          <p className="paper-playbook-cover-kicker">Carpeta activa</p>
          <p className="paper-playbook-cover-title">{coverFolderLabel}</p>
        </div>
      )}

    </div>
  )
}
