import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Loader2,
  Share2,
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
  InteractiveTask,
  InteractiveTaskEventType,
  InteractiveTaskStatus,
  Phase,
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
  onReExtractMode: (mode: ExtractionMode) => void

  onExportToNotion: () => void | Promise<void>
  onConnectNotion: () => void | Promise<void>

  onExportToTrello: () => void | Promise<void>
  onConnectTrello: () => void | Promise<void>

  onExportToTodoist: () => void | Promise<void>
  onConnectTodoist: () => void | Promise<void>

  onExportToGoogleDocs: () => void | Promise<void>
  onConnectGoogleDocs: () => void | Promise<void>
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
  { value: 'note', label: 'Nota' },
  { value: 'pending_action', label: 'Acción pendiente' },
  { value: 'blocker', label: 'Bloqueo' },
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

export function ResultPanel({
  result,
  url,
  extractionMode,
  activePhase,
  onTogglePhase,
  isExportingPdf,
  shareLoading,
  shareCopied,
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
  onReExtractMode,

  onExportToNotion,
  onConnectNotion,

  onExportToTrello,
  onConnectTrello,

  onExportToTodoist,
  onConnectTodoist,

  onExportToGoogleDocs,
  onConnectGoogleDocs,
}: ResultPanelProps) {
  const resolvedMode = normalizeExtractionMode(result.mode ?? extractionMode)
  const sourceUrl = (result.url ?? url).trim()
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
  const [taskMutationLoadingId, setTaskMutationLoadingId] = useState<string | null>(null)
  const [eventDraftType, setEventDraftType] = useState<InteractiveTaskEventType>('note')
  const [eventDraftContent, setEventDraftContent] = useState('')
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
    setEventDraftType('note')
    setEventDraftContent('')
  }, [activeTaskId])

  const tasksByPhaseItem = useMemo(() => {
    const map = new Map<string, InteractiveTask>()
    for (const task of interactiveTasks) {
      map.set(`${task.phaseId}:${task.itemIndex}`, task)
    }
    return map
  }, [interactiveTasks])

  const activeTask = useMemo(
    () => interactiveTasks.find((task) => task.id === activeTaskId) ?? null,
    [activeTaskId, interactiveTasks]
  )

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

  const handleAddTaskEvent = async (task: InteractiveTask) => {
    const content = eventDraftContent.trim()
    if (!content) return

    setTaskMutationLoadingId(task.id)
    try {
      const ok = await refreshTaskCollection({
        action: 'add_event',
        taskId: task.id,
        eventType: eventDraftType,
        content,
      })

      if (ok) {
        setEventDraftContent('')
      }
    } finally {
      setTaskMutationLoadingId(null)
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

  return (
    <div className="animate-fade-slide">
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
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Video Fuente
          </h2>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row">
              {result.thumbnailUrl ? (
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
                <div className="h-32 w-full rounded-xl bg-slate-100 border border-slate-200 md:w-56 dark:bg-slate-800 dark:border-slate-700" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 text-base line-clamp-2 dark:text-slate-100">
                  {result.videoTitle || 'Video de YouTube'}
                </p>
                {sourceUrl && (
                  <p className="text-xs text-slate-500 mt-2 break-all dark:text-slate-400">
                    {sourceUrl}
                  </p>
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
                          disabled={!result.id || shareLoading}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Share2 size={15} />
                          {shareLoading ? 'Generando...' : shareCopied ? 'Copiado' : 'Compartir'}
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
          <p className="text-lg font-medium text-slate-800 leading-relaxed dark:text-slate-100">
            {result.objective}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {result.phases.map((phase: Phase) => (
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
                      activePhase === phase.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-700 dark:text-slate-300 dark:group-hover:bg-indigo-900/40 dark:group-hover:text-indigo-300'
                    }`}
                  >
                    {phase.id}
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{phase.title}</span>
                </div>
                {activePhase === phase.id ? (
                  <ChevronUp size={20} className="text-slate-400" />
                ) : (
                  <ChevronDown size={20} className="text-slate-400" />
                )}
              </button>

              {activePhase === phase.id && (
                <div className="p-4 pt-0 bg-slate-50/50 border-t border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
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

                  <ul className="space-y-3 mt-4">
                    {phase.items.map((item, idx) => {
                      const task = tasksByPhaseItem.get(`${phase.id}:${idx}`) ?? null
                      const isTaskExpanded = task ? activeTaskId === task.id : false
                      const isTaskMutating = task ? taskMutationLoadingId === task.id : false

                      return (
                        <li
                          key={`${phase.id}-${idx}`}
                          className="rounded-xl border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70"
                        >
                          <div className="flex items-start gap-3 p-3">
                            <div className="mt-0.5 relative flex-shrink-0">
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

                            <button
                              type="button"
                              disabled={!task}
                              onClick={() => {
                                if (!task) return
                                setActiveTaskId((previous) => (previous === task.id ? null : task.id))
                              }}
                              className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left disabled:cursor-default"
                            >
                              <span className="text-slate-600 transition-colors leading-relaxed text-sm dark:text-slate-300">
                                {item}
                              </span>
                              {task && (
                                <span
                                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getTaskStatusChipClassName(
                                    task.status
                                  )}`}
                                >
                                  {getTaskStatusLabel(task.status)}
                                </span>
                              )}
                            </button>

                            {isTaskMutating && (
                              <Loader2
                                size={14}
                                className="mt-0.5 flex-shrink-0 animate-spin text-indigo-500 dark:text-indigo-300"
                              />
                            )}
                          </div>

                          {isTaskExpanded && task && (
                            <div className="border-t border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/80">
                              <div className="grid gap-3 lg:grid-cols-[minmax(0,180px)_1fr]">
                                <label className="block">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                                    Estado
                                  </span>
                                  <select
                                    value={task.status}
                                    onChange={(event) =>
                                      void handleTaskStatusChange(
                                        task,
                                        event.target.value as InteractiveTaskStatus
                                      )
                                    }
                                    disabled={isTaskMutating}
                                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                  >
                                    {TASK_STATUS_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                                    Registrar Evento
                                  </p>
                                  <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                                    <select
                                      value={eventDraftType}
                                      onChange={(event) =>
                                        setEventDraftType(
                                          event.target.value as InteractiveTaskEventType
                                        )
                                      }
                                      disabled={isTaskMutating}
                                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                    >
                                      {TASK_EVENT_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      value={eventDraftContent}
                                      onChange={(event) => setEventDraftContent(event.target.value)}
                                      placeholder="Describe la novedad de este subítem..."
                                      disabled={isTaskMutating}
                                      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/60"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => void handleAddTaskEvent(task)}
                                      disabled={isTaskMutating || eventDraftContent.trim().length === 0}
                                      className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                                  Actividad
                                </p>
                                {task.events.length === 0 ? (
                                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    No hay eventos registrados todavía.
                                  </p>
                                ) : (
                                  <ul className="mt-2 space-y-2">
                                    {task.events.map((event) => (
                                      <li
                                        key={event.id}
                                        className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                                      >
                                        <div className="flex items-start gap-2">
                                          <AlertTriangle
                                            size={13}
                                            className={`mt-0.5 ${
                                              event.eventType === 'blocker'
                                                ? 'text-rose-500 dark:text-rose-300'
                                                : 'text-slate-400 dark:text-slate-500'
                                            }`}
                                          />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                              {getTaskEventTypeLabel(event.eventType)}
                                            </p>
                                            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                                              {event.content}
                                            </p>
                                            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                              {formatTaskEventDate(event.createdAt)}
                                            </p>
                                          </div>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          ))}
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
