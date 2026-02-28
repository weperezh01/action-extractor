'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import {
  AlignLeft,
  ArrowRight,
  Bot,
  FileText,
  Globe,
  History,
  ImageIcon,
  Paperclip,
  PenLine,
  Play,
  Search,
  X,
} from 'lucide-react'
import { detectSourceType } from '@/lib/source-detector'
import { EXTRACTION_MODE_OPTIONS, normalizeExtractionMode, type ExtractionMode } from '@/lib/extraction-modes'
import type { ExtractResult, SourceType } from '@/app/home/lib/types'

export interface UploadedFileState {
  name: string
  sourceType: 'pdf' | 'docx'
  text: string
  charCount: number
  sourceLabel: string
}

interface ExtractionFormProps {
  url: string
  isProcessing: boolean
  urlError: string | null
  onUrlChange: (value: string) => void
  onExtract: () => void
  onScrollToHistory: () => void
  hasHistory: boolean
  // Multi-source props
  uploadedFile: UploadedFileState | null
  isUploading: boolean
  uploadError: string | null
  onFileSelect: (file: File) => void
  onClearFile: () => void
  // Manual extraction
  onManualResult: (result: ExtractResult) => void
  onManualToggle?: (open: boolean) => void
  // Public playbook search
  onOpenPublicPlaybook?: (extractionId: string) => Promise<void> | void
}

type EntryMode = 'manual' | 'ia' | 'search'

const ENTRY_MODE_RING = [
  { value: 'manual', label: 'Manual', icon: PenLine },
  { value: 'ia', label: 'Extraer', icon: Bot },
  { value: 'search', label: 'Buscar', icon: Search },
] as const satisfies ReadonlyArray<{
  value: EntryMode
  label: string
  icon: typeof PenLine
}>

interface PublicPlaybookSearchItem {
  id: string
  title: string
  objectivePreview: string
  createdAt: string
  mode: string
  thumbnailUrl: string | null
  sourceLabel: string | null
  ownerName: string | null
  ownerEmail: string | null
}

function SourceIcon({ sourceType, size = 17 }: { sourceType: SourceType; size?: number }) {
  switch (sourceType) {
    case 'youtube':
      return <Play size={size} />
    case 'web_url':
      return <Globe size={size} />
    case 'pdf':
    case 'docx':
      return <FileText size={size} />
    default:
      return <AlignLeft size={size} />
  }
}

function getPlaceholder(sourceType: SourceType, hasFile: boolean): string {
  if (hasFile) return ''
  switch (sourceType) {
    case 'youtube':
      return 'Pega el link de YouTube...'
    case 'web_url':
      return 'URL de la página web...'
    default:
      return 'Link de YouTube, web, texto o archivo (.pdf, .docx)...'
  }
}

function formatSearchDate(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Fecha desconocida'
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  } catch {
    return 'Fecha desconocida'
  }
}

