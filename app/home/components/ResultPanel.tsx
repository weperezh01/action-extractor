import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignLeft,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  GripVertical,
  ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Music2,
  Pencil,
  PenLine,
  Play,
  Plus,
  Save,
  Share2,
  ThumbsUp,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import Image from 'next/image'
import {
  EXTRACTION_MODE_OPTIONS,
  getExtractionModeLabel,
  normalizeExtractionMode,
  type ExtractionMode,
} from '@/lib/extraction-modes'
import type {
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

interface ResultPanelProps {
  result: ExtractResult
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

  onClose?: () => void
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

function formatTaskEventDate(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return 'Fecha desconocida'

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
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

export function ResultPanel({
  result,
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
  onClose,
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
  const [taskMutationLoadingId, setTaskMutationLoadingId] = useState<string | null>(null)
  const [eventDraftContent, setEventDraftContent] = useState('')
  const [idCopied, setIdCopied] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isStructureEditing, setIsStructureEditing] = useState(false)
  const [phaseDrafts, setPhaseDrafts] = useState<Phase[]>(result.phases)
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
  const [taskOpenSectionByTaskId, setTaskOpenSectionByTaskId] = useState<
    Record<string, 'gestion' | 'actividad' | 'evidencias' | 'comunidad' | null>
  >({})
  const [taskEstadoExpandedByTaskId, setTaskEstadoExpandedByTaskId] = useState<
    Record<string, boolean>
  >({})
  const [taskAddEvidenceExpandedByTaskId, setTaskAddEvidenceExpandedByTaskId] = useState<
    Record<string, boolean>
  >({})
  const [copiedAttachmentId, setCopiedAttachmentId] = useState<string | null>(null)
  const [openAttachmentMenuId, setOpenAttachmentMenuId] = useState<string | null>(null)
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
    setTaskOpenSectionByTaskId({})
    setTaskEstadoExpandedByTaskId({})
    setTaskAddEvidenceExpandedByTaskId({})
    taskFileInputRefs.current = {}
  }, [result.id])

  useEffect(() => {
    if (isStructureEditing) return
    setPhaseDrafts(result.phases.map((phase) => ({ ...phase, items: [...phase.items] })))
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

    const syncTasks = async () => {
      setTasksLoading(true)
      setTasksError(null)
      try {
        const response = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync',
            phases: result.phases,
          }),
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

    void syncTasks()

    return () => {
      controller.abort()
    }
  }, [phasesSignature, result.id, result.phases])

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
    const node = taskFileInputRefs.current[taskId]
    if (!node) return
    node.click()
  }

  const handleTaskFileSelected = async (task: InteractiveTask, file: File | null) => {
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

  const handleDeleteTaskComment = async (task: InteractiveTask, commentId: string) => {
    const confirmed =
      typeof window === 'undefined' ? false : window.confirm('¿Eliminar este comentario?')
    if (!confirmed) return

    await mutateTaskCommunity(task.id, {
      action: 'delete_comment',
      commentId,
    })
  }

  const handleToggleTaskLike = async (task: InteractiveTask) => {
    await mutateTaskCommunity(task.id, {
      action: 'toggle_like',
    })
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

  const handleStartStructureEditing = () => {
    setPhaseDrafts(result.phases.map((phase) => ({ ...phase, items: [...phase.items] })))
    setStructureError(null)
    setIsStructureEditing(true)
  }

  const handleCancelStructureEditing = () => {
    setPhaseDrafts(result.phases.map((phase) => ({ ...phase, items: [...phase.items] })))
    setStructureError(null)
    setIsStructureEditing(false)
  }

  const handleDraftPhaseTitleChange = (phaseId: number, title: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => (phase.id === phaseId ? { ...phase, title } : phase))
    )
  }

  const handleDraftSubItemChange = (phaseId: number, itemIndex: number, value: string) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        return {
          ...phase,
          items: phase.items.map((item, idx) => (idx === itemIndex ? value : item)),
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
          items: ['Nuevo subítem'],
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
              items: [...phase.items, 'Nuevo subítem'],
            }
          : phase
      )
    )
  }

  const handleDeleteDraftSubItem = (phaseId: number, itemIndex: number) => {
    setPhaseDrafts((previous) =>
      previous.map((phase) => {
        if (phase.id !== phaseId) return phase
        return {
          ...phase,
          items: phase.items.filter((_, idx) => idx !== itemIndex),
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
    const normalized = phaseDrafts
      .map((phase, index) => ({
        id: index + 1,
        title: phase.title.trim(),
        items: phase.items.map((item) => item.trim()).filter((item) => item.length > 0),
      }))
      .filter((phase) => phase.title.length > 0 || phase.items.length > 0)

    if (normalized.length === 0) {
      setStructureError('Debes conservar al menos un ítem principal.')
      return
    }

    const hasInvalidPhase = normalized.some((phase) => !phase.title || phase.items.length === 0)
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
    if (!onClose || isClosing) return
    setIsClosing(true)
    setTimeout(() => onClose(), 700)
  }

  return (
    <div
      className="animate-fade-slide"
      style={{
        transition: 'opacity 0.65s ease, transform 0.65s ease',
        opacity: isClosing ? 0 : 1,
        transform: isClosing ? 'translateY(16px) scale(0.98)' : 'translateY(0) scale(1)',
        pointerEvents: isClosing ? 'none' : undefined,
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {sourceDisplayTitle}
        </p>
        {onClose && (
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

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
          <Clock size={16} /> Tiempo Ahorrado: {result.metadata.savedTime}
        </div>
        <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800">
          <Brain size={16} /> Dificultad: {result.metadata.difficulty}
        </div>
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">
          <Zap size={16} /> Modo: {getExtractionModeLabel(resolvedMode)}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 dark:shadow-none">
        <div className="p-6 border-b border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {sourceSectionLabel}
            </h2>
            {result.id && !isMetaEditing && (
              <button
                type="button"
                onClick={handleStartMetaEdit}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Pencil size={12} /> Editar
              </button>
            )}
          </div>
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
                {isMetaEditing ? (
                  <input
                    type="text"
                    value={metaTitleDraft}
                    onChange={(e) => setMetaTitleDraft(e.target.value)}
                    maxLength={300}
                    placeholder="Título"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                ) : (
                  <p className="font-semibold text-slate-800 text-base line-clamp-2 dark:text-slate-100">
                    {sourceDisplayTitle}
                  </p>
                )}
                {sourceUrl && (
                  <p className="text-xs text-slate-500 mt-2 break-all dark:text-slate-400">
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
                    {result.id && (
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
                        onClick={onCopyShareLink}
                        disabled={shareLoading || shareVisibility !== 'public'}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-wait disabled:opacity-70 dark:border-violet-700 dark:bg-violet-900/25 dark:text-violet-300 dark:hover:bg-violet-900/40"
                        aria-label="Compartir extracción"
                      >
                        <Share2 size={12} />
                        {shareLoading
                          ? 'Compartiendo...'
                          : shareVisibility !== 'public'
                            ? 'Solo público'
                            : shareCopied
                              ? 'Compartido'
                              : 'Compartir'}
                      </button>
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
                          disabled={!result.id || shareLoading || shareVisibility !== 'public'}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Share2 size={15} />
                          {shareLoading
                            ? 'Generando...'
                            : shareVisibility !== 'public'
                              ? 'Público requerido'
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

        <div className="bg-slate-50 p-6 border-b border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
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
              {result.objective}
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
            {result.id && !isStructureEditing && (
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
                        {phase.items.map((item, idx) => {
                          const subItemNumber = `${phase.id}.${idx + 1}`
                          const isSubDragOver =
                            dragOverSubItem?.phaseId === phase.id && dragOverSubItem?.index === idx

                          return (
                            <div
                              key={`${phase.id}-draft-item-${idx}`}
                              draggable={!structureSaving}
                              onDragStart={(e) => handleSubItemDragStart(e, phase.id, idx)}
                              onDragOver={(e) => handleSubItemDragOver(e, phase.id, idx)}
                              onDrop={(e) => handleSubItemDrop(e, phase.id, idx)}
                              onDragEnd={handleSubItemDragEnd}
                              className={`flex items-center gap-2 rounded-lg transition-colors ${
                                isSubDragOver
                                  ? 'bg-indigo-50 outline outline-1 outline-indigo-300 dark:bg-indigo-900/20 dark:outline-indigo-600'
                                  : ''
                              }`}
                            >
                              <span
                                className="flex-shrink-0 cursor-grab touch-none text-slate-300 active:cursor-grabbing dark:text-slate-600"
                                title="Arrastrar para reordenar"
                              >
                                <GripVertical size={14} />
                              </span>
                              <span className="inline-flex h-6 min-w-[2.3rem] items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 font-mono text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                {subItemNumber}
                              </span>
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400/80 dark:bg-indigo-300/70"
                              />
                              <input
                                type="text"
                                value={item}
                                onChange={(event) =>
                                  handleDraftSubItemChange(phase.id, idx, event.target.value)
                                }
                                placeholder="Texto del subítem"
                                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteDraftSubItem(phase.id, idx)}
                                disabled={phase.items.length <= 1 || structureSaving}
                                className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                aria-label="Eliminar subítem"
                              >
                                <Trash2 size={13} />
                              </button>
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
                      Agregar subítem
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
                          <ul className="ml-2 space-y-3 border-l-2 border-dashed border-slate-300 pl-4 dark:border-slate-700">
                            {phase.items.map((item, idx) => {
                              const subItemNumber = `${phase.id}.${idx + 1}`
                              const task = tasksByPhaseItem.get(`${phase.id}:${idx}`) ?? null
                              const isTaskExpanded = task ? activeTaskId === task.id : false
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
                                  })
                                : null
                              const taskCommentDraft = task ? (taskCommentDraftByTaskId[task.id] ?? '') : ''
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
                              const isTaskEvidenceExpanded = openSection === 'evidencias'
                              const isTaskCommunityExpanded = openSection === 'comunidad'
                              const isTaskEstadoExpanded = task
                                ? (taskEstadoExpandedByTaskId[task.id] ?? false)
                                : false
                              const isTaskAddEvidenceExpanded = task
                                ? (taskAddEvidenceExpandedByTaskId[task.id] ?? false)
                                : false

                              return (
                                <li
                                  key={`${phase.id}-${idx}`}
                                  className="relative rounded-xl border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70"
                                >
                                  <span
                                    aria-hidden="true"
                                    className="absolute -left-[1.1rem] top-5 h-2.5 w-2.5 rounded-full border-2 border-indigo-400 bg-white dark:border-indigo-500 dark:bg-slate-900"
                                  />
                                  <div className="p-3">
                                    {/* Content column — full width */}
                                    <div className="min-w-0">
                                      {/* Top bar: checkbox + index | status + three-dots */}
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2">
                                          <div className="relative flex-shrink-0">
                                            <input
                                              type="checkbox"
                                              checked={task?.checked ?? false}
                                              disabled={!task || isTaskMutating}
                                              onChange={(event) => {
                                                if (!task) return
                                                void handleTaskToggle(task, event.target.checked)
                                              }}
                                              className="peer w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer appearance-none border checked:bg-indigo-600 checked:border-indigo-600 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                                            />
                                            <CheckCircle2
                                              size={12}
                                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                                              strokeWidth={3}
                                            />
                                          </div>
                                          <span className="inline-flex h-6 w-fit min-w-[2.3rem] items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 font-mono text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                            {subItemNumber}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          {task && (
                                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getTaskStatusChipClassName(task.status)}`}>
                                              {getTaskStatusLabel(task.status)}
                                            </span>
                                          )}
                                          {task && (
                                            <div className="relative">
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
                                                      setActiveTaskId((prev) => (prev === task.id ? null : task.id))
                                                      setTaskOpenSectionByTaskId((prev) => ({
                                                        ...prev,
                                                        [task.id]: 'evidencias',
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

                                      {/* Text — full width, clickable for community */}
                                      <button
                                        type="button"
                                        className={`w-full text-left rounded-lg px-1 py-0.5 transition-colors ${
                                          isTaskCommunityExpanded
                                            ? 'bg-violet-50 dark:bg-violet-900/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                        }`}
                                        onClick={() => {
                                          if (!task) return
                                          const isOpening = (taskOpenSectionByTaskId[task.id] ?? null) !== 'comunidad'
                                          setTaskOpenSectionByTaskId((prev) => ({
                                            ...prev,
                                            [task.id]: prev[task.id] === 'comunidad' ? null : 'comunidad',
                                          }))
                                          if (isOpening && !(task.id in taskCommentsByTaskId)) {
                                            void fetchTaskCommunity(task.id)
                                          }
                                        }}
                                      >
                                        <span className="text-slate-600 leading-relaxed text-sm dark:text-slate-300">{item}</span>
                                      </button>

                                      {isTaskMutating && (
                                        <Loader2 size={14} className="mt-1 animate-spin text-indigo-500 dark:text-indigo-300" />
                                      )}
                                    </div>
                                  </div>{/* p-3 wrapper */}

                                  {/* Actividad inline collapsible */}
                                  <div
                                    aria-hidden={!isTaskActivityExpanded || !task}
                                    className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
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
                                          task.events.length === 0 ? (
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
                                          )
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Gestión inline collapsible */}
                                  <div
                                    aria-hidden={!isTaskGestionExpanded || !task}
                                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                      isTaskGestionExpanded && task
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
                                        {task && (
                                          <>
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
                                                        disabled={isTaskMutating || isActive}
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
                                                disabled={isTaskMutating}
                                                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                              />
                                              <div className="mt-2 flex flex-wrap gap-1.5">
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'note')} disabled={isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"><Pencil size={11} />Observación</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'pending_action')} disabled={isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"><Clock size={11} />Acción pendiente</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'blocker')} disabled={isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"><AlertTriangle size={11} />Impedimento</button>
                                                <button type="button" onClick={() => void handleAddTaskEvent(task, 'resolved')} disabled={isTaskMutating || !eventDraftContent.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"><CheckCircle2 size={11} />Resuelto</button>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Comunidad inline collapsible */}
                                  <div
                                    aria-hidden={!isTaskCommunityExpanded || !task}
                                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                                      isTaskCommunityExpanded && task
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
                                        {task && (
                                          <>
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                                                <MessageSquare size={12} />
                                                Comunidad
                                              </p>
                                              {(isTaskCommunityLoading || isTaskCommunityMutating) && (
                                                <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                  <Loader2 size={12} className="animate-spin" />
                                                  Actualizando...
                                                </p>
                                              )}
                                            </div>

                                            {taskCommunityError && (
                                              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
                                                {taskCommunityError}
                                              </p>
                                            )}

                                            {taskLikeSummary && (
                                              <div className="mt-2">
                                                <button
                                                  type="button"
                                                  onClick={() => void handleToggleTaskLike(task)}
                                                  disabled={isTaskCommunityMutating}
                                                  className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                    taskLikeSummary.likedByMe
                                                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50'
                                                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                                                  }`}
                                                >
                                                  <ThumbsUp size={12} />
                                                  {taskLikeSummary.likedByMe ? 'Te gusta' : 'Me gusta'}
                                                  <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[10px] dark:bg-slate-700/80">
                                                    {taskLikeSummary.likesCount}
                                                  </span>
                                                </button>
                                              </div>
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
                                              <ul className="mt-3 space-y-2">
                                                {taskComments.map((comment) => (
                                                  <li
                                                    key={comment.id}
                                                    className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                                                  >
                                                    <div className="flex items-start gap-2">
                                                      <MessageSquare
                                                        size={13}
                                                        className="mt-0.5 text-slate-400 dark:text-slate-500"
                                                      />
                                                      <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                          {comment.userName?.trim() ||
                                                            comment.userEmail?.trim() ||
                                                            'Usuario'}
                                                        </p>
                                                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                                                          {comment.content}
                                                        </p>
                                                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                                          {formatTaskEventDate(comment.createdAt)}
                                                        </p>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          void handleDeleteTaskComment(task, comment.id)
                                                        }
                                                        disabled={isTaskCommunityMutating}
                                                        className="inline-flex h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                                      >
                                                        Borrar
                                                      </button>
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

                                  <div
                                    aria-hidden={!isTaskExpanded || !task}
                                    className={`grid transition-[grid-template-rows,opacity] duration-700 ease-out ${
                                      isTaskExpanded && task
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                  >
                                    <div className="overflow-hidden">
                                      <div
                                        className={`border-t border-slate-200 bg-slate-100/60 p-3 transition-transform duration-700 ease-out dark:border-slate-700 dark:bg-slate-900/80 ${
                                          isTaskExpanded && task
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
                                                  setTaskOpenSectionByTaskId((prev) => ({
                                                    ...prev,
                                                    [task.id]: prev[task.id] === 'evidencias' ? null : 'evidencias',
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
                                                  disabled={isTaskAttachmentMutating}
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
                                                  disabled={isTaskAttachmentMutating}
                                                  onChange={(event) => {
                                                    const file = event.target.files?.[0] ?? null
                                                    void handleTaskFileSelected(task, file)
                                                  }}
                                                />
                                                <div className="flex justify-end">
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenTaskFilePicker(task.id)}
                                                  disabled={isTaskAttachmentMutating}
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
                                                    disabled={isTaskAttachmentMutating}
                                                    className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-800"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => void handleAddTaskYoutubeLink(task)}
                                                    disabled={
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
                                                        : null

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
                                                            href={attachment.url}
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
                                                                      href={attachment.url}
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
                                                                  disabled={isTaskAttachmentMutating}
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

      </div>
    </div>
  )
}
