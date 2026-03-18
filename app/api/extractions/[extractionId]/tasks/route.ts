import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createExtractionTaskEventForUser,
  findExtractionTaskByIdForUser,
  listExtractionTaskDependencies,
  listExtractionTasksWithEventsForUser,
  replaceExtractionTaskStatusForExtraction,
  syncExtractionTasksForUser,
  updateExtractionTaskStatusCatalogById,
  updateExtractionTaskPlanningForUser,
  updateExtractionTaskScheduleForUser,
  updateExtractionTaskStateForUser,
  type ExtractionAccessRole,
  type ExtractionTaskEventType,
  type ExtractionTaskStatus,
} from '@/lib/db'
import { findExtractionAccessForUser } from '@/lib/db/extractions'
import { notifyTaskStatusChange } from '@/lib/email-notifications'
import { normalizePlaybookPhases } from '@/lib/playbook-tree'
import {
  MAX_TASK_STATUS_LENGTH,
  isBuiltInTaskStatus,
  normalizeTaskStatusInput,
  parseTaskStatusCatalogFromMetadataJson,
  sanitizeCustomTaskStatusCatalog,
} from '@/lib/task-statuses'
import {
  parseTaskNumericFormulaInput,
  parseTaskNumericFormulaJson,
  resolveTaskNumericValues,
  serializeTaskNumericFormula,
  taskNumericFormulaCreatesCycle,
  type TaskNumericFormula,
} from '@/lib/task-numeric-formulas'
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

function parseTaskStatus(body: unknown) {
  const statusProvided = typeof (body as { status?: unknown })?.status === 'string'
  if (!statusProvided) {
    return { statusProvided: false as const, statusInput: undefined }
  }

  const normalized = normalizeTaskStatusInput((body as { status: string }).status)
  if (!normalized) {
    return { statusProvided: true as const, statusInput: undefined }
  }

  return {
    statusProvided: true as const,
    statusInput: normalized.slice(0, MAX_TASK_STATUS_LENGTH) as ExtractionTaskStatus,
  }
}

function parseTaskNumericValue(body: unknown) {
  if (!Object.prototype.hasOwnProperty.call(Object(body), 'numericValue')) {
    return { numericValueProvided: false as const, numericValue: undefined }
  }

  const rawValue = (body as { numericValue?: unknown }).numericValue
  if (rawValue === null) {
    return { numericValueProvided: true as const, numericValue: null }
  }

  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue)) {
      return { numericValueProvided: true as const, numericValue: undefined }
    }
    return { numericValueProvided: true as const, numericValue: rawValue }
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().replace(/,/g, '.')
    if (!normalized) {
      return { numericValueProvided: true as const, numericValue: null }
    }

    const parsed = Number.parseFloat(normalized)
    if (!Number.isFinite(parsed)) {
      return { numericValueProvided: true as const, numericValue: undefined }
    }

    return { numericValueProvided: true as const, numericValue: parsed }
  }

  return { numericValueProvided: true as const, numericValue: undefined }
}

function parseTaskNumericFormula(body: unknown) {
  if (!Object.prototype.hasOwnProperty.call(Object(body), 'numericFormula')) {
    return { numericFormulaProvided: false as const, numericFormula: undefined }
  }

  const rawValue = (body as { numericFormula?: unknown }).numericFormula
  if (rawValue === null) {
    return { numericFormulaProvided: true as const, numericFormula: null }
  }

  const parsed = parseTaskNumericFormulaInput(rawValue)
  if (!parsed) {
    return { numericFormulaProvided: true as const, numericFormula: undefined }
  }

  return { numericFormulaProvided: true as const, numericFormula: parsed }
}

function parseExplicitTaskStatus(raw: unknown) {
  const normalized = normalizeTaskStatusInput(raw)
  if (!normalized) return undefined
  return normalized.slice(0, MAX_TASK_STATUS_LENGTH) as ExtractionTaskStatus
}

