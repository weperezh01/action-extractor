import { useCallback, useMemo, useState } from 'react'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { formatHistoryDate } from '@/app/home/lib/utils'
import type { HistoryItem } from '@/app/home/lib/types'

const HISTORY_REQUEST_TIMEOUT_MS = 10000

interface HistoryMutationResult {
  ok: boolean
  unauthorized?: boolean
  error?: string
  deletedCount?: number
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [deletingHistoryItemId, setDeletingHistoryItemId] = useState<string | null>(null)
  const [clearingHistory, setClearingHistory] = useState(false)

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase()
    if (!query) return history

    return history.filter((item) => {
      const searchable = [
        item.videoTitle ?? '',
        item.objective ?? '',
        item.url ?? '',
        formatHistoryDate(item.createdAt),
        getExtractionModeLabel(normalizeExtractionMode(item.mode)),
      ]
        .join(' ')
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [history, historyQuery])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HISTORY_REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch('/api/history', {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (res.status === 401) {
        setHistory([])
        return
      }

      const data = await res.json()
      if (!res.ok) {
        return
      }

      setHistory(Array.isArray(data.history) ? data.history : [])
    } catch {
      setHistory([])
    } finally {
      clearTimeout(timeoutId)
      setHistoryLoading(false)
    }
  }, [])

  const resetHistory = useCallback(() => {
    setHistory([])
    setHistoryQuery('')
    setHistoryLoading(false)
    setDeletingHistoryItemId(null)
    setClearingHistory(false)
  }, [])

  const removeHistoryItem = useCallback(async (id: string): Promise<HistoryMutationResult> => {
    const extractionId = id.trim()
    if (!extractionId) {
      return { ok: false, error: 'ID de extracción inválido.' }
    }

    setDeletingHistoryItemId(extractionId)
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId }),
      })

      if (res.status === 401) {
        return { ok: false, unauthorized: true, error: 'Debes iniciar sesión.' }
      }

      const data = (await res.json().catch(() => null)) as
        | { error?: unknown; deletedCount?: unknown }
        | null

      if (!res.ok) {
        return {
          ok: false,
          error:
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo eliminar la extracción.',
        }
      }

      setHistory((previous) => previous.filter((item) => item.id !== extractionId))
      return {
        ok: true,
        deletedCount:
          typeof data?.deletedCount === 'number' ? data.deletedCount : undefined,
      }
    } catch {
      return { ok: false, error: 'Error de conexión al eliminar la extracción.' }
    } finally {
      setDeletingHistoryItemId(null)
    }
  }, [])

  const clearAllHistory = useCallback(async (): Promise<HistoryMutationResult> => {
    setClearingHistory(true)
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })

      if (res.status === 401) {
        return { ok: false, unauthorized: true, error: 'Debes iniciar sesión.' }
      }

      const data = (await res.json().catch(() => null)) as
        | { error?: unknown; deletedCount?: unknown }
        | null

      if (!res.ok) {
        return {
          ok: false,
          error:
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo limpiar el historial.',
        }
      }

      setHistory([])
      return {
        ok: true,
        deletedCount:
          typeof data?.deletedCount === 'number' ? data.deletedCount : undefined,
      }
    } catch {
      return { ok: false, error: 'Error de conexión al limpiar el historial.' }
    } finally {
      setClearingHistory(false)
    }
  }, [])

  return {
    history,
    setHistory,
    historyLoading,
    historyQuery,
    setHistoryQuery,
    deletingHistoryItemId,
    clearingHistory,
    filteredHistory,
    loadHistory,
    resetHistory,
    removeHistoryItem,
    clearAllHistory,
  }
}
