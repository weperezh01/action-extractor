import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createExtractionTaskEventForUser,
  findExtractionByIdForUser,
  findExtractionTaskByIdForUser,
  listExtractionTasksWithEventsForUser,
  syncExtractionTasksForUser,
  updateExtractionTaskStateForUser,
  type ExtractionTaskEventType,
  type ExtractionTaskStatus,
} from '@/lib/db'
import {
  addGuestTaskEvent,
  findGuestTaskById,
  listGuestTasksWithEvents,
  syncGuestTasks,
  updateGuestTask,
  type GuestTask,
} from '@/lib/guest-tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TASK_STATUSES = new Set<ExtractionTaskStatus>([
  'pending',
  'in_progress',
  'blocked',
  'completed',
])

const ALLOWED_EVENT_TYPES = new Set<ExtractionTaskEventType>([
  'note',
  'pending_action',
  'blocker',
  'resolved',
])

const GUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function toGuestClientTask(task: GuestTask, extractionId: string) {
  return {
    id: task.id,
    extractionId,
    phaseId: task.phaseId,
    phaseTitle: task.phaseTitle,
    itemIndex: task.itemIndex,
    itemText: task.itemText,
    checked: task.checked,
    status: task.status,
    dueAt: null,
    completedAt: null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    events: task.events.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      eventType: e.eventType,
      content: e.content,
      metadataJson: e.metadataJson,
      createdAt: e.createdAt,
      userName: null,
      userEmail: null,
    })),
  }
}

function parseSyncPhases(payload: unknown) {
  if (!Array.isArray(payload)) return []

  return payload
    .map((phase) => {
      if (!phase || typeof phase !== 'object') return null

      const rawId = (phase as { id?: unknown }).id
      const rawTitle = (phase as { title?: unknown }).title
      const rawItems = (phase as { items?: unknown }).items
      const phaseId = Number.parseInt(String(rawId ?? ''), 10)
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
      const items = Array.isArray(rawItems)
        ? rawItems
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item) => item.length > 0)
        : []

      if (!Number.isFinite(phaseId) || phaseId <= 0 || !title || items.length === 0) {
        return null
      }

      return {
        id: phaseId,
        title,
        items,
      }
    })
    .filter((phase): phase is { id: number; title: string; items: string[] } => Boolean(phase))
}

function toClientTask(
  task: Awaited<ReturnType<typeof listExtractionTasksWithEventsForUser>>[number]
) {
  return {
    id: task.id,
    extractionId: task.extraction_id,
    phaseId: task.phase_id,
    phaseTitle: task.phase_title,
    itemIndex: task.item_index,
    itemText: task.item_text,
    checked: task.checked,
    status: task.status,
    dueAt: task.due_at,
    completedAt: task.completed_at,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    events: task.events.map((event) => ({
      id: event.id,
      taskId: event.task_id,
      eventType: event.event_type,
      content: event.content,
      metadataJson: event.metadata_json,
      createdAt: event.created_at,
      userName: event.user_name ?? null,
      userEmail: event.user_email ?? null,
    })),
  }
}

async function getTasksResponse(userId: string, extractionId: string) {
  const tasks = await listExtractionTasksWithEventsForUser({ userId, extractionId })
  return tasks.map(toClientTask)
}

