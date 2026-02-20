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

const TRELLO_API_BASE_URL = 'https://api.trello.com/1'

export interface TrelloMember {
  id?: string
  username?: string
  fullName?: string
}

interface TrelloList {
  id?: string
  name?: string
  closed?: boolean
}

interface TrelloBoardWithLists {
  id?: string
  name?: string
  lists?: TrelloList[]
}

interface TrelloBoardResponse {
  id?: string
  name?: string
}

export interface CreateTrelloCardInput extends BuildExportContentInput {
  apiToken: string
  preferredListId?: string | null
}

interface ResolvedTrelloList {
  listId: string
  listName: string | null
  boardId: string | null
  boardName: string | null
}

export class TrelloApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'TrelloApiError'
    this.status = status
    this.details = details
  }
}

function getTrelloApiKey() {
  return (process.env.TRELLO_API_KEY || '').trim()
}

function sanitizeToken(value: string) {
  return value.trim()
}

export function isTrelloConfigured() {
  return Boolean(getTrelloApiKey())
}

export function createTrelloOauthState(userId: string) {
  return `trello.${createNotionOauthState(userId)}`
}

export function verifyTrelloOauthState(state: string, userId: string) {
  if (!state.startsWith('trello.')) return false
  const raw = state.slice('trello.'.length)
  return verifyNotionOauthState(raw, userId)
}

export function buildTrelloAuthorizeUrl(state: string) {
  const apiKey = getTrelloApiKey()
  if (!apiKey) {
    throw new Error('TRELLO_API_KEY no está configurado.')
  }

  const returnUrl = new URL('/', getAppBaseUrl())
  returnUrl.searchParams.set('trello', 'token')
  returnUrl.searchParams.set('trello_state', state)

  const params = new URLSearchParams({
    key: apiKey,
    response_type: 'token',
    scope: 'read,write',
    expiration: 'never',
    name: 'ROI Action Extractor',
    callback_method: 'fragment',
    return_url: returnUrl.toString(),
  })

  return `https://trello.com/1/authorize?${params.toString()}`
}

function buildApiUrl(path: string, params: URLSearchParams) {
  return `${TRELLO_API_BASE_URL}${path}?${params.toString()}`
}

