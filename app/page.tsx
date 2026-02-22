'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowUp,
  Brain,
  CheckSquare,
  Clock,
  Copy,
  History,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import {
  DEFAULT_EXTRACTION_MODE,
  type ExtractionMode,
  getExtractionModeLabel,
  normalizeExtractionMode,
} from '@/lib/extraction-modes'
import { buildExtractionMarkdown } from '@/lib/export-content'
import {
  DEFAULT_EXTRACTION_OUTPUT_LANGUAGE,
  type ExtractionOutputLanguage,
} from '@/lib/output-language'
import { ExtractionForm } from '@/app/home/components/ExtractionForm'
import { AuthAccessPanel } from '@/app/home/components/AuthAccessPanel'
import { GoogleIcon } from '@/app/home/components/GoogleIcon'
import { HistoryPanel } from '@/app/home/components/HistoryPanel'
import { PublicHeroSection } from '@/app/home/components/PublicHeroSection'
import { ResultPanel } from '@/app/home/components/ResultPanel'
import { WorkspaceControlsDock } from '@/app/home/components/WorkspaceControlsDock'
import { useAuth } from '@/app/home/hooks/useAuth'
import { useHistory } from '@/app/home/hooks/useHistory'
import { useIntegrations } from '@/app/home/hooks/useIntegrations'
import {
  applyTheme,
  getThemeStorageKey,
  isYoutubeUrlValid,
  parseSseFrame,
  resolveInitialTheme,
} from '@/app/home/lib/utils'
import type { ExtractResult, HistoryItem, Theme } from '@/app/home/lib/types'

function slowScrollToElement(element: HTMLElement, durationMs = 1400) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const startY = window.scrollY || window.pageYOffset
  const targetY = Math.max(0, element.getBoundingClientRect().top + startY - 92)
  const distance = targetY - startY

  if (Math.abs(distance) < 4) return

  if (prefersReducedMotion) {
    window.scrollTo({ top: targetY, left: 0, behavior: 'auto' })
    return
  }

  const startedAt = performance.now()
  const easeInOutCubic = (progress: number) =>
    progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

  const animate = (now: number) => {
    const elapsed = now - startedAt
    const progress = Math.min(elapsed / durationMs, 1)
    const eased = easeInOutCubic(progress)

    window.scrollTo({
      top: startY + distance * eased,
      left: 0,
      behavior: 'auto',
    })

    if (progress < 1) {
      window.requestAnimationFrame(animate)
    }
  }

  window.requestAnimationFrame(animate)
}

function ValueHighlights() {
  return (
    <div className="grid gap-4 text-center md:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          <Clock size={24} />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Ahorra Horas</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          De 2 horas de video a 3 minutos de lectura.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
          <CheckSquare size={24} />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Acción Pura</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sin relleno. Solo los pasos que generan ROI.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
          <Copy size={24} />
        </div>
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Exporta Fácil</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Exporta en un click a Notion, Trello, Todoist o Google Doc.
        </p>
      </div>
    </div>
  )
}

