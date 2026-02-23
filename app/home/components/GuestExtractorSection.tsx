'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, UserPlus } from 'lucide-react'
import { ExtractionForm } from '@/app/home/components/ExtractionForm'
import { WorkspaceControlsDock } from '@/app/home/components/WorkspaceControlsDock'
import { ResultPanel } from '@/app/home/components/ResultPanel'
import {
  DEFAULT_EXTRACTION_MODE,
  getExtractionModeLabel,
  normalizeExtractionMode,
  type ExtractionMode,
} from '@/lib/extraction-modes'
import {
  DEFAULT_EXTRACTION_OUTPUT_LANGUAGE,
  type ExtractionOutputLanguage,
} from '@/lib/output-language'
import { buildExtractionMarkdown } from '@/lib/export-content'
import { detectSourceType } from '@/lib/source-detector'
import { parseSseFrame } from '@/app/home/lib/utils'
import type { ExtractResult, Phase, SourceType } from '@/app/home/lib/types'
import type { UploadedFileState } from '@/app/home/components/ExtractionForm'
import { t, type Lang } from '@/app/home/lib/i18n'

const GUEST_ID_KEY = 'ae-guest-id'
export const PENDING_EXTRACTIONS_KEY = 'ae-pending-extractions'

function savePendingExtractions(items: StoredExtraction[]) {
  if (items.length === 0) return
  try {
    const payload = items.map((ex) => ({
      url: ex.url,
      mode: ex.mode,
      objective: ex.result.objective,
      phases: ex.result.phases,
      proTip: ex.result.proTip,
      metadata: ex.result.metadata,
      videoTitle: ex.result.videoTitle ?? null,
      thumbnailUrl: ex.result.thumbnailUrl ?? null,
      sourceType: ex.result.sourceType ?? null,
      sourceLabel: ex.result.sourceLabel ?? null,
    }))
    localStorage.setItem(PENDING_EXTRACTIONS_KEY, JSON.stringify(payload))
  } catch {
    // localStorage may not be available — fail silently
  }
}

function getOrCreateGuestId(): string {
  try {
    const stored = localStorage.getItem(GUEST_ID_KEY)
    if (stored) return stored
    const newId = crypto.randomUUID()
    localStorage.setItem(GUEST_ID_KEY, newId)
    return newId
  } catch {
    return crypto.randomUUID()
  }
}

function parseStreamPreview(raw: string): {
  objective: string | null
  phases: Array<{ title: string; items: string[] }>
} {
  if (!raw) return { objective: null, phases: [] }

  const objM = raw.match(/"objective"\s*:\s*"([^"]+)"/)
  const objective = objM ? objM[1].trim() || null : null

  const phasesIdx = raw.indexOf('"phases"')
  if (phasesIdx === -1) return { objective, phases: [] }
  const phasesText = raw.slice(phasesIdx)

  const phases: Array<{ title: string; items: string[] }> = []
  const titleRe = /"title"\s*:\s*"([^"]+)"/g
  let titleMatch: RegExpExecArray | null
  while ((titleMatch = titleRe.exec(phasesText)) !== null) {
    const title = titleMatch[1].trim()
    if (!title) continue

    const afterTitle = phasesText.slice(titleMatch.index + titleMatch[0].length)
    const itemsIdx = afterTitle.indexOf('"items"')
    const items: string[] = []

    if (itemsIdx !== -1) {
      const afterItems = afterTitle.slice(itemsIdx)
      const bracketIdx = afterItems.indexOf('[')
      if (bracketIdx !== -1) {
        const arrayContent = afterItems.slice(bracketIdx + 1)
        const closingBracket = arrayContent.indexOf(']')
        const content = closingBracket !== -1 ? arrayContent.slice(0, closingBracket) : arrayContent
        const itemRe = /"([^"]{4,})"/g
        let itemM: RegExpExecArray | null
        while ((itemM = itemRe.exec(content)) !== null) {
          const item = itemM[1].trim()
          if (item) items.push(item)
        }
      }
    }
    phases.push({ title, items })
  }

  return { objective, phases }
}