function parseTaskStatusCatalog(body: unknown) {
  const rawCatalog = (body as { taskStatusCatalog?: unknown })?.taskStatusCatalog
  if (rawCatalog === undefined) {
    return { taskStatusCatalogProvided: false as const, taskStatusCatalog: undefined }
  }
  if (!Array.isArray(rawCatalog)) {
    return { taskStatusCatalogProvided: true as const, taskStatusCatalog: undefined }
  }
  return {
    taskStatusCatalogProvided: true as const,
    taskStatusCatalog: sanitizeCustomTaskStatusCatalog(rawCatalog),
  }
}

function getTaskStatusIdentity(status: string) {
  return normalizeTaskStatusInput(status).toLocaleLowerCase()
}

function areTaskStatusCatalogsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function appendTaskStatusCatalogValue(catalog: string[], status: string) {
  return sanitizeCustomTaskStatusCatalog([...catalog, status])
}

function replaceTaskStatusCatalogValue(catalog: string[], status: string, nextStatus: string) {
  const statusKey = getTaskStatusIdentity(status)
  return sanitizeCustomTaskStatusCatalog(
    catalog.map((catalogStatus) =>
      getTaskStatusIdentity(catalogStatus) === statusKey ? nextStatus : catalogStatus
    )
  )
}

function removeTaskStatusCatalogValue(catalog: string[], status: string) {
  const statusKey = getTaskStatusIdentity(status)
  return catalog.filter((catalogStatus) => getTaskStatusIdentity(catalogStatus) !== statusKey)
}

function resolveClientTaskNumericValues<
  T extends {
    id: string
    manualNumericValue: number | null
    numericFormula: TaskNumericFormula | null
    numericValue: number | null
  },
>(tasks: T[]) {
  const resolvedValues = resolveTaskNumericValues(tasks)
  return tasks.map((task) => ({
    ...task,
    numericValue: resolvedValues.get(task.id) ?? null,
  }))
}

function validateTaskNumericFormulaSelection<
  T extends {
    id: string
    numericFormula: TaskNumericFormula | null
  },
>(tasks: T[], taskId: string, numericFormula: TaskNumericFormula | null) {
  if (!numericFormula) {
    return { ok: true as const }
  }

  const availableTaskIds = new Set(tasks.map((task) => task.id))
  const hasInvalidSource = numericFormula.sourceTaskIds.some(
    (sourceTaskId) => sourceTaskId === taskId || !availableTaskIds.has(sourceTaskId)
  )
  if (hasInvalidSource) {
    return {
      ok: false as const,
      error: 'La fórmula numérica contiene subtítems inválidos.',
    }
  }

  if (taskNumericFormulaCreatesCycle(tasks, taskId, numericFormula)) {
    return {
      ok: false as const,
      error: 'La fórmula numérica no puede crear una dependencia circular.',
    }
  }

  return { ok: true as const }
}

