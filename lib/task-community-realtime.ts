import { EventEmitter } from 'node:events'

export type TaskCommunityRefreshAction =
  | 'add_comment'
  | 'delete_comment'
  | 'hide_comment'
  | 'unhide_comment'
  | 'toggle_like'
  | 'toggle_follow'
  | 'record_share'
  | 'record_view'

export interface TaskCommunityRefreshEvent {
  extractionId: string
  taskId: string
  action: TaskCommunityRefreshAction
  at: string
}

const TASK_COMMUNITY_EMITTER_KEY = Symbol.for('action-extractor.task-community-emitter')
const TASK_COMMUNITY_VIEW_BUFFER_KEY = Symbol.for('action-extractor.task-community-view-buffer')
const VIEW_EVENT_DEBOUNCE_MS = 1000

type GlobalWithTaskCommunityEmitter = typeof globalThis & {
  [TASK_COMMUNITY_EMITTER_KEY]?: EventEmitter
  [TASK_COMMUNITY_VIEW_BUFFER_KEY]?: Map<string, ReturnType<typeof setTimeout>>
}

function getTaskCommunityEmitter() {
  const globalWithEmitter = globalThis as GlobalWithTaskCommunityEmitter
  if (!globalWithEmitter[TASK_COMMUNITY_EMITTER_KEY]) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(0)
    globalWithEmitter[TASK_COMMUNITY_EMITTER_KEY] = emitter
  }

  return globalWithEmitter[TASK_COMMUNITY_EMITTER_KEY]
}

function buildTaskChannel(extractionId: string, taskId: string) {
  return `task-community:${extractionId}:${taskId}`
}

function getTaskCommunityViewBuffer() {
  const globalWithEmitter = globalThis as GlobalWithTaskCommunityEmitter
  if (!globalWithEmitter[TASK_COMMUNITY_VIEW_BUFFER_KEY]) {
    globalWithEmitter[TASK_COMMUNITY_VIEW_BUFFER_KEY] = new Map()
  }

  return globalWithEmitter[TASK_COMMUNITY_VIEW_BUFFER_KEY]
}

export function publishTaskCommunityRefreshEvent(event: TaskCommunityRefreshEvent) {
  getTaskCommunityEmitter().emit(buildTaskChannel(event.extractionId, event.taskId), event)
}

export function publishTaskCommunityViewRefreshEvent(input: {
  extractionId: string
  taskId: string
}) {
  const channel = buildTaskChannel(input.extractionId, input.taskId)
  const buffer = getTaskCommunityViewBuffer()
  const existingTimer = buffer.get(channel)
  if (existingTimer) return

  const timer = setTimeout(() => {
    buffer.delete(channel)
    publishTaskCommunityRefreshEvent({
      extractionId: input.extractionId,
      taskId: input.taskId,
      action: 'record_view',
      at: new Date().toISOString(),
    })
  }, VIEW_EVENT_DEBOUNCE_MS)

  buffer.set(channel, timer)
}

export function subscribeTaskCommunityRefreshEvent(
  input: { extractionId: string; taskId: string },
  listener: (event: TaskCommunityRefreshEvent) => void
) {
  const emitter = getTaskCommunityEmitter()
  const channel = buildTaskChannel(input.extractionId, input.taskId)
  emitter.on(channel, listener)

  return () => {
    emitter.off(channel, listener)
  }
}
