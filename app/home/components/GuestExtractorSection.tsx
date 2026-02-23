'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
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

function getOrCreateGuestId(): string {
  try {
    const stored = localStorage.getItem(GUEST_ID_KEY)
    if (stored) return stored
    const newId = crypto.randomUUID()
    localStorage.setItem(GUEST_ID_KEY, newId)
    return newId
  } catch {
    return 'unknown'
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

export function GuestExtractorSection({ lang }: { lang: Lang }) {
  const [url, setUrl] = useState('')
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>(DEFAULT_EXTRACTION_MODE)
  const [outputLanguage, setOutputLanguage] = useState<ExtractionOutputLanguage>(
    DEFAULT_EXTRACTION_OUTPUT_LANGUAGE
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<number | null>(null)
  const [uploadedFile, setUploadedFile] = useState<UploadedFileState | null>(null)
  const [isUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [streamPreview, setStreamPreview] = useState('')
  const [limitReached, setLimitReached] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const trimmedUrl = url.trim()
  const detectedSourceType: SourceType = uploadedFile
    ? uploadedFile.sourceType
    : detectSourceType(trimmedUrl)

  const urlError = (() => {
    if (uploadedFile) return null
    if (!trimmedUrl) return null
    if (/^https?:\/\//i.test(trimmedUrl) && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmedUrl)) {
      return 'Ingresa una URL válida (ejemplo: https://youtube.com/watch?v=... o https://ejemplo.com).'
    }
    return null
  })()

  // File upload requires auth — show a friendly message instead
  const handleFileSelect = useCallback((_file: File) => {
    setUploadError(
      lang === 'es'
        ? 'Crea una cuenta gratis para subir archivos PDF o Word.'
        : 'Create a free account to upload PDF or Word files.'
    )
  }, [lang])

  const handleClearFile = useCallback(() => {
    setUploadedFile(null)
    setUploadError(null)
  }, [])

  const handleExtract = useCallback(async (options?: { url?: string; mode?: ExtractionMode }) => {
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

    if (extractionModeToUse !== extractionMode) {
      setExtractionMode(extractionModeToUse)
    }

    // Save current result — restored if the request returns 429
    const previousResult = result

    setIsProcessing(true)
    setError(null)
    setResult(null)
    setShareCopied(false)
    setStreamStatus(`Iniciando extracción (${getExtractionModeLabel(extractionModeToUse)})...`)
    setStreamPreview('')

    const guestId = getOrCreateGuestId()
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
          // Inject the guest extraction ID so ResultPanel can make task API calls
          setResult({ ...(payload as ExtractResult), id: `g-${guestId}`, mode: resolvedMode, shareVisibility: 'private' })
          setExtractionMode(resolvedMode)
          setShareCopied(false)
          setActivePhase(null)
          setError(null)
          setStreamStatus(fromCache ? 'Resultado recuperado desde caché.' : 'Extracción completada.')
          streamHadResult = true
        }
        return
      }
      if (parsed.event === 'error') {
        const message = (payload as { message?: unknown })?.message
        setError(typeof message === 'string' && message.trim() ? message : 'Error al procesar el contenido.')
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
        setResult(previousResult)   // restore the result the user already had
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
  }, [extractionMode, outputLanguage, url, isProcessing])

  const handleCopyMarkdown = useCallback(async () => {
    if (!result) return
    const markdown = buildExtractionMarkdown({
      extractionMode: result.mode ?? extractionMode,
      objective: result.objective,
      phases: result.phases,
      proTip: result.proTip,
      metadata: result.metadata,
      videoTitle: result.videoTitle ?? null,
      videoUrl: (result.url ?? url).trim(),
    })
    try {
      await navigator.clipboard.writeText(markdown)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch { /* noop */ }
  }, [result, extractionMode, url])

  // ── State C: limit reached, no result → show only the CTA
  if (limitReached && !result) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {t(lang, 'guest.limitReached')}
          </p>
          <Link
            href="/app?mode=register"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            <UserPlus size={15} />
            {t(lang, 'guest.limitCta')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl">

      {/* ── States A / B: show form when limit not yet reached ── */}
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

      {result && (
        <>
          <div className="scroll-mt-24">
            <ResultPanel
              result={result}
              url={url}
              extractionMode={extractionMode}
              isProcessing={isProcessing}
              activePhase={activePhase}
              onTogglePhase={(id) => setActivePhase(activePhase === id ? null : id)}
              isExportingPdf={false}
              shareLoading={false}
              shareCopied={shareCopied}
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
              onClose={() => { setResult(null); setError(null) }}
              onExportToNotion={NOOP_ASYNC}
              onConnectNotion={NOOP}
              onExportToTrello={NOOP_ASYNC}
              onConnectTrello={NOOP}
              onExportToTodoist={NOOP_ASYNC}
              onConnectTodoist={NOOP}
              onExportToGoogleDocs={NOOP_ASYNC}
              onConnectGoogleDocs={NOOP}
              onReExtractMode={(mode) => {
                void handleExtract({ url: (result.url ?? url).trim(), mode })
              }}
            />
          </div>

          {/* ── State D: limit reached + result visible → show limit banner ── */}
          {/* ── State B: not limit reached → show "create account" CTA ── */}
          <div className={`mt-6 rounded-2xl border p-6 text-center ${
            limitReached
              ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
              : 'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10'
          }`}>
            <p className={`text-sm font-semibold ${
              limitReached
                ? 'text-amber-900 dark:text-amber-200'
                : 'text-violet-900 dark:text-violet-200'
            }`}>
              {limitReached ? t(lang, 'guest.limitReached') : t(lang, 'guest.afterResult')}
            </p>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/app?mode=register"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
              >
                <UserPlus size={15} />
                {t(lang, 'guest.createAccount')}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