async function parseJson(response: Response) {
  return (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null
}

export async function getTrelloMemberByToken(apiToken: string) {
  const apiKey = getTrelloApiKey()
  if (!apiKey) {
    throw new Error('TRELLO_API_KEY no está configurado.')
  }

  const params = new URLSearchParams({
    key: apiKey,
    token: sanitizeToken(apiToken),
  })
  const response = await fetch(buildApiUrl('/members/me', params), {
    cache: 'no-store',
  })
  const payload = (await parseJson(response)) as TrelloMember | null

  if (!response.ok) {
    const errorPayload = payload as { message?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.message === 'string'
        ? errorPayload.message
        : 'No se pudo validar el token de Trello.'
    throw new TrelloApiError(message, response.status, payload)
  }

  return payload
}

async function resolveTargetList(input: {
  apiToken: string
  preferredListId?: string | null
}): Promise<ResolvedTrelloList | null> {
  const preferred = input.preferredListId?.trim()
  if (preferred) {
    return {
      listId: preferred,
      listName: null,
      boardId: null,
      boardName: null,
    }
  }

  const apiKey = getTrelloApiKey()
  if (!apiKey) {
    throw new Error('TRELLO_API_KEY no está configurado.')
  }

  const params = new URLSearchParams({
    key: apiKey,
    token: sanitizeToken(input.apiToken),
    fields: 'name,url',
    lists: 'open',
    list_fields: 'name,closed',
  })

  const response = await fetch(buildApiUrl('/members/me/boards', params), {
    cache: 'no-store',
  })
  const payload = (await parseJson(response)) as TrelloBoardWithLists[] | null

  if (!response.ok) {
    const errorPayload = payload as { message?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.message === 'string'
        ? errorPayload.message
        : 'No se pudo obtener tableros de Trello.'
    throw new TrelloApiError(message, response.status, payload)
  }

  const boards = Array.isArray(payload) ? payload : []
  for (const board of boards) {
    const lists = Array.isArray(board.lists) ? board.lists : []
    const openList = lists.find((list) => list?.id && list.closed !== true)
    if (openList?.id) {
      return {
        listId: openList.id,
        listName: typeof openList.name === 'string' ? openList.name : null,
        boardId: typeof board.id === 'string' ? board.id : null,
        boardName: typeof board.name === 'string' ? board.name : null,
      }
    }
  }

  return createFallbackBoardAndList({
    apiToken: input.apiToken,
  })
}

async function createFallbackBoardAndList(input: {
  apiToken: string
}): Promise<ResolvedTrelloList | null> {
  const apiKey = getTrelloApiKey()
  if (!apiKey) {
    throw new Error('TRELLO_API_KEY no está configurado.')
  }

  const authParams = new URLSearchParams({
    key: apiKey,
    token: sanitizeToken(input.apiToken),
  })

  const createBoardResponse = await fetch(buildApiUrl('/boards', authParams), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'ROI Action Extractor',
      defaultLists: true,
      prefs_permissionLevel: 'private',
    }),
    cache: 'no-store',
  })

  const boardPayload = (await parseJson(createBoardResponse)) as
    | TrelloBoardResponse
    | { message?: unknown }
    | null

  if (!createBoardResponse.ok) {
    const errorPayload = boardPayload as { message?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.message === 'string'
        ? errorPayload.message
        : 'No se pudo crear un tablero automático en Trello.'
    throw new TrelloApiError(message, createBoardResponse.status, boardPayload)
  }

  const boardData = boardPayload as TrelloBoardResponse | null
  const boardId =
    boardData && typeof boardData.id === 'string' ? boardData.id : null
  const boardName =
    boardData && typeof boardData.name === 'string'
      ? boardData.name
      : 'ROI Action Extractor'
  if (!boardId) {
    throw new TrelloApiError(
      'Trello creó el tablero pero no devolvió un id válido.',
      502,
      boardPayload
    )
  }

  const listParams = new URLSearchParams({
    key: apiKey,
    token: sanitizeToken(input.apiToken),
    filter: 'open',
    fields: 'name,closed',
  })
  const listsResponse = await fetch(
    buildApiUrl(`/boards/${encodeURIComponent(boardId)}/lists`, listParams),
    {
      cache: 'no-store',
    }
  )
  const listsPayload = (await parseJson(listsResponse)) as TrelloList[] | null

  if (!listsResponse.ok) {
    const errorPayload = listsPayload as { message?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.message === 'string'
        ? errorPayload.message
        : 'No se pudo leer las listas del tablero automático de Trello.'
    throw new TrelloApiError(message, listsResponse.status, listsPayload)
  }

  const openLists = Array.isArray(listsPayload)
    ? listsPayload.filter((list) => list?.id && list.closed !== true)
    : []

  const firstOpenList = openLists[0]
  if (firstOpenList?.id) {
    return {
      listId: firstOpenList.id,
      listName:
        typeof firstOpenList.name === 'string' ? firstOpenList.name : null,
      boardId,
      boardName,
    }
  }

  const createListResponse = await fetch(buildApiUrl('/lists', authParams), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idBoard: boardId,
      name: 'Inbox',
      pos: 'top',
    }),
    cache: 'no-store',
  })
  const createListPayload = (await parseJson(createListResponse)) as
    | TrelloList
    | { message?: unknown }
    | null

  if (!createListResponse.ok) {
    const errorPayload = createListPayload as { message?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.message === 'string'
        ? errorPayload.message
        : 'No se pudo crear la lista inicial en Trello.'
    throw new TrelloApiError(message, createListResponse.status, createListPayload)
  }

  const listData = createListPayload as TrelloList | null
  const listId =
    listData && typeof listData.id === 'string'
      ? listData.id
      : null
  const listName =
    listData && typeof listData.name === 'string'
      ? listData.name
      : 'Inbox'
  if (!listId) {
    throw new TrelloApiError(
      'Trello creó la lista pero no devolvió un id válido.',
      502,
      createListPayload
    )
  }

  return {
    listId,
    listName,
    boardId,
    boardName,
  }
}

export async function createTrelloCardFromExtraction(input: CreateTrelloCardInput) {
  const apiKey = getTrelloApiKey()
  if (!apiKey) {
    throw new Error('TRELLO_API_KEY no está configurado.')
  }

  const targetList = await resolveTargetList({
    apiToken: input.apiToken,
    preferredListId: input.preferredListId,
  })

  if (!targetList?.listId) {
    throw new TrelloApiError(
      'No se encontró una lista abierta en Trello. Crea una lista en cualquier tablero e inténtalo de nuevo.',
      409
    )
  }

  const title = buildExportTitle(input).slice(0, 160)
  const description = buildExtractionMarkdown(input)
  const params = new URLSearchParams({
    key: apiKey,
    token: sanitizeToken(input.apiToken),
  })

  const response = await fetch(buildApiUrl('/cards', params), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idList: targetList.listId,
      name: title,
      desc: description,
      pos: 'top',
    }),
    cache: 'no-store',
  })

  const payload = (await parseJson(response)) as
    | { id?: unknown; url?: unknown; message?: unknown }
    | null

  if (!response.ok) {
    const errorPayload = payload as { message?: unknown } | null
    const message =
      errorPayload && typeof errorPayload.message === 'string'
        ? errorPayload.message
        : 'No se pudo crear la tarjeta en Trello.'
    throw new TrelloApiError(message, response.status, payload)
  }

  const cardId = payload && typeof payload.id === 'string' ? payload.id : null
  const cardUrl = payload && typeof payload.url === 'string' ? payload.url : null
  if (!cardId || !cardUrl) {
    throw new TrelloApiError('Respuesta incompleta de Trello al crear tarjeta.', 502, payload)
  }

  return {
    cardId,
    cardUrl,
    listId: targetList.listId,
    listName: targetList.listName,
    boardId: targetList.boardId,
    boardName: targetList.boardName,
  }
}