function toGuestClientTask(task: GuestTask, extractionId: string) {
  return {
    id: task.id,
    extractionId,
    phaseId: task.phaseId,
    phaseTitle: task.phaseTitle,
    itemIndex: task.itemIndex,
    itemText: task.itemText,
    nodeId: `p${task.phaseId}-i${task.itemIndex}`,
    parentNodeId: null,
    depth: 1,
    positionPath: `${task.phaseId}.${task.itemIndex + 1}`,
    checked: task.checked,
    status: task.status,
    manualNumericValue: task.manualNumericValue,
    numericFormula: task.numericFormula,
    numericValue: task.numericValue,
    dueAt: null,
    completedAt: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    durationDays: 1,
    predecessorIds: [],
    flowNodeType: 'process' as const,
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
  return normalizePlaybookPhases(payload).filter((phase) => phase.items.length > 0)
}

function toClientTask(task: Awaited<ReturnType<typeof listExtractionTasksWithEventsForUser>>[number]) {
  return {
    id: task.id,
    extractionId: task.extraction_id,
    phaseId: task.phase_id,
    phaseTitle: task.phase_title,
    itemIndex: task.item_index,
    itemText: task.item_text,
    nodeId: task.node_id,
    parentNodeId: task.parent_node_id,
    depth: task.depth,
    positionPath: task.position_path,
    checked: task.checked,
    status: task.status,
    manualNumericValue: task.numeric_value,
    numericFormula: parseTaskNumericFormulaJson(task.numeric_formula_json),
    numericValue: task.numeric_value,
    dueAt: task.due_at,
    completedAt: task.completed_at,
    scheduledStartAt: task.scheduled_start_at,
    scheduledEndAt: task.scheduled_end_at,
    durationDays: task.duration_days,
    predecessorIds: [],  // populated by getTasksResponse after merging depsMap
    flowNodeType: (task.flow_node_type ?? 'process') as 'process' | 'decision',
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

async function getTasksResponse(extractionId: string) {
  const [tasks, depsMap] = await Promise.all([
    listExtractionTasksWithEventsForUser({ extractionId }),
    listExtractionTaskDependencies(extractionId),
  ])
  return resolveClientTaskNumericValues(tasks.map(task => ({
    ...toClientTask(task),
    predecessorIds: depsMap.get(task.id) ?? [],
  })))
}

async function getTaskCollectionPayload(extractionId: string, taskStatusCatalog: string[]) {
  return {
    tasks: await getTasksResponse(extractionId),
    taskStatusCatalog,
  }
}

interface AuthTaskAccess {
  role: ExtractionAccessRole
  canEdit: boolean
  taskStatusCatalog: string[]
}

async function resolveAuthTaskAccess(input: {
  extractionId: string
  actorUserId: string
}): Promise<{ ok: true; access: AuthTaskAccess } | { ok: false; status: 403 | 404; error: string }> {
  const accessResult = await findExtractionAccessForUser({
    id: input.extractionId,
    userId: input.actorUserId,
  })

  if (!accessResult.extraction) {
    return { ok: false, status: 404, error: 'No se encontró la extracción solicitada.' }
  }

  if (!accessResult.role) {
    return { ok: false, status: 403, error: 'No tienes acceso a esta extracción.' }
  }

  const canEdit = accessResult.role === 'owner' || accessResult.role === 'editor'
  return {
    ok: true,
    access: {
      role: accessResult.role,
      canEdit,
      taskStatusCatalog: parseTaskStatusCatalogFromMetadataJson(accessResult.extraction.metadata_json),
    },
  }
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
      return NextResponse.json({
        tasks: resolveClientTaskNumericValues(tasks.map((t) => toGuestClientTask(t, extractionId))),
        taskStatusCatalog: [],
      })
    }

    // ── Authenticated mode ──────────────────────────────────────────────────
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const access = await resolveAuthTaskAccess({
      extractionId,
      actorUserId: user.id,
    })
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    return NextResponse.json(
      await getTaskCollectionPayload(extractionId, access.access.taskStatusCatalog)
    )
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
        return NextResponse.json({
          tasks: resolveClientTaskNumericValues(tasks.map((t) => toGuestClientTask(t, extractionId))),
          taskStatusCatalog: [],
        })
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

        const { statusProvided, statusInput } = parseTaskStatus(body)
        const { numericValueProvided, numericValue } = parseTaskNumericValue(body)
        const { numericFormulaProvided, numericFormula } = parseTaskNumericFormula(body)

        if (statusProvided && statusInput === undefined) {
          return NextResponse.json({ error: 'status inválido.' }, { status: 400 })
        }
        if (numericValueProvided && numericValue === undefined) {
          return NextResponse.json({ error: 'numericValue inválido.' }, { status: 400 })
        }
        if (numericFormulaProvided && numericFormula === undefined) {
          return NextResponse.json({ error: 'numericFormula inválida.' }, { status: 400 })
        }

        if (
          checkedInput === undefined &&
          statusInput === undefined &&
          !numericValueProvided &&
          !numericFormulaProvided
        ) {
          return NextResponse.json(
            { error: 'Debes enviar checked, status, numericValue o numericFormula para actualizar la tarea.' },
            { status: 400 }
          )
        }

        let nextChecked = checkedInput ?? currentTask.checked
        let nextStatus = statusInput ?? currentTask.status
        const nextNumericValue = numericValueProvided ? numericValue ?? null : currentTask.numericValue
        const nextNumericFormula = numericFormulaProvided ? numericFormula : currentTask.numericFormula

        if (statusInput) {
          if (statusInput === 'completed') nextChecked = true
          else if (checkedInput === undefined) nextChecked = false
        }

        if (checkedInput !== undefined && !statusInput) {
          if (checkedInput && currentTask.status !== 'blocked') nextStatus = 'completed'
          else if (!checkedInput && currentTask.status === 'completed') nextStatus = 'pending'
        }

        if (numericFormulaProvided) {
          const tasks = await listGuestTasksWithEvents(guestId)
          const formulaValidation = validateTaskNumericFormulaSelection(tasks, taskId, nextNumericFormula)
          if (!formulaValidation.ok) {
            return NextResponse.json({ error: formulaValidation.error }, { status: 400 })
          }
        }

        const updatedTask = await updateGuestTask({
          guestId,
          taskId,
          checked: nextChecked,
          status: nextStatus,
          numericValue: nextNumericValue,
          numericFormulaJson: serializeTaskNumericFormula(nextNumericFormula),
        })
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

      if (action === 'update_schedule') {
        return NextResponse.json({ error: 'La programación no está disponible en modo invitado.' }, { status: 400 })
      }

      if (action === 'update_planning') {
        return NextResponse.json({ error: 'La planificación CPM no está disponible en modo invitado.' }, { status: 400 })
      }

      return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
    }

    // ── Authenticated mode ──────────────────────────────────────────────────
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const access = await resolveAuthTaskAccess({
      extractionId,
      actorUserId: user.id,
    })
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const { taskStatusCatalogProvided, taskStatusCatalog } = parseTaskStatusCatalog(body)
    if (taskStatusCatalogProvided && taskStatusCatalog === undefined) {
      return NextResponse.json({ error: 'taskStatusCatalog inválido.' }, { status: 400 })
    }

    const requestedTaskStatusCatalog = taskStatusCatalog ?? access.access.taskStatusCatalog

    if (action === 'sync') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }

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

      if (!areTaskStatusCatalogsEqual(requestedTaskStatusCatalog, access.access.taskStatusCatalog)) {
        const updated = await updateExtractionTaskStatusCatalogById({
          extractionId,
          taskStatusCatalog: requestedTaskStatusCatalog,
        })
        if (!updated) {
          return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
        }
      }

      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, requestedTaskStatusCatalog)
      )
    }

    if (action === 'update') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }

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
      })
      if (!currentTask) {
        return NextResponse.json({ error: 'No se encontró la tarea solicitada.' }, { status: 404 })
      }

      const checkedInput =
        typeof (body as { checked?: unknown }).checked === 'boolean'
          ? (body as { checked: boolean }).checked
          : undefined

      const { statusProvided, statusInput } = parseTaskStatus(body)
      const { numericValueProvided, numericValue } = parseTaskNumericValue(body)
      const { numericFormulaProvided, numericFormula } = parseTaskNumericFormula(body)

      if (statusProvided && statusInput === undefined) {
        return NextResponse.json({ error: 'status inválido.' }, { status: 400 })
      }
      if (numericValueProvided && numericValue === undefined) {
        return NextResponse.json({ error: 'numericValue inválido.' }, { status: 400 })
      }
      if (numericFormulaProvided && numericFormula === undefined) {
        return NextResponse.json({ error: 'numericFormula inválida.' }, { status: 400 })
      }

      if (
        checkedInput === undefined &&
        statusInput === undefined &&
        !numericValueProvided &&
        !numericFormulaProvided
      ) {
        return NextResponse.json(
          { error: 'Debes enviar checked, status, numericValue o numericFormula para actualizar la tarea.' },
          { status: 400 }
        )
      }

      let nextChecked = checkedInput ?? currentTask.checked
      let nextStatus = statusInput ?? currentTask.status
      const nextNumericValue = numericValueProvided ? numericValue ?? null : currentTask.numeric_value
      const nextNumericFormula = numericFormulaProvided
        ? numericFormula
        : parseTaskNumericFormulaJson(currentTask.numeric_formula_json)

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

      if (numericFormulaProvided) {
        const tasks = await listExtractionTasksWithEventsForUser({ extractionId })
        const formulaValidation = validateTaskNumericFormulaSelection(
          tasks.map((task) => ({
            id: task.id,
            numericFormula: parseTaskNumericFormulaJson(task.numeric_formula_json),
          })),
          taskId,
          nextNumericFormula
        )
        if (!formulaValidation.ok) {
          return NextResponse.json({ error: formulaValidation.error }, { status: 400 })
        }
      }

      let nextTaskStatusCatalog = requestedTaskStatusCatalog
      if (statusInput && !isBuiltInTaskStatus(statusInput)) {
        const updatedCatalog = appendTaskStatusCatalogValue(nextTaskStatusCatalog, statusInput)
        if (!areTaskStatusCatalogsEqual(updatedCatalog, nextTaskStatusCatalog)) {
          nextTaskStatusCatalog = updatedCatalog
        }
      }

      if (!areTaskStatusCatalogsEqual(nextTaskStatusCatalog, access.access.taskStatusCatalog)) {
        const catalogUpdated = await updateExtractionTaskStatusCatalogById({
          extractionId,
          taskStatusCatalog: nextTaskStatusCatalog,
        })
        if (!catalogUpdated) {
          return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
        }
      }

      const updatedTask = await updateExtractionTaskStateForUser({
        taskId,
        extractionId,
        checked: nextChecked,
        status: nextStatus,
        numericValue: nextNumericValue,
        numericFormulaJson: serializeTaskNumericFormula(nextNumericFormula),
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
        // Notificar en background (no bloquea la respuesta)
        void notifyTaskStatusChange({
          extractionId,
          taskId,
          actorUserId: user.id,
          actorName: user.name ?? user.email,
          previousStatus: currentTask.status,
          newStatus: updatedTask.status,
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

      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, nextTaskStatusCatalog)
      )
    }

    if (action === 'add_status') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }

      const status = parseExplicitTaskStatus((body as { status?: unknown }).status)
      if (!status) {
        return NextResponse.json({ error: 'status inválido.' }, { status: 400 })
      }
      if (isBuiltInTaskStatus(status)) {
        return NextResponse.json({ error: 'Ese estado ya existe por defecto.' }, { status: 400 })
      }

      const nextTaskStatusCatalog =
        taskStatusCatalog ?? appendTaskStatusCatalogValue(access.access.taskStatusCatalog, status)
      if (!areTaskStatusCatalogsEqual(nextTaskStatusCatalog, access.access.taskStatusCatalog)) {
        const updated = await updateExtractionTaskStatusCatalogById({
          extractionId,
          taskStatusCatalog: nextTaskStatusCatalog,
        })
        if (!updated) {
          return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
        }
      }

      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, nextTaskStatusCatalog)
      )
    }

    if (action === 'rename_status') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }

      const status = parseExplicitTaskStatus((body as { status?: unknown }).status)
      const nextStatus = parseExplicitTaskStatus((body as { nextStatus?: unknown }).nextStatus)
      if (!status || isBuiltInTaskStatus(status)) {
        return NextResponse.json({ error: 'Solo puedes renombrar estados personalizados.' }, { status: 400 })
      }
      if (!nextStatus) {
        return NextResponse.json({ error: 'nextStatus inválido.' }, { status: 400 })
      }

      const nextTaskStatusCatalog =
        taskStatusCatalog ??
        replaceTaskStatusCatalogValue(access.access.taskStatusCatalog, status, nextStatus)

      await replaceExtractionTaskStatusForExtraction({
        extractionId,
        previousStatus: status,
        nextStatus,
      })

      const updated = await updateExtractionTaskStatusCatalogById({
        extractionId,
        taskStatusCatalog: nextTaskStatusCatalog,
      })
      if (!updated) {
        return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
      }

      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, nextTaskStatusCatalog)
      )
    }

    if (action === 'delete_status') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }

      const status = parseExplicitTaskStatus((body as { status?: unknown }).status)
      if (!status || isBuiltInTaskStatus(status)) {
        return NextResponse.json({ error: 'Solo puedes eliminar estados personalizados.' }, { status: 400 })
      }

      const nextTaskStatusCatalog =
        taskStatusCatalog ?? removeTaskStatusCatalogValue(access.access.taskStatusCatalog, status)

      await replaceExtractionTaskStatusForExtraction({
        extractionId,
        previousStatus: status,
        nextStatus: 'pending',
      })

      const updated = await updateExtractionTaskStatusCatalogById({
        extractionId,
        taskStatusCatalog: nextTaskStatusCatalog,
      })
      if (!updated) {
        return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
      }

      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, nextTaskStatusCatalog)
      )
    }

    if (action === 'save_status_catalog') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }

      if (!taskStatusCatalogProvided || taskStatusCatalog === undefined) {
        return NextResponse.json({ error: 'taskStatusCatalog inválido.' }, { status: 400 })
      }

      const updated = await updateExtractionTaskStatusCatalogById({
        extractionId,
        taskStatusCatalog,
      })
      if (!updated) {
        return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
      }

      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, taskStatusCatalog)
      )
    }

    if (action === 'add_event') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }

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

      if (!areTaskStatusCatalogsEqual(requestedTaskStatusCatalog, access.access.taskStatusCatalog)) {
        const updated = await updateExtractionTaskStatusCatalogById({
          extractionId,
          taskStatusCatalog: requestedTaskStatusCatalog,
        })
        if (!updated) {
          return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
        }
      }

      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, requestedTaskStatusCatalog)
      )
    }

    if (action === 'update_schedule') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }
      const taskId = typeof (body as { taskId?: unknown }).taskId === 'string'
        ? (body as { taskId: string }).taskId.trim() : ''
      if (!taskId) return NextResponse.json({ error: 'taskId es requerido.' }, { status: 400 })

      const rawStart = (body as { scheduledStartAt?: unknown }).scheduledStartAt
      const rawEnd = (body as { scheduledEndAt?: unknown }).scheduledEndAt
      const scheduledStartAt = rawStart === null || rawStart === '' ? null
        : typeof rawStart === 'string' ? rawStart.trim() : null
      const scheduledEndAt = rawEnd === null || rawEnd === '' ? null
        : typeof rawEnd === 'string' ? rawEnd.trim() : null

      await updateExtractionTaskScheduleForUser({ taskId, extractionId, scheduledStartAt, scheduledEndAt })
      if (!areTaskStatusCatalogsEqual(requestedTaskStatusCatalog, access.access.taskStatusCatalog)) {
        const updated = await updateExtractionTaskStatusCatalogById({
          extractionId,
          taskStatusCatalog: requestedTaskStatusCatalog,
        })
        if (!updated) {
          return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
        }
      }
      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, requestedTaskStatusCatalog)
      )
    }

    if (action === 'update_planning') {
      if (!access.access.canEdit) {
        return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
      }
      const taskId = typeof (body as { taskId?: unknown }).taskId === 'string'
        ? (body as { taskId: string }).taskId.trim() : ''
      if (!taskId) return NextResponse.json({ error: 'taskId es requerido.' }, { status: 400 })

      const rawDuration = (body as { durationDays?: unknown }).durationDays
      const durationDays = typeof rawDuration === 'number' ? Math.round(rawDuration)
        : typeof rawDuration === 'string' ? (Number.parseInt(rawDuration, 10) || 1) : 1

      const rawPreds = (body as { predecessorIds?: unknown }).predecessorIds
      const predecessorIds = Array.isArray(rawPreds)
        ? rawPreds.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map(p => p.trim())
        : []

      const result = await updateExtractionTaskPlanningForUser({ taskId, extractionId, durationDays, predecessorIds })
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? 'Error al guardar planificación.' }, { status: 400 })
      }
      if (!areTaskStatusCatalogsEqual(requestedTaskStatusCatalog, access.access.taskStatusCatalog)) {
        const updated = await updateExtractionTaskStatusCatalogById({
          extractionId,
          taskStatusCatalog: requestedTaskStatusCatalog,
        })
        if (!updated) {
          return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
        }
      }
      return NextResponse.json(
        await getTaskCollectionPayload(extractionId, requestedTaskStatusCatalog)
      )
    }

    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron actualizar las tareas.'
    console.error('[ActionExtractor] extraction tasks POST error:', message)
    return NextResponse.json({ error: 'No se pudieron actualizar las tareas.' }, { status: 500 })
  }
}