export async function GET(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const extractionId = parseExtractionId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    // ── Guest mode ──────────────────────────────────────────────────────────
    if (extractionId.startsWith('g-')) {
      const guestId = extractionId.slice(2)
      if (!GUEST_ID_RE.test(guestId)) {
        return NextResponse.json({ error: 'guestId inválido.' }, { status: 400 })
      }
      const tasks = await listGuestTasksWithEvents(guestId)
      return NextResponse.json({ tasks: tasks.map((t) => toGuestClientTask(t, extractionId)) })
    }

    // ── Authenticated mode ──────────────────────────────────────────────────
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extraction = await findExtractionByIdForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    return NextResponse.json({
      tasks: await getTasksResponse(user.id, extractionId),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las tareas.'
    console.error('[ActionExtractor] extraction tasks GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar las tareas.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const extractionId = parseExtractionId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const action =
      typeof (body as { action?: unknown })?.action === 'string'
        ? (body as { action: string }).action.trim()
        : ''

    // ── Guest mode ──────────────────────────────────────────────────────────
    if (extractionId.startsWith('g-')) {
      const guestId = extractionId.slice(2)
      if (!GUEST_ID_RE.test(guestId)) {
        return NextResponse.json({ error: 'guestId inválido.' }, { status: 400 })
      }

      const guestTasksResponse = async () => {
        const tasks = await listGuestTasksWithEvents(guestId)
        return NextResponse.json({ tasks: tasks.map((t) => toGuestClientTask(t, extractionId)) })
      }

      if (action === 'sync') {
        const phases = parseSyncPhases((body as { phases?: unknown }).phases)
        if (phases.length === 0) {
          return NextResponse.json(
            { error: 'Debes enviar una lista de fases válida para sincronizar.' },
            { status: 400 }
          )
        }
        await syncGuestTasks({ guestId, phases })
        return guestTasksResponse()
      }

      if (action === 'update') {
        const taskId =
          typeof (body as { taskId?: unknown }).taskId === 'string'
            ? (body as { taskId: string }).taskId.trim()
            : ''
        if (!taskId) {
          return NextResponse.json({ error: 'taskId es requerido.' }, { status: 400 })
        }

        const currentTask = await findGuestTaskById({ guestId, taskId })
        if (!currentTask) {
          return NextResponse.json({ error: 'No se encontró la tarea solicitada.' }, { status: 404 })
        }

        const checkedInput =
          typeof (body as { checked?: unknown }).checked === 'boolean'
            ? (body as { checked: boolean }).checked
            : undefined

        const statusRaw =
          typeof (body as { status?: unknown }).status === 'string'
            ? (body as { status: string }).status.trim()
            : ''
        const statusInput = ALLOWED_TASK_STATUSES.has(statusRaw as ExtractionTaskStatus)
          ? (statusRaw as ExtractionTaskStatus)
          : undefined

        if (checkedInput === undefined && statusInput === undefined) {
          return NextResponse.json(
            { error: 'Debes enviar checked o status para actualizar la tarea.' },
            { status: 400 }
          )
        }

        let nextChecked = checkedInput ?? currentTask.checked
        let nextStatus = statusInput ?? currentTask.status

        if (statusInput) {
          if (statusInput === 'completed') nextChecked = true
          else if (checkedInput === undefined) nextChecked = false
        }

        if (checkedInput !== undefined && !statusInput) {
          if (checkedInput && currentTask.status !== 'blocked') nextStatus = 'completed'
          else if (!checkedInput && currentTask.status === 'completed') nextStatus = 'pending'
        }

        const updatedTask = await updateGuestTask({ guestId, taskId, checked: nextChecked, status: nextStatus })
        if (!updatedTask) {
          return NextResponse.json({ error: 'No se pudo actualizar la tarea.' }, { status: 404 })
        }

        if (updatedTask.status !== currentTask.status) {
          await addGuestTaskEvent({
            guestId,
            taskId,
            eventType: 'note',
            content: `Estado actualizado: ${currentTask.status} -> ${updatedTask.status}`,
            metadataJson: JSON.stringify({ automatic: true, kind: 'status_change' }),
          })
        }
        if (updatedTask.checked !== currentTask.checked) {
          await addGuestTaskEvent({
            guestId,
            taskId,
            eventType: 'note',
            content: updatedTask.checked
              ? 'Checklist marcada como completada.'
              : 'Checklist marcada como pendiente.',
            metadataJson: JSON.stringify({ automatic: true, kind: 'check_toggle' }),
          })
        }

        return guestTasksResponse()
      }

      if (action === 'add_event') {
        const taskId =
          typeof (body as { taskId?: unknown }).taskId === 'string'
            ? (body as { taskId: string }).taskId.trim()
            : ''
        if (!taskId) {
          return NextResponse.json({ error: 'taskId es requerido.' }, { status: 400 })
        }

        const eventTypeRaw =
          typeof (body as { eventType?: unknown }).eventType === 'string'
            ? (body as { eventType: string }).eventType.trim()
            : ''
        if (!ALLOWED_EVENT_TYPES.has(eventTypeRaw as ExtractionTaskEventType)) {
          return NextResponse.json({ error: 'eventType inválido.' }, { status: 400 })
        }

        const content =
          typeof (body as { content?: unknown }).content === 'string'
            ? (body as { content: string }).content.trim()
            : ''
        if (!content) {
          return NextResponse.json({ error: 'content es requerido.' }, { status: 400 })
        }
        if (content.length > 1000) {
          return NextResponse.json({ error: 'content no puede superar 1000 caracteres.' }, { status: 400 })
        }

        const ok = await addGuestTaskEvent({
          guestId,
          taskId,
          eventType: eventTypeRaw as ExtractionTaskEventType,
          content,
          metadataJson: '{}',
        })
        if (!ok) {
          return NextResponse.json({ error: 'No se encontró la tarea solicitada.' }, { status: 404 })
        }

        return guestTasksResponse()
      }

      return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
    }

    // ── Authenticated mode ──────────────────────────────────────────────────
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extraction = await findExtractionByIdForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    if (action === 'sync') {
      const phases = parseSyncPhases((body as { phases?: unknown }).phases)
      if (phases.length === 0) {
        return NextResponse.json(
          { error: 'Debes enviar una lista de fases válida para sincronizar.' },
          { status: 400 }
        )
      }

      await syncExtractionTasksForUser({
        userId: user.id,
        extractionId,
        phases,
      })

      return NextResponse.json({
        tasks: await getTasksResponse(user.id, extractionId),
      })
    }

    if (action === 'update') {
      const taskId =
        typeof (body as { taskId?: unknown }).taskId === 'string'
          ? (body as { taskId: string }).taskId.trim()
          : ''
      if (!taskId) {
        return NextResponse.json({ error: 'taskId es requerido.' }, { status: 400 })
      }

      const currentTask = await findExtractionTaskByIdForUser({
        taskId,
        extractionId,
        userId: user.id,
      })
      if (!currentTask) {
        return NextResponse.json({ error: 'No se encontró la tarea solicitada.' }, { status: 404 })
      }

      const checkedInput =
        typeof (body as { checked?: unknown }).checked === 'boolean'
          ? (body as { checked: boolean }).checked
          : undefined

      const statusRaw =
        typeof (body as { status?: unknown }).status === 'string'
          ? (body as { status: string }).status.trim()
          : ''
      const statusInput = ALLOWED_TASK_STATUSES.has(statusRaw as ExtractionTaskStatus)
        ? (statusRaw as ExtractionTaskStatus)
        : undefined

      if (checkedInput === undefined && statusInput === undefined) {
        return NextResponse.json(
          { error: 'Debes enviar checked o status para actualizar la tarea.' },
          { status: 400 }
        )
      }

      let nextChecked = checkedInput ?? currentTask.checked
      let nextStatus = statusInput ?? currentTask.status

      if (statusInput) {
        if (statusInput === 'completed') {
          nextChecked = true
        } else if (checkedInput === undefined) {
          nextChecked = false
        }
      }

      if (checkedInput !== undefined && !statusInput) {
        if (checkedInput && currentTask.status !== 'blocked') {
          nextStatus = 'completed'
        } else if (!checkedInput && currentTask.status === 'completed') {
          nextStatus = 'pending'
        }
      }

      const updatedTask = await updateExtractionTaskStateForUser({
        taskId,
        extractionId,
        userId: user.id,
        checked: nextChecked,
        status: nextStatus,
      })
      if (!updatedTask) {
        return NextResponse.json({ error: 'No se pudo actualizar la tarea.' }, { status: 404 })
      }

      if (updatedTask.status !== currentTask.status) {
        await createExtractionTaskEventForUser({
          taskId,
          extractionId,
          userId: user.id,
          eventType: 'note',
          content: `Estado actualizado: ${currentTask.status} -> ${updatedTask.status}`,
          metadataJson: JSON.stringify({ automatic: true, kind: 'status_change' }),
        })
      }

      if (updatedTask.checked !== currentTask.checked) {
        await createExtractionTaskEventForUser({
          taskId,
          extractionId,
          userId: user.id,
          eventType: 'note',
          content: updatedTask.checked
            ? 'Checklist marcada como completada.'
            : 'Checklist marcada como pendiente.',
          metadataJson: JSON.stringify({ automatic: true, kind: 'check_toggle' }),
        })
      }

      return NextResponse.json({
        tasks: await getTasksResponse(user.id, extractionId),
      })
    }

    if (action === 'add_event') {
      const taskId =
        typeof (body as { taskId?: unknown }).taskId === 'string'
          ? (body as { taskId: string }).taskId.trim()
          : ''
      if (!taskId) {
        return NextResponse.json({ error: 'taskId es requerido.' }, { status: 400 })
      }

      const eventTypeRaw =
        typeof (body as { eventType?: unknown }).eventType === 'string'
          ? (body as { eventType: string }).eventType.trim()
          : ''
      if (!ALLOWED_EVENT_TYPES.has(eventTypeRaw as ExtractionTaskEventType)) {
        return NextResponse.json({ error: 'eventType inválido.' }, { status: 400 })
      }

      const content =
        typeof (body as { content?: unknown }).content === 'string'
          ? (body as { content: string }).content.trim()
          : ''
      if (!content) {
        return NextResponse.json({ error: 'content es requerido.' }, { status: 400 })
      }
      if (content.length > 1000) {
        return NextResponse.json(
          { error: 'content no puede superar 1000 caracteres.' },
          { status: 400 }
        )
      }

      const created = await createExtractionTaskEventForUser({
        taskId,
        extractionId,
        userId: user.id,
        eventType: eventTypeRaw as ExtractionTaskEventType,
        content,
        metadataJson: '{}',
      })
      if (!created) {
        return NextResponse.json({ error: 'No se encontró la tarea solicitada.' }, { status: 404 })
      }

      return NextResponse.json({
        tasks: await getTasksResponse(user.id, extractionId),
      })
    }

    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron actualizar las tareas.'
    console.error('[ActionExtractor] extraction tasks POST error:', message)
    return NextResponse.json({ error: 'No se pudieron actualizar las tareas.' }, { status: 500 })
  }
}
