import {
  BuildExportContentInput,
  buildExtractionMarkdown,
  buildExportTitle,
} from '@/lib/export-content'
import {
  createNotionOauthState,
  getAppBaseUrl,
  verifyNotionOauthState,
} from '@/lib/notion'

const TODOIST_AUTH_BASE_URL = 'https://app.todoist.com/oauth/authorize'
const TODOIST_TOKEN_URL = 'https://todoist.com/oauth/access_token'
const TODOIST_API_V1_BASE_URL = 'https://api.todoist.com/api/v1'

export interface TodoistOAuthTokenResponse {
  access_token: string
  token_type?: string
}

interface TodoistProject {
  id?: string
  name?: string
  is_inbox_project?: boolean
}

interface TodoistPaginatedResponse<T> {
  results?: T[]
  next_cursor?: string | null
}

export interface CreateTodoistTaskInput extends BuildExportContentInput {
  accessToken: string
  preferredProjectId?: string | null
}

export class TodoistApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'TodoistApiError'
    this.status = status
    this.details = details
  }
}

function getTodoistClientId() {
  return (process.env.TODOIST_CLIENT_ID || '').trim()
}

function getTodoistClientSecret() {
  return (process.env.TODOIST_CLIENT_SECRET || '').trim()
}

export function getTodoistRedirectUri() {
  const custom = (process.env.TODOIST_REDIRECT_URI || '').trim()
  if (custom) return custom
  return `${getAppBaseUrl()}/api/todoist/callback`
}

export function isTodoistOAuthConfigured() {
  return Boolean(getTodoistClientId() && getTodoistClientSecret())
}

export function createTodoistOauthState(userId: string) {
  return `todoist.${createNotionOauthState(userId)}`
}

export function verifyTodoistOauthState(state: string, userId: string) {
  if (!state.startsWith('todoist.')) return false
  const raw = state.slice('todoist.'.length)
  return verifyNotionOauthState(raw, userId)
}

export function buildTodoistAuthorizeUrl(state: string) {
  const clientId = getTodoistClientId()
  if (!clientId) {
    throw new Error('TODOIST_CLIENT_ID no está configurado.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'data:read_write',
    state,
    redirect_uri: getTodoistRedirectUri(),
  })

  return `${TODOIST_AUTH_BASE_URL}?${params.toString()}`
}

async function parseResponseJson(response: Response) {
  return (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null
}

export async function exchangeTodoistAuthorizationCode(code: string) {
  const clientId = getTodoistClientId()
  const clientSecret = getTodoistClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Integración con Todoist no configurada.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getTodoistRedirectUri(),
  })

  const response = await fetch(TODOIST_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  })

  const payload = (await parseResponseJson(response)) as
    | TodoistOAuthTokenResponse
    | { error?: unknown; error_description?: unknown }
    | null

  if (!response.ok) {
    const errorPayload = payload as { error_description?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.error_description === 'string'
        ? errorPayload.error_description
        : 'No se pudo completar la autorización con Todoist.'
    throw new TodoistApiError(message, response.status, payload)
  }

  const tokenPayload = payload as TodoistOAuthTokenResponse | null
  if (!tokenPayload || typeof tokenPayload.access_token !== 'string') {
    throw new TodoistApiError('Respuesta inválida de Todoist al autorizar.', 502, payload)
  }

  return {
    access_token: tokenPayload.access_token,
    token_type: tokenPayload.token_type,
  } satisfies TodoistOAuthTokenResponse
}

export async function getTodoistProjects(accessToken: string) {
  const response = await fetch(`${TODOIST_API_V1_BASE_URL}/projects`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })
  const payload = await parseResponseJson(response)
  if (!response.ok) {
    const errorPayload = payload as { error?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.error === 'string'
        ? errorPayload.error
        : 'No se pudieron leer los proyectos de Todoist.'
    throw new TodoistApiError(message, response.status, payload)
  }
  if (Array.isArray(payload)) {
    return payload as TodoistProject[]
  }

  const paginated = payload as TodoistPaginatedResponse<TodoistProject> | null
  return paginated && Array.isArray(paginated.results)
    ? paginated.results
    : []
}

function selectProjectId(projects: TodoistProject[]) {
  const inboxProject = projects.find((project) => project?.id && project.is_inbox_project)
  if (inboxProject?.id) return inboxProject.id

  const firstProject = projects.find((project) => project?.id)
  return firstProject?.id ?? null
}

async function resolveProjectId(input: {
  accessToken: string
  preferredProjectId?: string | null
}) {
  const preferred = input.preferredProjectId?.trim()
  if (preferred) return preferred

  const projects = await getTodoistProjects(input.accessToken)
  return selectProjectId(projects)
}

export async function createTodoistTaskFromExtraction(input: CreateTodoistTaskInput) {
  const title = buildExportTitle(input).slice(0, 250)
  const description = buildExtractionMarkdown(input)
  const projectId = await resolveProjectId({
    accessToken: input.accessToken,
    preferredProjectId: input.preferredProjectId,
  })

  const response = await fetch(`${TODOIST_API_V1_BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: title,
      description,
      ...(projectId ? { project_id: projectId } : {}),
    }),
    cache: 'no-store',
  })

  const payload = (await parseResponseJson(response)) as
    | {
        id?: unknown
        message?: unknown
        error?: unknown
        detail?: unknown
        content?: unknown
      }
    | null

  if (!response.ok) {
    const message = (() => {
      if (!payload || typeof payload !== 'object') {
        return 'No se pudo crear la tarea en Todoist.'
      }
      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message
      }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error
      }
      if (typeof payload.detail === 'string' && payload.detail.trim()) {
        return payload.detail
      }
      return 'No se pudo crear la tarea en Todoist.'
    })()

    throw new TodoistApiError(message, response.status, payload)
  }

  const taskIdRaw = payload?.id
  const taskId =
    typeof taskIdRaw === 'string'
      ? taskIdRaw
      : typeof taskIdRaw === 'number' && Number.isFinite(taskIdRaw)
        ? `${taskIdRaw}`
        : null
  const taskUrl = taskId
    ? `https://app.todoist.com/app/task/${encodeURIComponent(taskId)}`
    : null

  if (!taskId || !taskUrl) {
    throw new TodoistApiError('Respuesta incompleta de Todoist al crear tarea.', 502, payload)
  }

  return {
    taskId,
    taskUrl,
    projectId,
  }
}
