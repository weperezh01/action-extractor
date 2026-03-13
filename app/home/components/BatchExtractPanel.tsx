'use client'

import { useCallback, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Clock,
  FolderPlus,
  Layers,
  ListVideo,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import type { ExtractionMode } from '@/lib/extraction-modes'
import { EXTRACTION_MODE_OPTIONS, normalizeExtractionMode } from '@/lib/extraction-modes'
import type { ExtractionOutputLanguage } from '@/lib/output-language'
import type { FolderItem } from '@/app/home/components/FolderDock'
import { isSystemExtractionFolderId } from '@/lib/extraction-folders'
import { isPlaylistUrl } from '@/lib/source-detector'

const MAX_ITEMS_MANUAL = 5
const MAX_ITEMS_PLAYLIST = 20

type BatchItemStatus = 'idle' | 'pending' | 'processing' | 'done' | 'cached' | 'error'

interface BatchItem {
  id: string
  url: string
  status: BatchItemStatus
  title?: string
  error?: string
}

interface PlaylistVideo {
  videoId: string
  title: string
  url: string
  thumbnailUrl: string | null
  position: number
}

interface PlaylistResult {
  playlistId: string
  title: string
  videoCount: number
  videos: PlaylistVideo[]
}

export interface BatchExtractPanelProps {
  extractionMode: ExtractionMode
  outputLanguage: ExtractionOutputLanguage
  folders: FolderItem[]
  onComplete: () => void
  initialUrls?: string[]
}

function createItemId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildInitialItems(initialUrls?: string[], maxItems = MAX_ITEMS_MANUAL): BatchItem[] {
  const seeded = (initialUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((url) => ({
      id: createItemId(),
      url,
      status: 'idle' as const,
    }))

  const targetCount = Math.min(maxItems, Math.max(2, seeded.length + (seeded.length < maxItems ? 1 : 0)))
  while (seeded.length < targetCount) {
    seeded.push({ id: createItemId(), url: '', status: 'idle' })
  }

  return seeded
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
  initialUrls,
}: BatchExtractPanelProps) {
  // ── batch state ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<BatchItem[]>(() => buildInitialItems(initialUrls))
  const [maxItems, setMaxItems] = useState(MAX_ITEMS_MANUAL)
  const [mode, setMode] = useState<ExtractionMode>(extractionMode)
  const [folderId, setFolderId] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)

  // ── playlist state ────────────────────────────────────────────────────────
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [playlistInput, setPlaylistInput] = useState('')
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [playlistResult, setPlaylistResult] = useState<PlaylistResult | null>(null)
  const [playlistError, setPlaylistError] = useState<string | null>(null)
  const [autoCreateFolder, setAutoCreateFolder] = useState(true)

  const userFolders = folders.filter((f) => !isSystemExtractionFolderId(f.id))
  const filledItems = items.filter((i) => i.url.trim())
  const canStart = filledItems.length > 0 && !isRunning

  // ── manual batch handlers ─────────────────────────────────────────────────
  const addItem = () => {
    if (items.length >= maxItems || isRunning) return
    setItems((prev) => [...prev, { id: createItemId(), url: '', status: 'idle' }])
  }

  const removeItem = (id: string) => {
    if (isRunning) return
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev))
  }

  const updateUrl = (id: string, url: string) => {
    if (isRunning) return
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, url } : i)))
  }

  const reset = () => {
    if (isRunning) return
    setItems(buildInitialItems(initialUrls))
    setMaxItems(MAX_ITEMS_MANUAL)
    setCompletedCount(0)
  }

  // ── playlist handlers ─────────────────────────────────────────────────────
  const loadPlaylist = async () => {
    const url = playlistInput.trim()
    if (!url || playlistLoading) return
    if (!isPlaylistUrl(url)) {
      setPlaylistError('La URL no parece ser una playlist de YouTube válida.')
      return
    }

    setPlaylistLoading(true)
    setPlaylistError(null)
    setPlaylistResult(null)

    try {
      const res = await fetch('/api/youtube/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistUrl: url }),
      })
      const data = (await res.json().catch(() => null)) as
        | (PlaylistResult & { error?: string })
        | null

      if (!res.ok || !data) {
        setPlaylistError(
          typeof data?.error === 'string' ? data.error : 'No se pudo cargar la playlist.'
        )
        return
      }

      setPlaylistResult(data)
    } catch {
      setPlaylistError('Error de conexión al cargar la playlist.')
    } finally {
      setPlaylistLoading(false)
    }
  }

  const usePlaylistItems = async () => {
    if (!playlistResult) return

    const videos = playlistResult.videos.slice(0, MAX_ITEMS_PLAYLIST)
    const newItems: BatchItem[] = videos.map((v) => ({
      id: createItemId(),
      url: v.url,
      status: 'idle',
    }))

    setItems(newItems)
    setMaxItems(MAX_ITEMS_PLAYLIST)

    // Auto-create folder with playlist name
    if (autoCreateFolder) {
      try {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: playlistResult.title.slice(0, 80), color: 'indigo' }),
        })
        if (res.ok) {
          const data = (await res.json()) as { folder?: { id?: string } }
          if (data.folder?.id) {
            setFolderId(data.folder.id)
          }
        }
      } catch {
        // proceed without folder if creation fails
      }
    }

    setShowPlaylist(false)
  }

  // ── run batch ─────────────────────────────────────────────────────────────
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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Extracción por Lote
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            máx. {maxItems}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowPlaylist((v) => !v)
            setPlaylistError(null)
          }}
          className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
            showPlaylist
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
              : 'border-slate-300 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-600'
          }`}
        >
          <ListVideo size={12} />
          Playlist
          <ChevronDown
            size={11}
            className={`transition-transform ${showPlaylist ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Playlist section */}
      {showPlaylist && (
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <p className="mb-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            Cargar desde Playlist de YouTube
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={playlistInput}
              onChange={(e) => {
                setPlaylistInput(e.target.value)
                setPlaylistError(null)
                setPlaylistResult(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void loadPlaylist()
              }}
              placeholder="https://youtube.com/playlist?list=PL..."
              disabled={playlistLoading}
              className="h-9 flex-1 rounded-lg border border-indigo-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 dark:border-indigo-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-900/30"
            />
            <button
              type="button"
              onClick={() => void loadPlaylist()}
              disabled={!playlistInput.trim() || playlistLoading}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {playlistLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {playlistLoading ? 'Cargando...' : 'Cargar'}
            </button>
          </div>

          {playlistError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={12} />
              {playlistError}
            </p>
          )}

          {playlistResult && (
            <div className="mt-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                    {playlistResult.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {playlistResult.videoCount} videos en total · se procesarán los primeros{' '}
                    {Math.min(playlistResult.videos.length, MAX_ITEMS_PLAYLIST)}
                  </p>
                </div>
                <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" />
              </div>

              {/* Video list preview */}
              <ul className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-indigo-100 bg-white p-2 dark:border-indigo-900/40 dark:bg-slate-900">
                {playlistResult.videos.slice(0, MAX_ITEMS_PLAYLIST).map((v, i) => (
                  <li
                    key={v.videoId}
                    className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <span className="w-4 shrink-0 text-center text-[10px] font-semibold text-slate-400">
                      {i + 1}
                    </span>
                    <span className="truncate">{v.title}</span>
                  </li>
                ))}
              </ul>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={autoCreateFolder}
                  onChange={(e) => setAutoCreateFolder(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <FolderPlus size={12} className="text-indigo-500" />
                Crear carpeta{' '}
                <strong>&ldquo;{playlistResult.title.slice(0, 40)}&rdquo;</strong>{' '}
                automáticamente
              </label>

              <button
                type="button"
                onClick={() => void usePlaylistItems()}
                className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <Layers size={13} />
                Agregar {Math.min(playlistResult.videos.length, MAX_ITEMS_PLAYLIST)} videos al lote
              </button>
            </div>
          )}
        </div>
      )}

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
        {items.length < maxItems && (
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