const NOOP = () => {}
const NOOP_ASYNC = async () => {}
const NOOP_SAVE = async (_: unknown) => false as const

// ── Types ──────────────────────────────────────────────────────────────────

interface StoredExtraction {
  id: string          // g-{uuid} — unique per extraction, used as extraction_id for tasks
  result: ExtractResult
  shareCopied: boolean
  url: string
  mode: ExtractionMode
}

const MODE_PILL_LABELS: Record<string, { en: string; es: string }> = {
  action_plan:       { en: 'Plan',    es: 'Plan' },
  executive_summary: { en: 'Summary', es: 'Resumen' },
  business_ideas:    { en: 'Ideas',   es: 'Ideas' },
  key_quotes:        { en: 'Quotes',  es: 'Frases' },
}

// ── Component ──────────────────────────────────────────────────────────────

export function GuestExtractorSection({ lang }: { lang: Lang }) {
  const router = useRouter()

  // ── Form state ─────────────────────────────────────────────────────────
  const [url, setUrl] = useState('')
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>(DEFAULT_EXTRACTION_MODE)
  const [outputLanguage, setOutputLanguage] = useState<ExtractionOutputLanguage>(
    DEFAULT_EXTRACTION_OUTPUT_LANGUAGE
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<number | null>(null)
  const [uploadedFile, setUploadedFile] = useState<UploadedFileState | null>(null)
  const [isUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [streamPreview, setStreamPreview] = useState('')
  const [limitReached, setLimitReached] = useState(false)

  // ── Multi-result state ─────────────────────────────────────────────────
  const [extractions, setExtractions] = useState<StoredExtraction[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // Ref to capture the new index synchronously inside setExtractions updater
  const pendingIndexRef = useRef<number>(-1)

  // Keep track of the last active extraction so the fade-out animation
  // has content to show even after activeIndex becomes null
  const lastActiveRef = useRef<StoredExtraction | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────
  const activeExtraction = activeIndex !== null ? (extractions[activeIndex] ?? null) : null
  if (activeExtraction) lastActiveRef.current = activeExtraction
  const displayExtraction = activeExtraction ?? lastActiveRef.current

  // extractor (form) visible ↔ result visible are mutually exclusive
  const showExtractor = activeIndex === null

  // overflow-hidden is required for the grid-rows collapse animation, but it clips
  // dropdowns (mode, language, connections) when the extractor is fully open.
  // Switch to overflow-visible after the 700ms opening animation completes,
  // and immediately back to overflow-hidden when the extractor starts closing.
  const [extractorOverflow, setExtractorOverflow] = useState<'hidden' | 'visible'>('visible')
  useEffect(() => {
    if (showExtractor) {
      const timer = setTimeout(() => setExtractorOverflow('visible'), 720)
      return () => clearTimeout(timer)
    } else {
      setExtractorOverflow('hidden')
    }
  }, [showExtractor])

  // ── URL validation ─────────────────────────────────────────────────────
  const trimmedUrl = url.trim()
  const detectedSourceType: SourceType = uploadedFile
    ? uploadedFile.sourceType
    : detectSourceType(trimmedUrl)
  const urlError = (() => {
    if (uploadedFile) return null
    if (!trimmedUrl) return null
    if (/^https?:\/\//i.test(trimmedUrl) && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmedUrl)) {
      return lang === 'es'
        ? 'Ingresa una URL válida (ejemplo: https://youtube.com/watch?v=...).'
        : 'Enter a valid URL (example: https://youtube.com/watch?v=...).'
    }
    return null
  })()

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (_file: File) => {
      setUploadError(
        lang === 'es'
          ? 'Crea una cuenta gratis para subir archivos PDF o Word.'
          : 'Create a free account to upload PDF or Word files.'
      )
    },
    [lang]
  )

  const handleClearFile = useCallback(() => {
    setUploadedFile(null)
    setUploadError(null)
  }, [])

  const handleSwitchActive = useCallback((index: number | null) => {
    setActiveIndex(index)
    setActivePhase(null)
  }, [])

  // Save any completed guest extractions to localStorage so the app can
  // migrate them to the user's account right after registration/login.
  const handleGoRegister = useCallback(
    (currentExtractions: StoredExtraction[]) => {
      savePendingExtractions(currentExtractions)
      router.push('/app?mode=register')
    },
    [router]
  )

  const handleExtract = useCallback(
    async (options?: { url?: string; mode?: ExtractionMode }) => {
      const extractionModeToUse = normalizeExtractionMode(options?.mode ?? extractionMode)
      const extractionUrl = (options?.url ?? url).trim()
      if (!extractionUrl || isProcessing) return

      const srcType = detectSourceType(extractionUrl)
      let streamBody: Record<string, unknown>
      if (srcType === 'text') {
        streamBody = {
          text: extractionUrl,
          sourceType: 'text',
          sourceLabel: extractionUrl.slice(0, 60),
          mode: extractionModeToUse,
          outputLanguage,
        }
      } else {
        streamBody = {
          url: extractionUrl,
          sourceType: srcType,
          mode: extractionModeToUse,
          outputLanguage,
        }
      }

      if (extractionModeToUse !== extractionMode) setExtractionMode(extractionModeToUse)

      // Return to extractor view while processing
      setActiveIndex(null)
      setIsProcessing(true)
      setError(null)
      setStreamStatus(`Iniciando extracción (${getExtractionModeLabel(extractionModeToUse)})...`)
      setStreamPreview('')

      const guestId = getOrCreateGuestId()
      // Each extraction gets a unique UUID → isolated task space in DB
      const extractionUUID = crypto.randomUUID()
      const guestExtractionId = `g-${extractionUUID}`

      let streamHadResult = false
      let streamHadError = false

      const appendPreviewChunk = (chunk: string) => {
        if (!chunk) return
        setStreamPreview((prev) => {
          const next = prev + chunk
          return next.length > 6000 ? next.slice(next.length - 6000) : next
        })
      }

      const processSseFrame = (frame: string) => {
        const parsed = parseSseFrame(frame)
        if (!parsed) return

        let payload: unknown = null
        if (parsed.data) {
          try {
            payload = JSON.parse(parsed.data) as unknown
          } catch {
            payload = { message: parsed.data }
          }
        }

        if (parsed.event === 'status') {
          const message = (payload as { message?: unknown })?.message
          if (typeof message === 'string' && message.trim()) setStreamStatus(message)
          return
        }
        if (parsed.event === 'text') {
          const chunk = (payload as { chunk?: unknown })?.chunk
          if (typeof chunk === 'string') appendPreviewChunk(chunk)
          return
        }
        if (parsed.event === 'result') {
          if (payload && typeof payload === 'object') {
            const resolvedMode = normalizeExtractionMode((payload as { mode?: unknown }).mode)
            const fromCache = (payload as { cached?: unknown }).cached === true

            const newResult: ExtractResult = {
              ...(payload as ExtractResult),
              // Unique per-extraction ID so task API routes can isolate guest tasks
              id: guestExtractionId,
              mode: resolvedMode,
              shareVisibility: 'private',
            }
            const newExtraction: StoredExtraction = {
              id: guestExtractionId,
              result: newResult,
              shareCopied: false,
              url: extractionUrl,
              mode: resolvedMode,
            }

            // Capture the new index synchronously inside the updater, then open it
            setExtractions((prev) => {
              pendingIndexRef.current = prev.length
              return [...prev, newExtraction]
            })
            setActiveIndex(pendingIndexRef.current)
            setActivePhase(null)
            setError(null)
            setStreamStatus(fromCache ? 'Resultado recuperado desde caché.' : 'Extracción completada.')
            streamHadResult = true
          }
          return
        }
        if (parsed.event === 'error') {
          const message = (payload as { message?: unknown })?.message
          setError(
            typeof message === 'string' && message.trim()
              ? message
              : 'Error al procesar el contenido.'
          )
          streamHadError = true
        }
      }

      try {
        const res = await fetch('/api/extract/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'X-Guest-Mode': '1',
            'X-Guest-ID': guestId,
          },
          body: JSON.stringify(streamBody),
        })

        if (res.status === 429) {
          setLimitReached(true)
          return
        }

        if (!res.ok) {
          let apiError = 'Error al procesar el contenido.'
          try {
            const data = (await res.json()) as { error?: unknown }
            if (typeof data.error === 'string' && data.error.trim()) apiError = data.error
          } catch { /* noop */ }
          setError(apiError)
          return
        }

        if (!res.body) {
          setError('No se pudo iniciar el stream de extracción.')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          while (true) {
            const eventEnd = buffer.indexOf('\n\n')
            if (eventEnd === -1) break
            const rawFrame = buffer.slice(0, eventEnd)
            buffer = buffer.slice(eventEnd + 2)
            processSseFrame(rawFrame)
          }
        }

        const remaining = buffer.trim()
        if (remaining) processSseFrame(remaining)

        if (!streamHadResult && !streamHadError) {
          setError('La extracción finalizó sin resultado. Intenta de nuevo.')
        }
      } catch {
        setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
      } finally {
        setIsProcessing(false)
        setStreamStatus(null)
        setStreamPreview('')
      }
    },
    [extractionMode, outputLanguage, url, isProcessing]
  )

  const handleCopyMarkdown = useCallback(async () => {
    if (!activeExtraction) return
    const { result, url: exUrl } = activeExtraction
    const markdown = buildExtractionMarkdown({
      extractionMode: result.mode ?? extractionMode,
      objective: result.objective,
      phases: result.phases,
      proTip: result.proTip,
      metadata: result.metadata,
      videoTitle: result.videoTitle ?? null,
      videoUrl: (result.url ?? exUrl).trim(),
    })
    try {
      await navigator.clipboard.writeText(markdown)
      if (activeIndex !== null) {
        const idx = activeIndex
        setExtractions((prev) =>
          prev.map((ex, i) => (i === idx ? { ...ex, shareCopied: true } : ex))
        )
        setTimeout(() => {
          setExtractions((prev) =>
            prev.map((ex, i) => (i === idx ? { ...ex, shareCopied: false } : ex))
          )
        }, 2000)
      }
    } catch { /* noop */ }
  }, [activeExtraction, activeIndex, extractionMode])

  // ── Pill label ─────────────────────────────────────────────────────────
  const getPillLabel = (ex: StoredExtraction, index: number) => {
    const modeLabel = MODE_PILL_LABELS[ex.mode]?.[lang] ?? ex.mode
    return `#${index + 1} · ${modeLabel}`
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto w-full max-w-4xl">

      {/* ── Navigation pills — visible when there are past extractions ── */}
      {extractions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {/* "New extraction" pill — hidden when limit reached */}
          {!limitReached && (
            <button
              onClick={() => handleSwitchActive(null)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
                activeIndex === null
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'border border-zinc-200 bg-white text-zinc-600 hover:border-violet-300 hover:text-violet-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-500/50 dark:hover:text-violet-400'
              }`}
            >
              + {t(lang, 'guest.newExtraction')}
            </button>
          )}

          {/* Past extractions pills */}
          {extractions.map((ex, i) => (
            <button
              key={ex.id}
              onClick={() => handleSwitchActive(i)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300 ${
                activeIndex === i
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'border border-zinc-200 bg-white text-zinc-600 hover:border-violet-300 hover:text-violet-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-violet-500/50 dark:hover:text-violet-400'
              }`}
            >
              {getPillLabel(ex, i)}
            </button>
          ))}
        </div>
      )}

      {/* ── Extractor section — animated with grid-rows trick ── */}
      <div
        className={`grid transition-all duration-700 ease-in-out ${
          showExtractor ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          className={`transition-opacity duration-500 ease-in-out ${
            extractorOverflow === 'visible' ? 'overflow-visible' : 'overflow-hidden'
          } ${showExtractor ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="pb-2">
            {/* State C: limit reached, no results at all */}
            {limitReached && extractions.length === 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t(lang, 'guest.limitReached')}
                </p>
                <button
                  onClick={() => handleGoRegister(extractions)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  <UserPlus size={15} />
                  {t(lang, 'guest.limitCta')}
                  <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* Compact limit banner when results exist */}
            {limitReached && extractions.length > 0 && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  {t(lang, 'guest.limitReached')}
                </p>
                <button
                  onClick={() => handleGoRegister(extractions)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  {t(lang, 'guest.limitCta')} <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* Extraction form — only when limit not reached */}
            {!limitReached && (
              <>
                <ExtractionForm
                  url={url}
                  isProcessing={isProcessing}
                  urlError={urlError}
                  onUrlChange={(value) => {
                    setUrl(value)
                    if (uploadedFile) setUploadedFile(null)
                  }}
                  onExtract={handleExtract}
                  onScrollToHistory={NOOP}
                  hasHistory={false}
                  uploadedFile={uploadedFile}
                  isUploading={isUploading}
                  uploadError={uploadError}
                  onFileSelect={handleFileSelect}
                  onClearFile={handleClearFile}
                  onManualResult={NOOP}
                  onManualToggle={NOOP}
                />

                <WorkspaceControlsDock
                  extractionMode={extractionMode}
                  outputLanguage={outputLanguage}
                  isProcessing={isProcessing}
                  onExtractionModeChange={setExtractionMode}
                  onOutputLanguageChange={setOutputLanguage}
                  notionConfigured={false}
                  notionConnected={false}
                  notionWorkspaceName={null}
                  notionLoading={false}
                  notionDisconnectLoading={false}
                  onConnectNotion={NOOP}
                  onDisconnectNotion={NOOP}
                  trelloConfigured={false}
                  trelloConnected={false}
                  trelloUsername={null}
                  trelloLoading={false}
                  trelloDisconnectLoading={false}
                  onConnectTrello={NOOP}
                  onDisconnectTrello={NOOP}
                  todoistConfigured={false}
                  todoistConnected={false}
                  todoistUserLabel={null}
                  todoistLoading={false}
                  todoistDisconnectLoading={false}
                  onConnectTodoist={NOOP}
                  onDisconnectTodoist={NOOP}
                  googleDocsConfigured={false}
                  googleDocsConnected={false}
                  googleDocsUserEmail={null}
                  googleDocsLoading={false}
                  googleDocsDisconnectLoading={false}
                  onConnectGoogleDocs={NOOP}
                  onDisconnectGoogleDocs={NOOP}
                />
              </>
            )}

            {/* Error message */}
            {error && (
              <div className="mx-auto mt-1 mb-8 w-full max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 dark:border-red-800 dark:bg-red-900/20">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5 dark:text-red-400" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Streaming skeleton — identical to the main app */}
            {isProcessing && (() => {
              const parsed = parseStreamPreview(streamPreview)
              const PHASES = 3
              const skeletonTitleWidths = [42, 58, 36]
              return (
                <div className="mx-auto mt-1 mb-8 w-full max-w-3xl space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/20">
                    <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-700 dark:border-t-indigo-300" />
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                      {streamStatus ?? 'Procesando con IA...'}
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      {parsed.objective ? (
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {parsed.objective}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                          <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" style={{ animationDelay: '120ms' }} />
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                      {Array.from({ length: PHASES }, (_, i) => {
                        const phase = parsed.phases[i]
                        return (
                          <div key={i} className="px-4 py-3">
                            {phase?.title ? (
                              <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {phase.title}
                              </p>
                            ) : (
                              <div
                                className="mb-2.5 h-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"
                                style={{ width: `${skeletonTitleWidths[i]}%`, animationDelay: `${i * 130}ms` }}
                              />
                            )}
                            {phase?.items.length ? (
                              <ul className="space-y-1">
                                {phase.items.map((item, j) => (
                                  <li key={j} className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    <span className="mt-0.5 shrink-0 text-indigo-400">•</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="space-y-1.5">
                                {[100, 85, 70].map((w, j) => (
                                  <div
                                    key={j}
                                    className="h-2 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800"
                                    style={{ width: `${w}%`, animationDelay: `${(i * 3 + j) * 75}ms` }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Result section — animated with grid-rows trick ── */}
      <div
        className={`grid transition-all duration-700 ease-in-out ${
          !showExtractor ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          className={`overflow-hidden transition-opacity duration-500 ease-in-out ${
            !showExtractor ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* displayExtraction keeps content during fade-out so animation looks smooth */}
          {displayExtraction && (
            <>
              <div className="scroll-mt-24">
                <ResultPanel
                  result={displayExtraction.result}
                  url={displayExtraction.url}
                  extractionMode={displayExtraction.mode}
                  isProcessing={isProcessing}
                  activePhase={activePhase}
                  onTogglePhase={(id) => setActivePhase(activePhase === id ? null : id)}
                  isExportingPdf={false}
                  shareLoading={false}
                  shareCopied={displayExtraction.shareCopied}
                  shareVisibility="private"
                  shareVisibilityLoading={false}
                  notionConfigured={false}
                  notionConnected={false}
                  notionWorkspaceName={null}
                  notionLoading={false}
                  notionExportLoading={false}
                  trelloConfigured={false}
                  trelloConnected={false}
                  trelloUsername={null}
                  trelloLoading={false}
                  trelloExportLoading={false}
                  todoistConfigured={false}
                  todoistConnected={false}
                  todoistUserLabel={null}
                  todoistLoading={false}
                  todoistExportLoading={false}
                  googleDocsConfigured={false}
                  googleDocsConnected={false}
                  googleDocsUserEmail={null}
                  googleDocsLoading={false}
                  googleDocsExportLoading={false}
                  onDownloadPdf={NOOP_ASYNC}
                  onCopyShareLink={NOOP_ASYNC}
                  onCopyMarkdown={handleCopyMarkdown}
                  onShareVisibilityChange={NOOP}
                  onSavePhases={NOOP_SAVE as (phases: Phase[]) => Promise<boolean>}
                  onSaveMeta={NOOP_SAVE as (meta: { title: string; thumbnailUrl: string | null; objective: string }) => Promise<boolean>}
                  onClose={() => handleSwitchActive(null)}
                  onExportToNotion={NOOP_ASYNC}
                  onConnectNotion={NOOP}
                  onExportToTrello={NOOP_ASYNC}
                  onConnectTrello={NOOP}
                  onExportToTodoist={NOOP_ASYNC}
                  onConnectTodoist={NOOP}
                  onExportToGoogleDocs={NOOP_ASYNC}
                  onConnectGoogleDocs={NOOP}
                  onReExtractMode={(mode) => {
                    void handleExtract({
                      url: (displayExtraction.result.url ?? displayExtraction.url).trim(),
                      mode,
                    })
                  }}
                />
              </div>

              {/* CTA / limit banner below result */}
              <div
                className={`mt-6 rounded-2xl border p-6 text-center ${
                  limitReached
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                    : 'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10'
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    limitReached
                      ? 'text-amber-900 dark:text-amber-200'
                      : 'text-violet-900 dark:text-violet-200'
                  }`}
                >
                  {limitReached ? t(lang, 'guest.limitReached') : t(lang, 'guest.afterResult')}
                </p>
                <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => handleGoRegister(extractions)}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                  >
                    <UserPlus size={15} />
                    {t(lang, 'guest.createAccount')}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
