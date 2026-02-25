import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  publishTaskCommunityRefreshEvent,
  publishTaskCommunityViewRefreshEvent,
  subscribeTaskCommunityRefreshEvent,
  type TaskCommunityRefreshEvent,
} from '@/lib/task-community-realtime'

describe('lib/task-community-realtime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('emite eventos inmediatos por canal de subitem', () => {
    const events: TaskCommunityRefreshEvent[] = []
    const unsubscribe = subscribeTaskCommunityRefreshEvent(
      { extractionId: 'ex-1', taskId: 'task-1' },
      (event) => {
        events.push(event)
      }
    )

    publishTaskCommunityRefreshEvent({
      extractionId: 'ex-1',
      taskId: 'task-1',
      action: 'toggle_like',
      at: '2026-02-25T00:00:00.000Z',
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      extractionId: 'ex-1',
      taskId: 'task-1',
      action: 'toggle_like',
    })

    unsubscribe()
  })

  it('agrega eventos de visualizacion y emite solo uno por ventana de debounce', () => {
    const events: TaskCommunityRefreshEvent[] = []
    const unsubscribe = subscribeTaskCommunityRefreshEvent(
      { extractionId: 'ex-2', taskId: 'task-2' },
      (event) => {
        events.push(event)
      }
    )

    publishTaskCommunityViewRefreshEvent({ extractionId: 'ex-2', taskId: 'task-2' })
    publishTaskCommunityViewRefreshEvent({ extractionId: 'ex-2', taskId: 'task-2' })
    publishTaskCommunityViewRefreshEvent({ extractionId: 'ex-2', taskId: 'task-2' })

    vi.advanceTimersByTime(999)
    expect(events).toHaveLength(0)

    vi.advanceTimersByTime(1)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      extractionId: 'ex-2',
      taskId: 'task-2',
      action: 'record_view',
    })

    unsubscribe()
  })
})