function ActionExtractor() {
  const searchParams = useSearchParams()
  const resetTokenFromUrl = searchParams.get('token')

  const [url, setUrl] = useState('')
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>(DEFAULT_EXTRACTION_MODE)
  const [outputLanguage, setOutputLanguage] = useState<ExtractionOutputLanguage>(
    DEFAULT_EXTRACTION_OUTPUT_LANGUAGE
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<number | null>(null)

  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [streamPreview, setStreamPreview] = useState('')
  const [shouldScrollToResult, setShouldScrollToResult] = useState(false)
  const [showBackToExtractorButton, setShowBackToExtractorButton] = useState(false)
  const [showGoToHistoryButton, setShowGoToHistoryButton] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const [reauthRequired, setReauthRequired] = useState(false)
  const extractorSectionRef = useRef<HTMLElement | null>(null)
  const resultAnchorRef = useRef<HTMLDivElement | null>(null)
  const historyAnchorRef = useRef<HTMLDivElement | null>(null)
  const themeStorageKey = getThemeStorageKey()
  const trimmedUrl = url.trim()
  const urlError =
    trimmedUrl && !isYoutubeUrlValid(trimmedUrl)
      ? 'Ingresa una URL válida de YouTube (ejemplo: https://youtube.com/watch?v=...).'
      : null

  const {
    history,
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
  } = useHistory()

  const resetExtractionUiState = useCallback(() => {
    setResult(null)
    setError(null)
    setNotice(null)
    setActivePhase(null)
    setShareCopied(false)
    setStreamStatus(null)
    setStreamPreview('')
    setShouldScrollToResult(false)
  }, [])

  const handleSessionMissing = useCallback(() => {
    setReauthRequired(false)
    resetHistory()
    resetExtractionUiState()
  }, [resetExtractionUiState, resetHistory])

  const {
    sessionLoading,
    user,
    setUser,
    authMode,
    setAuthMode,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    authLoading,
    googleAuthLoading,
    authError,
    setAuthError,
    authNotice,
    setAuthNotice,
    forgotEmail,
    setForgotEmail,
    forgotLoading,
    forgotError,
    setForgotError,
    forgotSuccess,
    setForgotSuccess,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    resetLoading,
    resetError,
    resetSuccess,
    handleGoogleAuthStart,
    handleAuthSubmit,
    handleForgotPassword,
    handleResetPassword,
    handleLogout: handleAuthLogout,
  } = useAuth({
    searchParams,
    resetTokenFromUrl,
    onAuthenticated: loadHistory,
    onSessionMissing: handleSessionMissing,
    onLogout: handleSessionMissing,
    setGlobalNotice: setNotice,
    setGlobalError: setError,
  })

  const handleUnauthorized = useCallback(() => {
    setAuthMode('login')
    setAuthNotice(null)
    setAuthError(null)
    if (user?.email) {
      setEmail(user.email)
    }
    setReauthRequired(true)
    setUser(null)
    resetHistory()
    setNotice(null)
    setStreamStatus(null)
    setStreamPreview('')
  }, [resetHistory, setAuthError, setAuthMode, setAuthNotice, setEmail, setUser, user])

  useEffect(() => {
    if (!user) return
    setReauthRequired(false)
  }, [user])

  useEffect(() => {
    if (!shouldScrollToResult || isProcessing || !result) return

    const anchor = resultAnchorRef.current
    if (!anchor) return

    window.requestAnimationFrame(() => {
      slowScrollToElement(anchor)
      setShouldScrollToResult(false)
    })
  }, [isProcessing, result, shouldScrollToResult])

  const handleScrollToHistory = useCallback(() => {
    const anchor = historyAnchorRef.current
    if (!anchor) return
    window.requestAnimationFrame(() => {
      slowScrollToElement(anchor, 1500)
    })
  }, [])

  const handleScrollToExtractor = useCallback(() => {
    const anchor = extractorSectionRef.current
    window.requestAnimationFrame(() => {
      if (anchor) {
        slowScrollToElement(anchor, 1600)
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      }
    })
  }, [])

  useEffect(() => {
    if (!user) {
      setShowBackToExtractorButton(false)
      setShowGoToHistoryButton(false)
      return
    }

    const updateBackToExtractorVisibility = () => {
      const section = extractorSectionRef.current
      if (!section) {
        setShowBackToExtractorButton(window.scrollY > 280)
      } else {
        const rect = section.getBoundingClientRect()
        setShowBackToExtractorButton(rect.bottom < 140)
      }

      const resultSection = resultAnchorRef.current
      const historySection = historyAnchorRef.current
      if (!resultSection || !historySection) {
        setShowGoToHistoryButton(false)
        return
      }

      const viewportHeight = window.innerHeight
      const resultRect = resultSection.getBoundingClientRect()
      const historyRect = historySection.getBoundingClientRect()

      const isInsideResultContentZone =
        resultRect.top < viewportHeight * 0.82 && resultRect.bottom > 140
      const isHistoryAlreadyReached = historyRect.top <= 140
      setShowGoToHistoryButton(isInsideResultContentZone && !isHistoryAlreadyReached)
    }

    updateBackToExtractorVisibility()
    window.addEventListener('scroll', updateBackToExtractorVisibility, { passive: true })
    window.addEventListener('resize', updateBackToExtractorVisibility)

    return () => {
      window.removeEventListener('scroll', updateBackToExtractorVisibility)
      window.removeEventListener('resize', updateBackToExtractorVisibility)
    }
  }, [result, user])

  const {
    notionConfigured,
    notionConnected,
    notionWorkspaceName,
    notionLoading,
    notionExportLoading,
    notionDisconnectLoading,
    trelloConfigured,
    trelloConnected,
    trelloUsername,
    trelloLoading,
    trelloExportLoading,
    trelloDisconnectLoading,
    setTrelloLoading,
    todoistConfigured,
    todoistConnected,
    todoistUserLabel,
    todoistLoading,
    todoistExportLoading,
    todoistDisconnectLoading,
    googleDocsConfigured,
    googleDocsConnected,
    googleDocsUserEmail,
    googleDocsLoading,
    googleDocsExportLoading,
    googleDocsDisconnectLoading,
    loadNotionStatus,
    loadTrelloStatus,
    loadTodoistStatus,
    loadGoogleDocsStatus,
    resetIntegrations,
    handleConnectNotion,
    handleDisconnectNotion,
    handleExportToNotion,
    handleConnectTrello,
    handleDisconnectTrello,
    handleExportToTrello,
    handleConnectTodoist,
    handleDisconnectTodoist,
    handleExportToTodoist,
    handleConnectGoogleDocs,
    handleDisconnectGoogleDocs,
    handleExportToGoogleDocs,
  } = useIntegrations({
    user,
    onUnauthorized: handleUnauthorized,
    setError,
    setNotice,
  })

  useEffect(() => {
    const initialTheme = resolveInitialTheme()
    setTheme(initialTheme)
    applyTheme(initialTheme)
  }, [])

  useEffect(() => {
    if (!user) return

    const notionStatus = searchParams.get('notion')
    if (notionStatus === 'connected') {
      setNotice('Notion conectado correctamente.')
      void loadNotionStatus()
    } else if (notionStatus === 'auth_required') {
      setError('Tu sesión expiró. Vuelve a iniciar sesión.')
    } else if (notionStatus === 'connect_denied') {
      setError('Conexión con Notion cancelada por el usuario.')
    } else if (notionStatus === 'invalid_state') {
      setError('No se pudo validar la sesión de conexión con Notion. Intenta nuevamente.')
    } else if (notionStatus === 'not_configured') {
      setError('La integración con Notion no está configurada en el servidor.')
    } else if (notionStatus === 'error') {
      setError('No se pudo completar la conexión con Notion.')
    }

    const todoistStatus = searchParams.get('todoist')
    if (todoistStatus === 'connected') {
      setNotice('Todoist conectado correctamente.')
      void loadTodoistStatus()
    } else if (todoistStatus === 'auth_required') {
      setError('Tu sesión expiró. Vuelve a iniciar sesión.')
    } else if (todoistStatus === 'connect_denied') {
      setError('Conexión con Todoist cancelada por el usuario.')
    } else if (todoistStatus === 'invalid_state') {
      setError('No se pudo validar la sesión de conexión con Todoist.')
    } else if (todoistStatus === 'not_configured') {
      setError('La integración con Todoist no está configurada en el servidor.')
    } else if (todoistStatus === 'error') {
      setError('No se pudo completar la conexión con Todoist.')
    }

    const googleStatus = searchParams.get('gdocs')
    if (googleStatus === 'connected') {
      setNotice('Google Docs conectado correctamente.')
      void loadGoogleDocsStatus()
    } else if (googleStatus === 'auth_required') {
      setError('Tu sesión expiró. Vuelve a iniciar sesión.')
    } else if (googleStatus === 'connect_denied') {
      setError('Conexión con Google Docs cancelada por el usuario.')
    } else if (googleStatus === 'invalid_state') {
      setError('No se pudo validar la sesión de conexión con Google Docs.')
    } else if (googleStatus === 'not_configured') {
      setError('La integración con Google Docs no está configurada en el servidor.')
    } else if (googleStatus === 'error') {
      setError('No se pudo completar la conexión con Google Docs.')
    }

    const trelloStatus = searchParams.get('trello')
    if (trelloStatus === 'auth_required') {
      setError('Tu sesión expiró. Vuelve a iniciar sesión.')
      return
    }
    if (trelloStatus === 'not_configured') {
      setError('La integración con Trello no está configurada en el servidor.')
      return
    }
    if (trelloStatus === 'error') {
      setError('No se pudo completar la conexión con Trello.')
      return
    }
    if (trelloStatus !== 'token') return
    if (trelloLoading) return

    const trelloState = searchParams.get('trello_state') ?? ''
    const rawHash = typeof window !== 'undefined' ? window.location.hash : ''
    const hashParams = new URLSearchParams(rawHash.startsWith('#') ? rawHash.slice(1) : rawHash)
    const trelloToken = hashParams.get('token')?.trim() ?? ''

    if (!trelloState || !trelloToken) {
      setError('No se pudo leer el token de Trello devuelto por OAuth.')
      return
    }

    setTrelloLoading(true)
    setError(null)
    setNotice(null)

    void (async () => {
      try {
        const res = await fetch('/api/trello/connect/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: trelloToken,
            state: trelloState,
          }),
        })

        if (res.status === 401) {
          handleUnauthorized()
          setError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return
        }

        const data = (await res.json().catch(() => null)) as
          | { error?: unknown }
          | null
        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo completar la conexión con Trello.'
          setError(message)
          return
        }

        setNotice('Trello conectado correctamente.')
        void loadTrelloStatus()
      } catch {
        setError('Error de conexión al completar OAuth con Trello.')
      } finally {
        setTrelloLoading(false)
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/')
        }
      }
    })()
  }, [
    handleUnauthorized,
    loadGoogleDocsStatus,
    loadNotionStatus,
    loadTodoistStatus,
    loadTrelloStatus,
    searchParams,
    trelloLoading,
    user,
  ])

  const handleLogout = async () => {
    setReauthRequired(false)
    await handleAuthLogout()
    resetIntegrations()
  }

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    applyTheme(nextTheme)
    try {
      localStorage.setItem(themeStorageKey, nextTheme)
    } catch {
      // noop
    }
  }

  const handleExtract = async (options?: { url?: string; mode?: ExtractionMode }) => {
    if (!user) {
      setError('Debes iniciar sesión para extraer contenido.')
      return
    }

    const extractionUrl = (options?.url ?? url).trim()
    const extractionModeToUse = normalizeExtractionMode(options?.mode ?? extractionMode)

    if (!extractionUrl || isProcessing) return
    if (!isYoutubeUrlValid(extractionUrl)) {
      setError('URL de YouTube inválida. Usa el formato https://youtube.com/watch?v=...')
      return
    }

    if (extractionUrl !== url) {
      setUrl(extractionUrl)
    }
    if (extractionModeToUse !== extractionMode) {
      setExtractionMode(extractionModeToUse)
    }

    const previousResult = result
    setIsProcessing(true)
    setShouldScrollToResult(true)
    setError(null)
    setNotice(null)
    setResult(null)
    setShareCopied(false)
    setStreamStatus(`Iniciando extracción (${getExtractionModeLabel(extractionModeToUse)})...`)
    setStreamPreview('')

    let streamHadResult = false
    let streamHadError = false
    const appendPreviewChunk = (chunk: string) => {
      if (!chunk) return

      setStreamPreview((previous) => {
        const next = previous + chunk
        const maxChars = 6000
        return next.length > maxChars ? next.slice(next.length - maxChars) : next
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
        if (payload && typeof payload === 'object') {
          const message = (payload as { message?: unknown }).message
          if (typeof message === 'string' && message.trim()) {
            setStreamStatus(message)
          }
        }
        return
      }

      if (parsed.event === 'text') {
        if (payload && typeof payload === 'object') {
          const chunk = (payload as { chunk?: unknown }).chunk
          if (typeof chunk === 'string') {
            appendPreviewChunk(chunk)
          }
        }
        return
      }

      if (parsed.event === 'result') {
        if (payload && typeof payload === 'object') {
          const resolvedMode = normalizeExtractionMode((payload as { mode?: unknown }).mode)
          const fromCache = (payload as { cached?: unknown }).cached === true
          setResult({
            ...(payload as ExtractResult),
            mode: resolvedMode,
          })
          setExtractionMode(resolvedMode)
          setShareCopied(false)
          setActivePhase(null)
          setError(null)
          setStreamStatus(fromCache ? 'Resultado recuperado desde caché.' : 'Extracción completada.')
          setNotice(
            fromCache
              ? 'Resultado desde caché: esta extracción no consume límite por hora.'
              : 'Extracción nueva: consumió 1 cupo del límite por hora.'
          )
          streamHadResult = true
          void loadHistory()
        }
        return
      }

      if (parsed.event === 'error') {
        if (payload && typeof payload === 'object') {
          const message = (payload as { message?: unknown }).message
          if (typeof message === 'string' && message.trim()) {
            setError(message)
          } else {
            setError('Error al procesar el contenido.')
          }
        } else {
          setError('Error al procesar el contenido.')
        }
        streamHadError = true
      }
    }

    try {
      const res = await fetch('/api/extract/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ url: extractionUrl, mode: extractionModeToUse, outputLanguage }),
      })

      if (res.status === 401) {
        setResult(previousResult)
        handleUnauthorized()
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }

      if (!res.ok) {
        let apiError = 'Error al procesar el contenido.'
        try {
          const data = (await res.json()) as { error?: unknown }
          if (typeof data.error === 'string' && data.error.trim()) {
            apiError = data.error
          }
        } catch {
          // noop
        }
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
      if (remaining) {
        processSseFrame(remaining)
      }

      if (!streamHadResult && !streamHadError) {
        setError('La extracción finalizó sin resultado. Intenta de nuevo.')
      }
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setIsProcessing(false)
      setStreamStatus(null)
      setStreamPreview('')
      if (!streamHadResult) {
        setShouldScrollToResult(false)
      }
    }
  }

  const togglePhase = (id: number) => {
    setActivePhase(activePhase === id ? null : id)
  }

  const handleCopyNotion = async () => {
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

    await navigator.clipboard.writeText(markdown)
    setNotice('Contenido copiado como Markdown.')
  }

  const handleCopyShareLink = async () => {
    if (!result?.id || shareLoading) return

    setShareLoading(true)
    setShareCopied(false)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId: result.id }),
      })

      if (res.status === 401) {
        handleUnauthorized()
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }

      const data = (await res.json().catch(() => null)) as
        | { token?: unknown; error?: unknown }
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo generar el enlace compartible.'
        setError(message)
        return
      }

      const token = typeof data?.token === 'string' ? data.token : ''
      if (!token) {
        setError('No se pudo generar el enlace compartible.')
        return
      }

      const shareUrl = `${window.location.origin}/share/${token}`
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2500)
    } catch {
      setError('No se pudo copiar el enlace compartible. Intenta de nuevo.')
    } finally {
      setShareLoading(false)
    }
  }

  const handleDownloadPdf = async (source?: ExtractResult | HistoryItem) => {
    const exportSource = source ?? result
    if (!exportSource || isExportingPdf) return

    setIsExportingPdf(true)
    try {
      const exportMode = normalizeExtractionMode(exportSource.mode ?? extractionMode)
      const exportModeLabel = getExtractionModeLabel(exportMode)
      const modeFilenamePartByMode: Record<ExtractionMode, string> = {
        action_plan: 'plan-de-accion',
        executive_summary: 'resumen-ejecutivo',
        business_ideas: 'ideas-de-negocio',
        key_quotes: 'frases-clave',
      }

      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const marginX = 14
      const marginTop = 16
      const marginBottom = 14
      const maxWidth = pageWidth - marginX * 2
      let y = marginTop

      const ensureSpace = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - marginBottom) {
          pdf.addPage()
          y = marginTop
        }
      }

      const addWrappedText = (
        text: string,
        options: {
          fontSize?: number
          fontStyle?: 'normal' | 'bold'
          lineHeight?: number
          spacingAfter?: number
          x?: number
          width?: number
        } = {}
      ) => {
        const {
          fontSize = 11,
          fontStyle = 'normal',
          lineHeight = 5.4,
          spacingAfter = 2,
          x = marginX,
          width = maxWidth,
        } = options

        pdf.setFont('helvetica', fontStyle)
        pdf.setFontSize(fontSize)

        const content = text.trim() ? text : '-'
        const lines = pdf.splitTextToSize(content, width) as string[]
        ensureSpace(lines.length * lineHeight + spacingAfter)
        pdf.text(lines, x, y)
        y += lines.length * lineHeight + spacingAfter
      }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text(`ActionExtractor - ${exportModeLabel}`, marginX, y)
      y += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const generatedAt = new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())
      pdf.text(`Generado: ${generatedAt}`, marginX, y)
      y += 6
      const sourceUrl = (exportSource.url ?? url).trim()
      if (sourceUrl) {
        addWrappedText(`Video: ${sourceUrl}`, { fontSize: 9.5, spacingAfter: 4 })
      } else {
        y += 2
      }

      addWrappedText('Objetivo Estrategico', { fontSize: 13, fontStyle: 'bold', spacingAfter: 2 })
      addWrappedText(exportSource.objective, { fontSize: 11, lineHeight: 5.6, spacingAfter: 4 })

      addWrappedText('Resumen', { fontSize: 12, fontStyle: 'bold', spacingAfter: 2 })
      addWrappedText(`Dificultad: ${exportSource.metadata.difficulty}`, { fontSize: 10.5, spacingAfter: 1.5 })
      addWrappedText(`Tiempo original: ${exportSource.metadata.originalTime}`, {
        fontSize: 10.5,
        spacingAfter: 1.5,
      })
      addWrappedText(`Tiempo de lectura: ${exportSource.metadata.readingTime}`, {
        fontSize: 10.5,
        spacingAfter: 1.5,
      })
      addWrappedText(`Tiempo ahorrado: ${exportSource.metadata.savedTime}`, {
        fontSize: 10.5,
        spacingAfter: 4,
      })

      addWrappedText('Fases y Acciones', { fontSize: 12, fontStyle: 'bold', spacingAfter: 2 })
      exportSource.phases.forEach((phase, phaseIndex) => {
        addWrappedText(`${phaseIndex + 1}. ${phase.title}`, {
          fontSize: 11.5,
          fontStyle: 'bold',
          spacingAfter: 1.5,
        })

        phase.items.forEach((item) => {
          addWrappedText(`- ${item}`, {
            fontSize: 10.5,
            x: marginX + 2,
            width: maxWidth - 2,
            spacingAfter: 1.2,
          })
        })
        y += 1
      })

      addWrappedText('Consejo Pro', { fontSize: 12, fontStyle: 'bold', spacingAfter: 2 })
      addWrappedText(exportSource.proTip, { fontSize: 10.8, lineHeight: 5.4, spacingAfter: 0 })

      const safeDate = new Date().toISOString().slice(0, 10)
      const filename = `action-extractor-${modeFilenamePartByMode[exportMode]}-${safeDate}.pdf`
      pdf.save(filename)
    } catch {
      setError('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const openHistoryItem = (item: HistoryItem) => {
    const mode = normalizeExtractionMode(item.mode)
    setUrl(item.url)
    setExtractionMode(mode)
    setResult({
      id: item.id,
      createdAt: item.createdAt,
      url: item.url,
      videoId: item.videoId ?? null,
      videoTitle: item.videoTitle ?? null,
      thumbnailUrl: item.thumbnailUrl ?? null,
      mode,
      objective: item.objective,
      phases: item.phases,
      proTip: item.proTip,
      metadata: item.metadata,
    })
    setActivePhase(null)
    setError(null)
    setShareCopied(false)
    setStreamStatus(null)
    setStreamPreview('')
    setShouldScrollToResult(true)
  }

  const detachCurrentResultFromHistory = useCallback((extractionId?: string) => {
    if (!extractionId) return

    setResult((previous) => {
      if (!previous || previous.id !== extractionId) return previous
      return {
        ...previous,
        id: undefined,
        createdAt: undefined,
      }
    })
    setShareCopied(false)
  }, [])

  const handleDeleteHistoryItem = useCallback(
    async (item: HistoryItem) => {
      const title = item.videoTitle?.trim() || item.objective?.trim() || item.url
      const confirmed =
        typeof window === 'undefined'
          ? false
          : window.confirm(`¿Eliminar esta extracción del historial?\n\n${title}`)
      if (!confirmed) return

      setError(null)
      setNotice(null)

      const result = await removeHistoryItem(item.id)
      if (result.unauthorized) {
        handleUnauthorized()
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }

      if (!result.ok) {
        setError(result.error ?? 'No se pudo eliminar la extracción del historial.')
        return
      }

      detachCurrentResultFromHistory(item.id)
      setNotice('Extracción eliminada del historial.')
    },
    [detachCurrentResultFromHistory, handleUnauthorized, removeHistoryItem]
  )

  const handleClearHistory = useCallback(async () => {
    if (history.length === 0) return

    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm('¿Seguro que quieres borrar todo tu historial? Esta acción no se puede deshacer.')
    if (!confirmed) return

    setError(null)
    setNotice(null)

    const result = await clearAllHistory()
    if (result.unauthorized) {
      handleUnauthorized()
      setError('Tu sesión expiró. Vuelve a iniciar sesión.')
      return
    }

    if (!result.ok) {
      setError(result.error ?? 'No se pudo limpiar el historial.')
      return
    }

    setResult((previous) => {
      if (!previous?.id) return previous
      return {
        ...previous,
        id: undefined,
        createdAt: undefined,
      }
    })
    setShareCopied(false)

    const deletedCount =
      typeof result.deletedCount === 'number' && result.deletedCount > 0
        ? ` (${result.deletedCount})`
        : ''
    setNotice(`Historial limpiado correctamente${deletedCount}.`)
  }, [clearAllHistory, handleUnauthorized, history.length])

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-black/90">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/15 dark:bg-zinc-950">
            <Image
              src="/roi-logo.png"
              alt="Roi Action Extractor App logo"
              fill
              sizes="36px"
              className="object-cover"
              priority
            />
          </div>
          <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-xl">
            Roi Action Extractor App
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-3 text-xs font-medium text-zinc-500 md:flex dark:text-zinc-400">
            <Link className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-100" href="/privacy-policy">
              Política de Privacidad
            </Link>
            <Link className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-100" href="/terms-of-use">
              Términos de Uso
            </Link>
          </div>

          <button
            onClick={toggleTheme}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-transparent px-3 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100 dark:shadow-[0_20px_44px_-24px_rgba(148,163,184,0.72)]"
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="text-sm font-medium whitespace-nowrap">
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </span>
          </button>

          {user ? (
            <>
              <span className="hidden text-sm text-zinc-600 dark:text-zinc-300 md:inline">
                {user.name} ({user.email})
              </span>
              <Link
                href="/settings"
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5 dark:shadow-[0_20px_44px_-24px_rgba(148,163,184,0.72)]"
              >
                Configuración
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-violet-700 dark:shadow-[0_24px_52px_-22px_rgba(139,92,246,0.96)]"
              >
                <LogOut size={16} />
                Salir
              </button>
            </>
          ) : (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Acceso requerido</span>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {sessionLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando sesión...</p>
          </div>
        ) : !user && !reauthRequired ? (
          <div className="space-y-8">
            {!resetTokenFromUrl && (
              <>
                <PublicHeroSection
                  onCreateAccount={() => {
                    setAuthMode('register')
                    setAuthNotice(null)
                    setAuthError(null)
                  }}
                  onLogin={() => {
                    setAuthMode('login')
                    setAuthError(null)
                  }}
                />

                <div className="text-center">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    De Video a{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                      Dinero Ejecutable
                    </span>{' '}
                    en Segundos.
                  </h1>
                  <div className="mx-auto mt-5 h-[180px] w-[180px]">
                    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-white/15 dark:bg-zinc-950">
                      <Image
                        src="/roi-logo.png"
                        alt="Roi Action Extractor App logo"
                        fill
                        sizes="180px"
                        className="object-cover"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <ValueHighlights />

            <AuthAccessPanel
              resetTokenFromUrl={resetTokenFromUrl}
              resetSuccess={resetSuccess}
              resetLoading={resetLoading}
              resetError={resetError}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              onNewPasswordChange={setNewPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmitResetPassword={handleResetPassword}
              authMode={authMode}
              onAuthModeChange={setAuthMode}
              authLoading={authLoading}
              googleAuthLoading={googleAuthLoading}
              authNotice={authNotice}
              authError={authError}
              onAuthNoticeChange={setAuthNotice}
              onAuthErrorChange={setAuthError}
              onGoogleAuthStart={handleGoogleAuthStart}
              onSubmitAuth={handleAuthSubmit}
              name={name}
              email={email}
              password={password}
              onNameChange={setName}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              forgotEmail={forgotEmail}
              forgotLoading={forgotLoading}
              forgotError={forgotError}
              forgotSuccess={forgotSuccess}
              onForgotEmailChange={setForgotEmail}
              onForgotErrorChange={setForgotError}
              onForgotSuccessChange={setForgotSuccess}
              onSubmitForgotPassword={handleForgotPassword}
            />
          </div>
        ) : (
          <>
            <section
              ref={extractorSectionRef}
              className="flex min-h-[calc(100svh-7rem)] flex-col justify-center"
            >
              <div className="mx-auto w-full max-w-4xl">
                <div>
                  <div className="mb-7 text-center md:mb-9">
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-100">
                      Roi Action Extractor
                    </p>
                  </div>
                  <div className="mb-4 flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                      <Brain size={12} />
                      Historial Personal Activo
                    </div>
                  </div>
                  <ExtractionForm
                    url={url}
                    isProcessing={isProcessing}
                    urlError={urlError}
                    onUrlChange={setUrl}
                    onExtract={handleExtract}
                    onScrollToHistory={handleScrollToHistory}
                  />
                </div>

                <WorkspaceControlsDock
                  extractionMode={extractionMode}
                  outputLanguage={outputLanguage}
                  isProcessing={isProcessing}
                  onExtractionModeChange={setExtractionMode}
                  onOutputLanguageChange={setOutputLanguage}
                  notionConfigured={notionConfigured}
                  notionConnected={notionConnected}
                  notionWorkspaceName={notionWorkspaceName}
                  notionLoading={notionLoading}
                  notionDisconnectLoading={notionDisconnectLoading}
                  onConnectNotion={handleConnectNotion}
                  onDisconnectNotion={handleDisconnectNotion}
                  trelloConfigured={trelloConfigured}
                  trelloConnected={trelloConnected}
                  trelloUsername={trelloUsername}
                  trelloLoading={trelloLoading}
                  trelloDisconnectLoading={trelloDisconnectLoading}
                  onConnectTrello={handleConnectTrello}
                  onDisconnectTrello={handleDisconnectTrello}
                  todoistConfigured={todoistConfigured}
                  todoistConnected={todoistConnected}
                  todoistUserLabel={todoistUserLabel}
                  todoistLoading={todoistLoading}
                  todoistDisconnectLoading={todoistDisconnectLoading}
                  onConnectTodoist={handleConnectTodoist}
                  onDisconnectTodoist={handleDisconnectTodoist}
                  googleDocsConfigured={googleDocsConfigured}
                  googleDocsConnected={googleDocsConnected}
                  googleDocsUserEmail={googleDocsUserEmail}
                  googleDocsLoading={googleDocsLoading}
                  googleDocsDisconnectLoading={googleDocsDisconnectLoading}
                  onConnectGoogleDocs={handleConnectGoogleDocs}
                  onDisconnectGoogleDocs={handleDisconnectGoogleDocs}
                />

                {notice && (
                  <div className="mx-auto mt-1 mb-8 w-full max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>
                  </div>
                )}

                {isProcessing && (
                  <div className="mx-auto mt-1 mb-8 w-full max-w-3xl rounded-xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
                    <p className="animate-pulse text-sm font-medium text-indigo-700 dark:text-indigo-300">
                      {streamStatus ?? 'Obteniendo transcripción y procesando con IA...'}
                    </p>
                    {streamPreview && (
                      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-indigo-100 bg-white p-3 text-xs text-slate-700 dark:border-indigo-800 dark:bg-slate-800 dark:text-slate-300">
                        {streamPreview}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </section>

            {result && (
              <div ref={resultAnchorRef} className="scroll-mt-24">
                <ResultPanel
                  result={result}
                  url={url}
                  extractionMode={extractionMode}
                  isProcessing={isProcessing}
                  activePhase={activePhase}
                  onTogglePhase={togglePhase}
                  isExportingPdf={isExportingPdf}
                  shareLoading={shareLoading}
                  shareCopied={shareCopied}
                  notionConfigured={notionConfigured}
                  notionConnected={notionConnected}
                  notionWorkspaceName={notionWorkspaceName}
                  notionLoading={notionLoading}
                  notionExportLoading={notionExportLoading}
                  trelloConfigured={trelloConfigured}
                  trelloConnected={trelloConnected}
                  trelloUsername={trelloUsername}
                  trelloLoading={trelloLoading}
                  trelloExportLoading={trelloExportLoading}
                  todoistConfigured={todoistConfigured}
                  todoistConnected={todoistConnected}
                  todoistUserLabel={todoistUserLabel}
                  todoistLoading={todoistLoading}
                  todoistExportLoading={todoistExportLoading}
                  googleDocsConfigured={googleDocsConfigured}
                  googleDocsConnected={googleDocsConnected}
                  googleDocsUserEmail={googleDocsUserEmail}
                  googleDocsLoading={googleDocsLoading}
                  googleDocsExportLoading={googleDocsExportLoading}
                  onDownloadPdf={handleDownloadPdf}
                  onCopyShareLink={handleCopyShareLink}
                  onCopyMarkdown={handleCopyNotion}
                  onExportToNotion={() => handleExportToNotion(result.id)}
                  onConnectNotion={handleConnectNotion}
                  onExportToTrello={() => handleExportToTrello(result.id)}
                  onConnectTrello={handleConnectTrello}
                  onExportToTodoist={() => handleExportToTodoist(result.id)}
                  onConnectTodoist={handleConnectTodoist}
                  onExportToGoogleDocs={() => handleExportToGoogleDocs(result.id)}
                  onConnectGoogleDocs={handleConnectGoogleDocs}
                  onReExtractMode={(mode) => {
                    handleScrollToExtractor()
                    void handleExtract({
                      url: (result.url ?? url).trim(),
                      mode,
                    })
                  }}
                />
              </div>
            )}

            <div ref={historyAnchorRef} className="scroll-mt-24 pt-6 md:pt-10">
              <HistoryPanel
                history={history}
                filteredHistory={filteredHistory}
                historyLoading={historyLoading}
                historyQuery={historyQuery}
                pdfExportLoading={isExportingPdf}
                notionConfigured={notionConfigured}
                notionConnected={notionConnected}
                notionLoading={notionLoading}
                notionExportLoading={notionExportLoading}
                trelloConfigured={trelloConfigured}
                trelloConnected={trelloConnected}
                trelloLoading={trelloLoading}
                trelloExportLoading={trelloExportLoading}
                todoistConfigured={todoistConfigured}
                todoistConnected={todoistConnected}
                todoistLoading={todoistLoading}
                todoistExportLoading={todoistExportLoading}
                googleDocsConfigured={googleDocsConfigured}
                googleDocsConnected={googleDocsConnected}
                googleDocsLoading={googleDocsLoading}
                googleDocsExportLoading={googleDocsExportLoading}
                deletingHistoryItemId={deletingHistoryItemId}
                clearingHistory={clearingHistory}
                onHistoryQueryChange={setHistoryQuery}
                onRefresh={() => void loadHistory()}
                onSelectItem={openHistoryItem}
                onDownloadPdf={(item) => void handleDownloadPdf(item)}
                onExportToNotion={(item) => void handleExportToNotion(item.id)}
                onConnectNotion={handleConnectNotion}
                onExportToTrello={(item) => void handleExportToTrello(item.id)}
                onConnectTrello={handleConnectTrello}
                onExportToTodoist={(item) => void handleExportToTodoist(item.id)}
                onConnectTodoist={handleConnectTodoist}
                onExportToGoogleDocs={(item) => void handleExportToGoogleDocs(item.id)}
                onConnectGoogleDocs={handleConnectGoogleDocs}
                onDeleteItem={(item) => void handleDeleteHistoryItem(item)}
                onClearHistory={() => void handleClearHistory()}
              />
            </div>

            {error && (
              <div className="max-w-2xl mx-auto mb-10 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 dark:bg-red-900/20 dark:border-red-800">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5 dark:text-red-400" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleScrollToExtractor}
              aria-label="Volver al extractor"
              className={`fixed bottom-6 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-violet-400/70 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_22px_44px_-18px_rgba(79,70,229,0.8)] transition-all duration-300 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500 md:right-6 ${
                showBackToExtractorButton
                  ? 'pointer-events-auto translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-3 opacity-0'
              }`}
            >
              <ArrowUp size={16} />
              <span className="hidden sm:inline">Volver al extractor</span>
              <span className="sm:hidden">Inicio</span>
            </button>

            {result && (
              <button
                type="button"
                onClick={handleScrollToHistory}
                aria-label="Ir al historial de extracciones"
                className={`fixed bottom-6 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-cyan-300/80 bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_22px_44px_-18px_rgba(13,148,136,0.85)] transition-all duration-300 hover:-translate-y-0.5 hover:from-cyan-400 hover:to-teal-400 md:left-6 ${
                  showGoToHistoryButton
                    ? 'pointer-events-auto translate-y-0 opacity-100'
                    : 'pointer-events-none translate-y-3 opacity-0'
                }`}
              >
                <History size={16} />
                <span className="hidden sm:inline">Ir al historial</span>
                <span className="sm:hidden">Historial</span>
              </button>
            )}

            {reauthRequired && !user && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="reauth-modal-title"
                  className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-slate-700"
                >
                  <div className="mb-5">
                    <h2 id="reauth-modal-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Sesión expirada
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Reautentica para seguir extrayendo, exportando y guardando historial. Tu
                      resultado actual se mantiene visible.
                    </p>
                  </div>

                  <form
                    onSubmit={handleAuthSubmit}
                    className="space-y-4"
                  >
                    <button
                      type="button"
                      onClick={handleGoogleAuthStart}
                      disabled={authLoading || googleAuthLoading}
                      className={`w-full h-11 rounded-lg border text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        authLoading || googleAuthLoading
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <GoogleIcon className="h-4 w-4" />
                      {googleAuthLoading ? 'Conectando con Google...' : 'Continuar con Google'}
                    </button>

                    <div className="relative py-1">
                      <div className="h-px w-full bg-slate-200 dark:bg-slate-700" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 px-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        o con correo
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-600 mb-1.5 dark:text-slate-300">
                        Correo
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        placeholder="tu@correo.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-600 mb-1.5 dark:text-slate-300">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={8}
                        className="w-full h-11 rounded-lg border border-slate-300 bg-white px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>

                    {authError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                        {authError}
                      </div>
                    )}

                    {authNotice && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                        {authNotice}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className={`w-full h-11 rounded-lg text-sm font-semibold text-white transition-colors ${
                        authLoading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {authLoading ? 'Procesando...' : 'Reiniciar sesión'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      }
    >
      <ActionExtractor />
    </Suspense>
  )
}
