'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  InteractiveTask,
  InteractiveTaskAttachment,
  InteractiveTaskComment,
  InteractiveTaskLikeSummary,
  SessionUser,
} from '@/app/home/lib/types'

interface SharedTaskTimelineProps {
  extractionId: string
  shareToken: string
  tasks: InteractiveTask[]
  attachments: InteractiveTaskAttachment[]
}

function formatTaskDateUtc(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    // Keep SSR/CSR output deterministic to avoid hydration mismatches.
    timeZone: 'UTC',
  }).format(parsed)
}

function formatTaskDateLocal(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function TaskDateLabel({ isoDate, className }: { isoDate: string; className?: string }) {
  const [label, setLabel] = useState(() => formatTaskDateUtc(isoDate))

  useEffect(() => {
    setLabel(formatTaskDateLocal(isoDate))
  }, [isoDate])

  return (
    <time dateTime={isoDate} className={className} suppressHydrationWarning>
      {label}
    </time>
  )
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
  return 'PDF'
}

function getTaskStatusLabel(status: InteractiveTask['status']) {
  if (status === 'completed') return 'Completada'
  if (status === 'in_progress') return 'En progreso'
  if (status === 'blocked') return 'Bloqueada'
  return 'Pendiente'
}

function getTaskStatusClassName(status: InteractiveTask['status']) {
  if (status === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
  }
  if (status === 'in_progress') {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300'
  }
  if (status === 'blocked') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300'
  }
  return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

function resolveErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as { error?: unknown }).error
  if (typeof error !== 'string') return fallback
  const trimmed = error.trim()
  return trimmed || fallback
}

function normalizeCommunityPayload(
  payload: unknown,
  taskId: string,
  extractionId: string
): {
  comments: InteractiveTaskComment[]
  likeSummary: InteractiveTaskLikeSummary
} {
  const comments = Array.isArray((payload as { comments?: unknown })?.comments)
    ? ((payload as { comments: InteractiveTaskComment[] }).comments ?? [])
    : []

  const rawLikeSummary = (payload as { likeSummary?: unknown })?.likeSummary
  const likeSummary =
    rawLikeSummary && typeof rawLikeSummary === 'object'
      ? (rawLikeSummary as InteractiveTaskLikeSummary)
      : {
          taskId,
          extractionId,
          likesCount: 0,
          likedByMe: false,
        }

  return { comments, likeSummary }
}

