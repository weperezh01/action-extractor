'use client'

import { useCallback, useState } from 'react'
import { AlertCircle, CheckCircle, Clock, Layers, Loader2, Play, Plus, RotateCcw, X } from 'lucide-react'
import type { ExtractionMode } from '@/lib/extraction-modes'
import { EXTRACTION_MODE_OPTIONS, normalizeExtractionMode } from '@/lib/extraction-modes'
import type { ExtractionOutputLanguage } from '@/lib/output-language'
import type { FolderItem } from '@/app/home/components/FolderDock'
import { isSystemExtractionFolderId } from '@/lib/extraction-folders'

const MAX_ITEMS = 5

type BatchItemStatus = 'idle' | 'pending' | 'processing' | 'done' | 'cached' | 'error'

interface BatchItem {
  id: string
  url: string
  status: BatchItemStatus
  title?: string
  error?: string
}

export interface BatchExtractPanelProps {
  extractionMode: ExtractionMode
  outputLanguage: ExtractionOutputLanguage
  folders: FolderItem[]
  onComplete: () => void
}

function createItemId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function runStreamItem(body: Record<string, unknown>): Promise<{
  title: string | null
  cached: boolean
  error: string | null
}> {
  let res: Response
  try {
    res = await fetch('/api/extract/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    })
  } catch {
    return { title: null, cached: false, error: 'Error de conexión' }
  }

  if (!res.ok) {
    let message = `Error ${res.status}`
    try {
      const data = (await res.json()) as { error?: unknown }
      if (typeof data.error === 'string' && data.error.trim()) message = data.error
    } catch { /* ignore */ }
    return { title: null, cached: false, error: message }
  }

  if (!res.body) {
    return { title: null, cached: false, error: 'Sin cuerpo de respuesta' }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let title: string | null = null
  let cached = false
  let error: string | null = null

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const lines = frame.split('\n')
        let eventType = 'message'
        let dataStr = ''

        for (const line of lines) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim()
          else if (line.startsWith('data:')) dataStr = line.slice(5).trim()
        }

        if (!dataStr) continue
        let parsed: unknown
        try { parsed = JSON.parse(dataStr) } catch { continue }

        if (eventType === 'result' && parsed && typeof parsed === 'object') {
          const p = parsed as Record<string, unknown>
          title =
            typeof p.videoTitle === 'string' && p.videoTitle.trim()
              ? p.videoTitle.trim()
              : typeof p.sourceLabel === 'string' && p.sourceLabel.trim()
                ? p.sourceLabel.trim()
                : null
          cached = p.cached === true
        } else if (eventType === 'error' && parsed && typeof parsed === 'object') {
          const p = parsed as { message?: unknown }
          error =
            typeof p.message === 'string' && p.message.trim()
              ? p.message
              : 'Error en la extracción'
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!title && !error) {
    error = 'Extracción finalizada sin resultado'
  }

  return { title, cached, error }
}

export function BatchExtractPanel({
  extractionMode,
  outputLanguage,
  folders,
  onComplete,
}: BatchExtractPanelProps) {
  const [items, setItems] = useState<BatchItem[]>([
    { id: createItemId(), url: '', status: 'idle' },
    { id: createItemId(), url: '', status: 'idle' },
  ])
  const [mode, setMode] = useState<ExtractionMode>(extractionMode)
  const [folderId, setFolderId] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)

  const userFolders = folders.filter((f) => !isSystemExtractionFolderId(f.id))
  const filledItems = items.filter((i) => i.url.trim())
  const canStart = filledItems.length > 0 && !isRunning

  const addItem = () => {
    if (items.length >= MAX_ITEMS || isRunning) return
    setItems((prev) => [...prev, { id: createItemId(), url: '', status: 'idle' }])
  }

  const removeItem = (id: string) => {
    if (isRunning) return
    setItems((prev) => prev.length > 1 ? prev.filter((i) => i.id !== id) : prev)
  }

  const updateUrl = (id: string, url: string) => {
    if (isRunning) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, url } : i)))
  }

  const reset = () => {
    if (isRunning) return
    setItems([
      { id: createItemId(), url: '', status: 'idle' },
      { id: createItemId(), url: '', status: 'idle' },
    ])
    setCompletedCount(0)
  }

  const runBatch = useCallback(async () => {
    if (!canStart) return

    const toProcess = filledItems.map((item) => ({
      ...item,
      status: 'pending' as BatchItemStatus,
      error: undefined,
      title: undefined,
    }))
    setItems(toProcess)
    setIsRunning(true)
    setCompletedCount(0)

    let done = 0
    for (const item of toProcess) {
      const url = item.url.trim()
      if (!url) continue

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'processing' } : i))
      )

      const body: Record<string, unknown> = {
        url,
        mode: normalizeExtractionMode(mode),
        outputLanguage,
        ...(folderId ? { folderId } : {}),
      }

      const { title, cached, error } = await runStreamItem(body)
      done++
      setCompletedCount(done)

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: error ? 'error' : cached ? 'cached' : 'done',
                title: title ?? undefined,
                error: error ?? undefined,
              }
            : i
        )
      )
    }

    setIsRunning(false)
    onComplete()
  }, [canStart, filledItems, mode, folderId, outputLanguage, onComplete])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <Layers size={15} className="text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Extracción por Lote
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          máx. {MAX_ITEMS}
        </span>
      </div>

      {/* Mode + Folder selectors */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
            Modo:
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(normalizeExtractionMode(e.target.value))}
            disabled={isRunning}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {EXTRACTION_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {userFolders.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
              Carpeta:
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              disabled={isRunning}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">Sin carpeta</option>
              {userFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* URL inputs */}
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
              {index + 1}
            </span>

            <input
              type="url"
              value={item.url}
              onChange={(e) => updateUrl(item.id, e.target.value)}
              disabled={isRunning}
              placeholder="https://youtube.com/watch?v=..."
              className={`h-10 flex-1 rounded-lg border px-3 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950 dark:text-slate-100 ${
                item.status === 'error'
                  ? 'border-rose-400 bg-rose-50 focus:border-rose-400 focus:ring-rose-100 dark:border-rose-700 dark:bg-rose-950/20 dark:focus:ring-rose-900/30'
                  : 'border-slate-300 bg-white focus:border-indigo-400 focus:ring-indigo-100 dark:border-slate-700 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30'
              }`}
            />

            {/* Status icon */}
            <div className="flex w-5 shrink-0 items-center justify-center">
              {item.status === 'processing' && (
                <Loader2 size={15} className="animate-spin text-indigo-500" />
              )}
              {(item.status === 'done' || item.status === 'cached') && (
                <CheckCircle size={15} className="text-emerald-500" />
              )}
              {item.status === 'error' && (
                <AlertCircle size={15} className="text-rose-500" />
              )}
              {item.status === 'pending' && (
                <Clock size={14} className="text-slate-300 dark:text-slate-600" />
              )}
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              disabled={isRunning || items.length <= 1}
              className="shrink-0 rounded p-1 text-slate-300 transition hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-600"
              aria-label="Eliminar URL"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>

      {/* Result labels (titles / errors) */}
      {items.some((i) => i.title ?? i.error) && (
        <ul className="mt-2 space-y-0.5 pl-7">
          {items.map((item) => {
            if (!item.title && !item.error) return null
            return (
              <li
                key={`lbl-${item.id}`}
                className={`truncate text-xs ${
                  item.error
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
                title={item.error ?? item.title}
              >
                {item.error ?? item.title}
              </li>
            )
          })}
        </ul>
      )}

      {/* Actions row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {items.length < MAX_ITEMS && (
          <button
            type="button"
            onClick={addItem}
            disabled={isRunning}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500"
          >
            <Plus size={13} />
            Agregar URL
          </button>
        )}

        <button
          type="button"
          onClick={() => void runBatch()}
          disabled={!canStart}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
        >
          {isRunning ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              {completedCount} / {filledItems.length} completadas...
            </>
          ) : (
            <>
              <Play size={13} />
              Iniciar lote ({filledItems.length || 0} URL{filledItems.length !== 1 ? 's' : ''})
            </>
          )}
        </button>

        {!isRunning && items.some((i) => i.status !== 'idle') && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <RotateCcw size={13} />
            Limpiar
          </button>
        )}
      </div>

      {isRunning && (
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          Procesando en orden — no cierres esta pestaña.
        </p>
      )}
    </div>
  )
}