export function ExtractionForm({
  url,
  isProcessing,
  urlError,
  onUrlChange,
  onExtract,
  onScrollToHistory,
  hasHistory,
  uploadedFile,
  isUploading,
  uploadError,
  onFileSelect,
  onClearFile,
  onManualResult,
  onManualToggle,
  onOpenPublicPlaybook,
}: ExtractionFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)

  // Manual form state
  const [entryMode, setEntryMode] = useState<EntryMode>('ia')
  const showManualForm = entryMode === 'manual'
  const [manualTitle, setManualTitle] = useState('')
  const [manualMode, setManualMode] = useState<ExtractionMode>('action_plan')
  const [manualThumbnailUrl, setManualThumbnailUrl] = useState<string | null>(null)
  const [manualThumbnailPreview, setManualThumbnailPreview] = useState<string | null>(null)
  const [isUploadingThumb, setIsUploadingThumb] = useState(false)
  const [thumbError, setThumbError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [cloudinaryAvailable, setCloudinaryAvailable] = useState<boolean | null>(null)
  const [ringTransition, setRingTransition] = useState<{ nonce: number; direction: 1 | -1 } | null>(null)
  const [ringPulseActive, setRingPulseActive] = useState(false)
  const ringPulseTimeoutRef = useRef<number | null>(null)
  const [publicSearchResults, setPublicSearchResults] = useState<PublicPlaybookSearchItem[]>([])
  const [publicSearchLoading, setPublicSearchLoading] = useState(false)
  const [publicSearchError, setPublicSearchError] = useState<string | null>(null)
  const [openingPublicPlaybookId, setOpeningPublicPlaybookId] = useState<string | null>(null)
  const isSearchMode = entryMode === 'search'

  const parseApiError = useCallback((payload: unknown, fallback: string) => {
    const msg = (payload as { error?: unknown } | null)?.error
    return typeof msg === 'string' && msg.trim() ? msg : fallback
  }, [])

  const getEntryModeIndex = useCallback(
    (mode: EntryMode) => ENTRY_MODE_RING.findIndex((option) => option.value === mode),
    []
  )

  const triggerRingTransition = useCallback(
    (fromMode: EntryMode, toMode: EntryMode) => {
      const fromIndex = getEntryModeIndex(fromMode)
      const toIndex = getEntryModeIndex(toMode)
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

      const len = ENTRY_MODE_RING.length
      const forward = (toIndex - fromIndex + len) % len
      const backward = (fromIndex - toIndex + len) % len
      const direction: 1 | -1 = forward <= backward ? 1 : -1
      setRingTransition((prev) => ({
        nonce: (prev?.nonce ?? 0) + 1,
        direction,
      }))
      setRingPulseActive(true)
      if (ringPulseTimeoutRef.current !== null) {
        window.clearTimeout(ringPulseTimeoutRef.current)
      }
      ringPulseTimeoutRef.current = window.setTimeout(() => {
        setRingPulseActive(false)
        ringPulseTimeoutRef.current = null
      }, 2640)
    },
    [getEntryModeIndex]
  )

  const rotateEntryMode = useCallback(() => {
    if (isProcessing) return
    const currentIndex = getEntryModeIndex(entryMode)
    const safeIndex = currentIndex >= 0 ? currentIndex : 0
    const nextMode = ENTRY_MODE_RING[(safeIndex + 1) % ENTRY_MODE_RING.length].value
    triggerRingTransition(entryMode, nextMode)
    setEntryMode(nextMode)
  }, [entryMode, getEntryModeIndex, isProcessing, triggerRingTransition])

  const setEntryModeWithFx = useCallback(
    (nextMode: EntryMode) => {
      if (isProcessing || nextMode === entryMode) return
      triggerRingTransition(entryMode, nextMode)
      setEntryMode(nextMode)
    },
    [entryMode, isProcessing, triggerRingTransition]
  )

  useEffect(() => {
    return () => {
      if (ringPulseTimeoutRef.current !== null) {
        window.clearTimeout(ringPulseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    onManualToggle?.(showManualForm)
  }, [onManualToggle, showManualForm])

  useEffect(() => {
    if (!isSearchMode) return
    if (uploadedFile) onClearFile()
  }, [isSearchMode, onClearFile, uploadedFile])

  // Probe if Cloudinary is available by checking the thumbnail endpoint
  useEffect(() => {
    if (!showManualForm || cloudinaryAvailable !== null) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/extract/thumbnail', { method: 'POST', body: new FormData() })
        // 401 means endpoint exists and is reachable (user not logged in edge case handled by server)
        // 503 means Cloudinary not configured
        // 400 (no file) means endpoint exists and Cloudinary is configured
        if (!cancelled) {
          setCloudinaryAvailable(res.status !== 503)
        }
      } catch {
        if (!cancelled) setCloudinaryAvailable(false)
      }
    })()
    return () => { cancelled = true }
  }, [showManualForm, cloudinaryAvailable])

  const handleThumbSelect = useCallback(async (file: File) => {
    setThumbError(null)
    setIsUploadingThumb(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract/thumbnail', { method: 'POST', body: formData })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok) {
        setThumbError(data?.error ?? 'No se pudo subir la imagen.')
        return
      }
      if (data?.url) {
        setManualThumbnailUrl(data.url)
        setManualThumbnailPreview(data.url)
      }
    } catch {
      setThumbError('Error de conexión al subir la imagen.')
    } finally {
      setIsUploadingThumb(false)
    }
  }, [])

  const handleClearThumb = useCallback(() => {
    setManualThumbnailUrl(null)
    setManualThumbnailPreview(null)
    setThumbError(null)
    if (thumbInputRef.current) thumbInputRef.current.value = ''
  }, [])

  const handleSearchPublicPlaybooks = useCallback(async () => {
    if (publicSearchLoading) return
    const query = url.trim()
    if (query.length < 2) {
      setPublicSearchError('Escribe al menos 2 caracteres para buscar playbooks públicos.')
      setPublicSearchResults([])
      return
    }

    setPublicSearchError(null)
    setPublicSearchLoading(true)
    try {
      const res = await fetch(
        `/api/public-playbooks/search?q=${encodeURIComponent(query)}&limit=18`,
        { cache: 'no-store' }
      )
      const data = (await res.json().catch(() => null)) as
        | { items?: unknown; error?: unknown }
        | null
      if (!res.ok) {
        setPublicSearchResults([])
        setPublicSearchError(parseApiError(data, 'No se pudieron buscar playbooks públicos.'))
        return
      }

      const items = Array.isArray(data?.items) ? (data.items as PublicPlaybookSearchItem[]) : []
      setPublicSearchResults(items)
      if (items.length === 0) {
        setPublicSearchError('No se encontraron playbooks públicos con ese criterio.')
      }
    } catch {
      setPublicSearchResults([])
      setPublicSearchError('Error de conexión buscando playbooks públicos.')
    } finally {
      setPublicSearchLoading(false)
    }
  }, [parseApiError, publicSearchLoading, url])

  const handleCreate = useCallback(async () => {
    if (isCreating) return
    setManualError(null)
    setIsCreating(true)
    try {
      const res = await fetch('/api/extractions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle.trim() || undefined,
          mode: manualMode,
          thumbnailUrl: manualThumbnailUrl ?? undefined,
        }),
      })
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : 'No se pudo crear la extracción.'
        setManualError(msg)
        return
      }
      if (!data) {
        setManualError('Respuesta inesperada del servidor.')
        return
      }
      // Reset form and close
      setEntryModeWithFx('ia')
      setManualTitle('')
      setManualMode('action_plan')
      setManualThumbnailUrl(null)
      setManualThumbnailPreview(null)
      setManualError(null)
      onManualResult(data as unknown as ExtractResult)
    } catch {
      setManualError('Error de conexión. Intenta de nuevo.')
    } finally {
      setIsCreating(false)
    }
  }, [isCreating, manualMode, manualTitle, manualThumbnailUrl, onManualResult, setEntryModeWithFx])

  const handleCancelManual = useCallback(() => {
    setEntryModeWithFx('ia')
    setManualTitle('')
    setManualMode('action_plan')
    setManualThumbnailUrl(null)
    setManualThumbnailPreview(null)
    setThumbError(null)
    setManualError(null)
  }, [setEntryModeWithFx])

  const detectedSourceType: SourceType = uploadedFile
    ? uploadedFile.sourceType
    : detectSourceType(url)

  const isDisabled = isProcessing || isUploading || (!uploadedFile && !url.trim()) || Boolean(urlError)
  const isSearchActionDisabled =
    isProcessing || publicSearchLoading || url.trim().length < 2
  const primaryActionDisabled = isSearchMode ? isSearchActionDisabled : isDisabled

  const handlePrimaryAction = useCallback(() => {
    if (isSearchMode) {
      void handleSearchPublicPlaybooks()
      return
    }
    onExtract()
  }, [handleSearchPublicPlaybooks, isSearchMode, onExtract])

  useEffect(() => {
    if (isSearchMode) return
    if (publicSearchResults.length === 0 && !publicSearchError && openingPublicPlaybookId === null) return
    setPublicSearchResults([])
    setPublicSearchError(null)
    setOpeningPublicPlaybookId(null)
  }, [isSearchMode, openingPublicPlaybookId, publicSearchError, publicSearchResults.length])

  const activeEntryModeIndex = ENTRY_MODE_RING.findIndex((option) => option.value === entryMode)
  const getRingOffset = (index: number) => {
    const len = ENTRY_MODE_RING.length
    const forward = (index - activeEntryModeIndex + len) % len
    const backward = (activeEntryModeIndex - index + len) % len
    if (forward === 0) return 0
    return forward <= backward ? forward : -backward
  }

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      if (isSearchMode) return
      const file = event.dataTransfer.files[0]
      if (file) {
        onFileSelect(file)
      }
    },
    [isSearchMode, onFileSelect]
  )

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  return (
    <div
      className="relative mx-auto mb-3 w-full max-w-3xl"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* ── Button bar (separate row, never affects input centering) ── */}
      <div className="mb-2 flex items-center justify-between">
        {/* Left: 3-way entry ring */}
        <div className="flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Modo de entrada"
            className={`relative h-11 w-[16.2rem] shrink-0 [perspective:1100px] transition-transform duration-[2400ms] sm:w-[17.2rem] ${
              ringPulseActive ? 'scale-[1.01]' : ''
            }`}
          >
            <div className="absolute inset-0 rounded-full border border-zinc-200 bg-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-8px_14px_rgba(15,23,42,0.09),0_6px_16px_rgba(15,23,42,0.08)] dark:border-white/15 dark:bg-zinc-950/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-8px_14px_rgba(2,6,23,0.6),0_6px_16px_rgba(2,6,23,0.35)]" />
            <div
              className={`pointer-events-none absolute inset-0 rounded-full border border-sky-300/70 transition-opacity duration-[2400ms] dark:border-sky-400/35 ${
                ringPulseActive ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div className="pointer-events-none absolute inset-x-6 top-[5px] h-[38%] rounded-full bg-white/60 blur-[1.5px] dark:bg-white/10" />
            <div className="pointer-events-none absolute inset-y-[9px] left-1/2 w-[82%] -translate-x-1/2 rounded-full border border-zinc-200/70 dark:border-white/10" />
            <div className="pointer-events-none absolute inset-y-[5px] left-[8%] w-[84%] overflow-hidden rounded-full">
              {ringTransition && (
                <div
                  key={`mode-ring-sweep-${ringTransition.nonce}`}
                  className="entry-ring-sweep absolute inset-y-0 w-[36%] rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(56,189,248,0) 0%, rgba(99,102,241,0.24) 42%, rgba(56,189,248,0.44) 60%, rgba(56,189,248,0) 100%)',
                    animation:
                      ringTransition.direction > 0
                        ? 'entry-ring-sweep-right 3240ms cubic-bezier(0.22,1,0.36,1)'
                        : 'entry-ring-sweep-left 3240ms cubic-bezier(0.22,1,0.36,1)',
                    transform: ringTransition.direction > 0 ? 'translateX(-170%)' : 'translateX(330%)',
                  }}
                />
              )}
            </div>
            {ENTRY_MODE_RING.map((option, index) => {
              const offset = getRingOffset(index)
              const isActive = offset === 0
              const Icon = option.icon
              const sideDistance = Math.abs(offset)
              const translateX = offset * 80
              const scale = isActive ? 1 : sideDistance === 1 ? 0.84 : 0.7
              const rotateY = isActive ? 0 : offset > 0 ? -34 : 34
              const opacity = isActive ? 1 : sideDistance === 1 ? 0.72 : 0.42
              const zIndex = isActive ? 40 : 30 - sideDistance

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => {
                    if (isProcessing) return
                    if (option.value === entryMode) {
                      rotateEntryMode()
                      return
                    }
                    setEntryModeWithFx(option.value)
                  }}
                  disabled={isProcessing}
                  className={`absolute left-1/2 top-1/2 inline-flex h-9 w-[7.25rem] -translate-y-1/2 items-center justify-center rounded-full border text-xs font-semibold transition-[transform,opacity,background-color,color,border-color,box-shadow] duration-[2400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive
                      ? 'relative overflow-hidden border-zinc-200 bg-white text-zinc-700 shadow-[0_8px_14px_rgba(15,23,42,0.14)] dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-[0_10px_18px_rgba(2,6,23,0.6)]'
                      : 'border-zinc-200/70 bg-zinc-100/75 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-200'
                  }`}
                  style={{
                    transform: `translate3d(calc(-50% + ${translateX}px), -50%, ${isActive ? 28 : -18}px) scale(${scale}) rotateY(${rotateY}deg)`,
                    opacity,
                    zIndex,
                  }}
                >
                  {isActive && (
                    <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.8)_0%,rgba(125,211,252,0.22)_45%,rgba(99,102,241,0.15)_100%)] dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.14)_0%,rgba(56,189,248,0.2)_45%,rgba(99,102,241,0.24)_100%)]" />
                  )}
                  <span className="relative inline-flex items-center gap-1.5">
                    <Icon size={13} />
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: History (only if exists) */}
        {hasHistory && (
          <button
            type="button"
            onClick={onScrollToHistory}
            aria-label="Ver historial"
            className="group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:from-indigo-100 hover:to-sky-100 hover:shadow-md dark:border-indigo-800/70 dark:from-indigo-950/40 dark:to-sky-950/40 dark:text-indigo-300 dark:hover:border-indigo-700"
          >
            <History size={15} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
          </button>
        )}
      </div>

      {/* ── Input field (full width, centered) ── */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: showManualForm ? '0px' : '80px',
          opacity: showManualForm ? 0 : 1,
          transform: showManualForm
            ? 'perspective(700px) translateX(56px) rotateY(-12deg) scale(0.88)'
            : 'perspective(700px) translateX(0px) rotateY(0deg) scale(1)',
          pointerEvents: showManualForm ? 'none' : undefined,
          transition: 'max-height 3.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 2.85s cubic-bezier(0.4, 0, 0.2, 1), transform 3.45s cubic-bezier(0.4, 0, 0.2, 1)',
          transformOrigin: 'left center',
        }}
      >
          <div className="rounded-full border border-zinc-200 bg-white px-3 py-2 dark:border-white/15 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <div className="ml-2 text-zinc-400 dark:text-zinc-500">
              {isSearchMode ? <Search size={17} /> : <SourceIcon sourceType={detectedSourceType} />}
            </div>

            {!isSearchMode && uploadedFile ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
                <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {uploadedFile.name}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {(uploadedFile.charCount / 1000).toFixed(1)}k chars
                </span>
                <button
                  type="button"
                  onClick={onClearFile}
                  disabled={isProcessing}
                  className="ml-auto shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Quitar archivo"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <input
                type="text"
                data-extraction-input="true"
                placeholder={
                  isSearchMode
                    ? 'Busca playbooks públicos por título, objetivo o autor...'
                    : getPlaceholder(detectedSourceType, false)
                }
                className="h-12 w-full bg-transparent px-2 text-base text-zinc-800 placeholder:text-zinc-400 outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && !primaryActionDisabled && handlePrimaryAction()}
                aria-invalid={isSearchMode ? false : Boolean(urlError)}
                aria-describedby={!isSearchMode && urlError ? 'source-input-error' : undefined}
              />
            )}

            {!isSearchMode && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || isUploading}
                  className="shrink-0 rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  title="Subir PDF o DOCX"
                  aria-label="Subir archivo PDF o DOCX"
                >
                  {isUploading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                  ) : (
                    <Paperclip size={16} />
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      onFileSelect(file)
                      event.target.value = ''
                    }
                  }}
                />
              </>
            )}

            <button
              onClick={handlePrimaryAction}
              disabled={primaryActionDisabled}
              className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-colors duration-200 ${
                primaryActionDisabled
                  ? isProcessing || isUploading || publicSearchLoading
                    ? 'cursor-wait bg-zinc-400 dark:bg-zinc-700'
                    : 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-700'
                  : 'bg-violet-600 hover:bg-violet-700'
              }`}
            >
              {!isSearchMode && isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Analizando
                </>
              ) : isSearchMode && publicSearchLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Buscando
                </>
              ) : (
                <>
                  {isSearchMode ? 'Buscar' : 'Extraer'}
                  {isSearchMode ? <Search size={16} /> : <ArrowRight size={16} />}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {urlError && !uploadedFile && !isSearchMode && (
        <p
          id="source-input-error"
          className="mt-2 px-3 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {urlError}
        </p>
      )}

      {uploadError && (
        <p className="mt-2 px-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {uploadError}
        </p>
      )}

      <div
        className="overflow-hidden"
        style={{
          maxHeight: isSearchMode ? '420px' : '0px',
          opacity: isSearchMode ? 1 : 0,
          transform: isSearchMode ? 'translateY(0px) scale(1)' : 'translateY(-10px) scale(0.97)',
          pointerEvents: isSearchMode ? undefined : 'none',
          transition:
            'max-height 2.85s cubic-bezier(0.22,1,0.36,1), opacity 2.1s ease, transform 2.4s cubic-bezier(0.22,1,0.36,1)',
          transformOrigin: 'center top',
        }}
      >
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              Resultados públicos
            </p>
            {publicSearchLoading && (
              <div className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                Buscando...
              </div>
            )}
          </div>

          {publicSearchError && (
            <p className="mb-2 text-xs text-red-600 dark:text-red-400" role="alert">
              {publicSearchError}
            </p>
          )}

          {publicSearchResults.length > 0 ? (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {publicSearchResults.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!onOpenPublicPlaybook) {
                        setPublicSearchError('Disponible en la app principal con sesión iniciada.')
                        return
                      }
                      setPublicSearchError(null)
                      setOpeningPublicPlaybookId(item.id)
                      void Promise.resolve(onOpenPublicPlaybook(item.id))
                        .then(() => {
                          setPublicSearchError(null)
                        })
                        .catch((error: unknown) => {
                          const msg =
                            error instanceof Error && error.message.trim()
                              ? error.message
                              : 'No se pudo abrir el playbook público.'
                          setPublicSearchError(msg)
                        })
                        .finally(() => {
                          setOpeningPublicPlaybookId((current) => (current === item.id ? null : current))
                        })
                    }}
                    disabled={openingPublicPlaybookId === item.id}
                    className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-zinc-900/80"
                  >
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="h-12 w-20 shrink-0 rounded-md border border-zinc-200 object-cover dark:border-white/10"
                      />
                    ) : (
                      <span className="inline-flex h-12 w-20 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 dark:border-white/10 dark:text-zinc-500">
                        <FileText size={14} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {(item.ownerName?.trim() || item.ownerEmail || 'Autor desconocido')} · {formatSearchDate(item.createdAt)}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.objectivePreview}
                      </span>
                    </span>
                    {openingPublicPlaybookId === item.id && (
                      <span className="inline-flex h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !publicSearchLoading && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Escribe y presiona <span className="font-semibold">Buscar</span> para encontrar playbooks públicos.
              </p>
            )
          )}
        </div>
      </div>

      {/* Manual extraction mini-form — always rendered, animated in/out */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: showManualForm ? '700px' : '0px',
          opacity: showManualForm ? 1 : 0,
          transform: showManualForm
            ? 'perspective(700px) translateX(0px) rotateY(0deg) scale(1)'
            : 'perspective(700px) translateX(-56px) rotateY(12deg) scale(0.88)',
          pointerEvents: showManualForm ? undefined : 'none',
          transition: 'max-height 3.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 2.85s cubic-bezier(0.4, 0, 0.2, 1), transform 3.45s cubic-bezier(0.4, 0, 0.2, 1)',
          transformOrigin: 'right center',
        }}
      >
        <div className="mt-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="space-y-3">
            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Título <span className="font-normal text-zinc-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="Ej: Plan de lanzamiento Q1"
                maxLength={200}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-500"
              />
            </div>

            {/* Mode */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Modo
              </label>
              <select
                value={manualMode}
                onChange={(e) => setManualMode(normalizeExtractionMode(e.target.value))}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {EXTRACTION_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Thumbnail — only if Cloudinary is available */}
            {cloudinaryAvailable === true && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Imagen de portada <span className="font-normal text-zinc-400">(opcional)</span>
                </label>
                {manualThumbnailPreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={manualThumbnailPreview}
                      alt="Vista previa portada"
                      className="h-20 w-36 rounded-lg border border-zinc-200 object-cover dark:border-white/10"
                    />
                    <button
                      type="button"
                      onClick={handleClearThumb}
                      className="absolute -right-2 -top-2 rounded-full bg-white p-0.5 shadow-md border border-zinc-200 text-zinc-500 hover:text-zinc-700 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-400 dark:hover:text-zinc-200"
                      aria-label="Quitar imagen"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    disabled={isUploadingThumb}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-white/20"
                  >
                    {isUploadingThumb ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <ImageIcon size={13} />
                        Subir imagen
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      void handleThumbSelect(file)
                      e.target.value = ''
                    }
                  }}
                />
                {thumbError && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">{thumbError}</p>
                )}
              </div>
            )}

            {manualError && (
              <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                {manualError}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelManual}
                disabled={isCreating}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={isCreating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
              >
                {isCreating ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Creando...
                  </>
                ) : (
                  <>
                    <PenLine size={12} />
                    Crear
                  </>
                )}
              </button>
            </div>
          </div>
          </div>

        </div>
      </div>
      <style jsx>{`
        @keyframes entry-ring-sweep-right {
          0% {
            opacity: 0;
            transform: translateX(-170%);
          }
          18% {
            opacity: 0.9;
          }
          100% {
            opacity: 0;
            transform: translateX(330%);
          }
        }

        @keyframes entry-ring-sweep-left {
          0% {
            opacity: 0;
            transform: translateX(330%);
          }
          18% {
            opacity: 0.9;
          }
          100% {
            opacity: 0;
            transform: translateX(-170%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .entry-ring-sweep {
            animation: none !important;
            opacity: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