export function SharedTaskTimeline({
  extractionId,
  shareToken,
  tasks,
  attachments,
}: SharedTaskTimelineProps) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(tasks[0]?.id ?? null)
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

  const googleAuthHref = useMemo(() => {
    const params = new URLSearchParams({
      next: `/share/${shareToken}`,
    })
    return `/api/auth/google/start?${params.toString()}`
  }, [shareToken])

  const attachmentsByTaskId = useMemo(() => {
    const grouped: Record<string, InteractiveTaskAttachment[]> = {}
    for (const attachment of attachments) {
      const current = grouped[attachment.taskId] ?? []
      current.push(attachment)
      grouped[attachment.taskId] = current
    }
    return grouped
  }, [attachments])

  useEffect(() => {
    let ignore = false

    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
        })
        if (!response.ok) return

        const payload = (await response.json()) as { user?: SessionUser | null }
        if (!ignore) {
          setSessionUser(payload?.user ?? null)
        }
      } catch {
        // no-op: the shared page keeps rendering in read-only mode.
      } finally {
        if (!ignore) {
          setSessionReady(true)
        }
      }
    }

    void loadSession()

    return () => {
      ignore = true
    }
  }, [])

  const fetchTaskCommunity = useCallback(
    async (taskId: string) => {
      if (!sessionUser) return

      setTaskCommunityLoadingId(taskId)
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: null,
      }))

      try {
        const response = await fetch(
          `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(taskId)}/community`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        )
        const payload = (await response.json().catch(() => ({}))) as unknown

        if (response.status === 401) {
          setSessionUser(null)
          setTaskCommunityErrorByTaskId((previous) => ({
            ...previous,
            [taskId]: 'Inicia sesión para interactuar en la comunidad.',
          }))
          return
        }

        if (!response.ok) {
          setTaskCommunityErrorByTaskId((previous) => ({
            ...previous,
            [taskId]: resolveErrorMessage(payload, 'No se pudo cargar la comunidad de este subítem.'),
          }))
          return
        }

        const { comments, likeSummary } = normalizeCommunityPayload(payload, taskId, extractionId)
        setTaskCommentsByTaskId((previous) => ({
          ...previous,
          [taskId]: comments,
        }))
        setTaskLikeSummaryByTaskId((previous) => ({
          ...previous,
          [taskId]: likeSummary,
        }))
      } catch {
        setTaskCommunityErrorByTaskId((previous) => ({
          ...previous,
          [taskId]: 'No se pudo cargar la comunidad de este subítem.',
        }))
      } finally {
        setTaskCommunityLoadingId((previous) => (previous === taskId ? null : previous))
      }
    },
    [extractionId, sessionUser]
  )

  useEffect(() => {
    if (!sessionReady || !sessionUser || !expandedTaskId) return

    const hasComments = Array.isArray(taskCommentsByTaskId[expandedTaskId])
    const hasLikeSummary = Boolean(taskLikeSummaryByTaskId[expandedTaskId])
    if (hasComments && hasLikeSummary) return

    void fetchTaskCommunity(expandedTaskId)
  }, [
    expandedTaskId,
    fetchTaskCommunity,
    sessionReady,
    sessionUser,
    taskCommentsByTaskId,
    taskLikeSummaryByTaskId,
  ])

  const mutateTaskCommunity = useCallback(
    async (taskId: string, payload: Record<string, unknown>) => {
      if (!sessionUser) {
        setTaskCommunityErrorByTaskId((previous) => ({
          ...previous,
          [taskId]: 'Inicia sesión para interactuar en la comunidad.',
        }))
        return false
      }

      setTaskCommunityMutationId(taskId)
      setTaskCommunityErrorByTaskId((previous) => ({
        ...previous,
        [taskId]: null,
      }))

      try {
        const response = await fetch(
          `/api/extractions/${encodeURIComponent(extractionId)}/tasks/${encodeURIComponent(taskId)}/community`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        )
        const data = (await response.json().catch(() => ({}))) as unknown

        if (response.status === 401) {
          setSessionUser(null)
          setTaskCommunityErrorByTaskId((previous) => ({
            ...previous,
            [taskId]: 'Inicia sesión para interactuar en la comunidad.',
          }))
          return false
        }

        if (!response.ok) {
          setTaskCommunityErrorByTaskId((previous) => ({
            ...previous,
            [taskId]: resolveErrorMessage(data, 'No se pudo actualizar la comunidad de este subítem.'),
          }))
          return false
        }

        const { comments, likeSummary } = normalizeCommunityPayload(data, taskId, extractionId)
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
          [taskId]: 'No se pudo actualizar la comunidad de este subítem.',
        }))
        return false
      } finally {
        setTaskCommunityMutationId((previous) => (previous === taskId ? null : previous))
      }
    },
    [extractionId, sessionUser]
  )

  const handleTaskCommentDraftChange = (taskId: string, value: string) => {
    setTaskCommentDraftByTaskId((previous) => ({
      ...previous,
      [taskId]: value,
    }))
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

  if (tasks.length === 0) {
    return null
  }

  return (
    <div className="border-t border-slate-100 p-6 dark:border-slate-800 md:p-7">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          Seguimiento realizado
        </h3>
        <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {tasks.length} tareas
        </span>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => {
          const isExpanded = expandedTaskId === task.id
          const taskAttachments = attachmentsByTaskId[task.id] ?? []
          const taskComments = taskCommentsByTaskId[task.id] ?? []
          const taskLikeSummary = taskLikeSummaryByTaskId[task.id] ?? {
            taskId: task.id,
            extractionId,
            likesCount: 0,
            likedByMe: false,
          }
          const taskCommentDraft = taskCommentDraftByTaskId[task.id] ?? ''
          const taskCommunityError = taskCommunityErrorByTaskId[task.id] ?? null
          const isTaskCommunityLoading = taskCommunityLoadingId === task.id
          const isTaskCommunityMutating = taskCommunityMutationId === task.id

          return (
            <article
              key={task.id}
              id={`task-${task.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => setExpandedTaskId((previous) => (previous === task.id ? null : task.id))}
                className="flex w-full flex-wrap items-start justify-between gap-2 text-left"
                aria-expanded={isExpanded}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {task.phaseId}.{task.itemIndex + 1} {task.itemText}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{task.phaseTitle}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTaskStatusClassName(task.status)}`}
                  >
                    {getTaskStatusLabel(task.status)}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      task.checked
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {task.checked ? 'Checklist: hecha' : 'Checklist: pendiente'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {isExpanded ? 'Ocultar' : 'Ver detalle'}
                  </span>
                </div>
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ease-out ${
                  isExpanded ? 'max-h-[2200px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="mt-3 space-y-4 border-t border-slate-100 pt-3 dark:border-slate-700">
                  <section>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Eventos
                    </p>
                    {task.events.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Este subítem todavía no tiene eventos registrados.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {task.events.slice(0, 6).map((event) => (
                          <li key={event.id} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            - {event.content}{' '}
                            <span className="text-slate-400 dark:text-slate-500">
                              ({event.userName?.trim() || event.userEmail?.trim() || 'Usuario'} · <TaskDateLabel isoDate={event.createdAt} />)
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Evidencias
                      </p>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {taskAttachments.length}
                      </span>
                    </div>

                    {taskAttachments.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Este subítem aún no tiene evidencias adjuntas.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {taskAttachments.map((attachment) => {
                          const typeLabel = getAttachmentTypeLabel(attachment.attachmentType)
                          const sizeLabel = formatAttachmentSize(attachment.sizeBytes)
                          const hasThumbnail = Boolean(attachment.thumbnailUrl)
                          return (
                            <li
                              key={attachment.id}
                              className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                            >
                              <div className="flex items-start gap-3">
                                {hasThumbnail ? (
                                  <img
                                    src={attachment.thumbnailUrl || ''}
                                    alt={attachment.title || `Miniatura ${typeLabel}`}
                                    loading="lazy"
                                    className="h-14 w-24 rounded border border-slate-200 object-cover dark:border-slate-700"
                                  />
                                ) : (
                                  <div className="flex h-14 w-14 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {typeLabel}
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                      {typeLabel}
                                    </span>
                                    {sizeLabel && (
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                        {sizeLabel}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-100">
                                    {attachment.title?.trim() ||
                                      (attachment.attachmentType === 'youtube_link'
                                        ? 'Enlace de YouTube'
                                        : 'Archivo adjunto')}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                    {attachment.userName?.trim() || attachment.userEmail?.trim() || 'Usuario'}
                                    {' · '}
                                    <TaskDateLabel
                                      isoDate={attachment.createdAt}
                                      className="text-slate-400 dark:text-slate-500"
                                    />
                                  </p>
                                  <a
                                    href={attachment.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="mt-1 inline-flex items-center text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                                  >
                                    Abrir evidencia
                                  </a>
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>

                  <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Comunidad
                      </p>
                      {sessionReady && sessionUser && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {sessionUser.name || sessionUser.email}
                        </span>
                      )}
                    </div>

                    {!sessionReady ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Verificando sesión...</p>
                    ) : !sessionUser ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          Inicia sesión para comentar y dar me gusta en este subítem.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={googleAuthHref}
                            className="inline-flex items-center rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                          >
                            Continuar con Google
                          </Link>
                          <Link
                            href="#signup-cta"
                            className="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Crear cuenta
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(isTaskCommunityLoading || isTaskCommunityMutating) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Actualizando comunidad...</p>
                        )}

                        {taskCommunityError && (
                          <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
                            {taskCommunityError}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleTaskLike(task)}
                            disabled={isTaskCommunityMutating}
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                              taskLikeSummary.likedByMe
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {taskLikeSummary.likedByMe ? 'Te gusta' : 'Me gusta'}
                          </button>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {taskLikeSummary.likesCount} like{taskLikeSummary.likesCount === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <textarea
                            value={taskCommentDraft}
                            onChange={(event) => handleTaskCommentDraftChange(task.id, event.target.value)}
                            placeholder="Escribe un comentario para este subítem..."
                            disabled={isTaskCommunityMutating}
                            rows={2}
                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900/30"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleAddTaskComment(task)}
                              disabled={isTaskCommunityMutating || taskCommentDraft.trim().length === 0}
                              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                              Comentar
                            </button>
                          </div>
                        </div>

                        {isTaskCommunityLoading ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Cargando comentarios...</p>
                        ) : taskComments.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Aún no hay comentarios en este subítem.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {taskComments.map((comment) => {
                              const canDelete = sessionUser.id === comment.userId
                              return (
                                <li
                                  key={comment.id}
                                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                                >
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="font-semibold text-slate-700 dark:text-slate-100">
                                      {comment.userName?.trim() || comment.userEmail?.trim() || 'Usuario'}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                        <TaskDateLabel
                                          isoDate={comment.createdAt}
                                          className="text-slate-400 dark:text-slate-500"
                                        />
                                      </span>
                                      {canDelete && (
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteTaskComment(task, comment.id)}
                                          disabled={isTaskCommunityMutating}
                                          className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                                        >
                                          Borrar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-200">
                                    {comment.content}
                                  </p>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
