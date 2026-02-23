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
}: ExtractionFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number | null>(null)

  const spawnBinaryTrail = useCallback((toManual: boolean) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = Math.max(rect.height, 80)
    // toManual: input slides RIGHT → wake spawns at left-center, drifts LEFT
    // toIA:     form slides LEFT  → wake spawns at right-center, drifts RIGHT
    const count = 52
    type Particle = {
      x: number; y: number; vx: number; vy: number; char: string
      size: number; maxOpacity: number; color: string; delay: number
      spawned: boolean; life: number; decay: number
    }
    const particles: Particle[] = Array.from({ length: count }, (_, i) => {
      const delay = i * 16
      // Full width spread
      const x = 8 + Math.random() * (canvas.width - 16)
      // toManual: form rises UP   → propulsor en borde INFERIOR, cae hacia ABAJO
      // toIA:     input drops DOWN → propulsor en borde SUPERIOR, sube hacia ARRIBA
      const y = toManual
        ? canvas.height - 2 - Math.random() * 18   // borde inferior
        : 2 + Math.random() * 18                   // borde superior
      const speed = 1.2 + Math.random() * 3.0
      const vy = toManual ? speed : -speed          // DOWN o UP
      const vx = (Math.random() - 0.5) * 0.9       // slight horizontal drift
      const char = Math.random() > 0.5 ? '1' : '0'
      const size = 9 + Math.random() * 8
      const maxOpacity = 0.45 + Math.random() * 0.5
      const hue = 255 + Math.random() * 35
      const lightness = 58 + Math.random() * 28
      const color = `hsl(${hue}, 85%, ${lightness}%)`
      return { x, y, vx, vy, char, size, maxOpacity, color, delay, spawned: false, life: 1.0, decay: 0.006 + Math.random() * 0.009 }
    })
    const startTime = performance.now()
    const animate = (now: number) => {
      const elapsed = now - startTime
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let anyAlive = false
      for (const p of particles) {
        if (elapsed < p.delay) { anyAlive = true; continue }
        p.spawned = true
        p.x += p.vx
        p.y += p.vy
        p.life -= p.decay
        if (p.life <= 0) continue
        anyAlive = true
        ctx.save()
        ctx.globalAlpha = p.life * p.maxOpacity
        ctx.font = `bold ${p.size}px 'Courier New', monospace`
        ctx.fillStyle = p.color
        ctx.fillText(p.char, p.x, p.y)
        ctx.restore()
      }
      if (anyAlive) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        animFrameRef.current = null
      }
    }
    animFrameRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // Manual form state
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualMode, setManualMode] = useState<ExtractionMode>('action_plan')
  const [manualThumbnailUrl, setManualThumbnailUrl] = useState<string | null>(null)
  const [manualThumbnailPreview, setManualThumbnailPreview] = useState<string | null>(null)
  const [isUploadingThumb, setIsUploadingThumb] = useState(false)
  const [thumbError, setThumbError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [cloudinaryAvailable, setCloudinaryAvailable] = useState<boolean | null>(null)

  const toggleManualForm = useCallback((nextOpen?: boolean) => {
    setShowManualForm((prev) => {
      const next = nextOpen !== undefined ? nextOpen : !prev
      onManualToggle?.(next)
      spawnBinaryTrail(next)
      return next
    })
  }, [onManualToggle, spawnBinaryTrail])

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
      toggleManualForm(false)
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
  }, [isCreating, manualMode, manualTitle, manualThumbnailUrl, onManualResult, toggleManualForm])

  const handleCancelManual = useCallback(() => {
    toggleManualForm(false)
    setManualTitle('')
    setManualMode('action_plan')
    setManualThumbnailUrl(null)
    setManualThumbnailPreview(null)
    setThumbError(null)
    setManualError(null)
  }, [toggleManualForm])

  const detectedSourceType: SourceType = uploadedFile
    ? uploadedFile.sourceType
    : detectSourceType(url)

  const isDisabled = isProcessing || isUploading || (!uploadedFile && !url.trim()) || Boolean(urlError)

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const file = event.dataTransfer.files[0]
      if (file) {
        onFileSelect(file)
      }
    },
    [onFileSelect]
  )

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  return (
    <div
      ref={containerRef}
      className="relative mx-auto mb-3 w-full max-w-3xl"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-50"
        aria-hidden="true"
      />
      {/* ── Button bar (separate row, never affects input centering) ── */}
      <div className="mb-2 flex items-center justify-between">
        {/* Left: Manual (fades out) / ← Extraer (fades in) */}
        <div className="flex items-center gap-2">
          {/* Manual button */}
          <div
            className="overflow-hidden shrink-0"
            style={{
              maxWidth: showManualForm ? '0px' : '160px',
              opacity: showManualForm ? 0 : 1,
              transform: showManualForm ? 'translateX(-10px) scale(0.85)' : 'translateX(0px) scale(1)',
              pointerEvents: showManualForm ? 'none' : undefined,
              transition: 'max-width 0.85s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.65s ease, transform 0.8s ease',
            }}
          >
            <button
              type="button"
              onClick={() => toggleManualForm()}
              disabled={isProcessing}
              className="inline-flex h-10 w-max items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-200"
            >
              <PenLine size={14} />
              Manual
            </button>
          </div>

          {/* ← Extraer button */}
          <div
            style={{
              opacity: showManualForm ? 1 : 0,
              transform: showManualForm ? 'translateX(0px) scale(1)' : 'translateX(-12px) scale(0.85)',
              pointerEvents: showManualForm ? undefined : 'none',
              transition: 'opacity 0.65s ease, transform 0.8s ease',
            }}
          >
            <button
              type="button"
              onClick={() => toggleManualForm(false)}
              disabled={isProcessing}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-white/20 dark:hover:text-zinc-200"
            >
              <Bot size={14} />
              IA
            </button>
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
          transition: 'max-height 0.85s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1), transform 0.85s cubic-bezier(0.4, 0, 0.2, 1)',
          transformOrigin: 'left center',
        }}
      >
        <div className="rounded-full border border-zinc-200 bg-white px-3 py-2 dark:border-white/15 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <div className="ml-2 text-zinc-400 dark:text-zinc-500">
              <SourceIcon sourceType={detectedSourceType} />
            </div>

            {uploadedFile ? (
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
                placeholder={getPlaceholder(detectedSourceType, false)}
                className="h-12 w-full bg-transparent px-2 text-base text-zinc-800 placeholder:text-zinc-400 outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && !isDisabled && onExtract()}
                aria-invalid={Boolean(urlError)}
                aria-describedby={urlError ? 'source-input-error' : undefined}
              />
            )}

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

            <button
              onClick={onExtract}
              disabled={isDisabled}
              className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-colors duration-200 ${
                isDisabled
                  ? isProcessing || isUploading
                    ? 'cursor-wait bg-zinc-400 dark:bg-zinc-700'
                    : 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-700'
                  : 'bg-violet-600 hover:bg-violet-700'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Analizando
                </>
              ) : (
                <>
                  Extraer
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {urlError && !uploadedFile && (
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
          transition: 'max-height 0.85s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1), transform 0.85s cubic-bezier(0.4, 0, 0.2, 1)',
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
    </div>
  )
}
