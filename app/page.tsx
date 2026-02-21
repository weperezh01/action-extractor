'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  FileText,
  Lightbulb,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
  Zap,
} from 'lucide-react'
import {
  DEFAULT_EXTRACTION_MODE,
  EXTRACTION_MODE_OPTIONS,
  type ExtractionMode,
  getExtractionModeLabel,
  normalizeExtractionMode,
} from '@/lib/extraction-modes'
import { buildExtractionMarkdown } from '@/lib/export-content'
import {
  DEFAULT_EXTRACTION_OUTPUT_LANGUAGE,
  EXTRACTION_OUTPUT_LANGUAGE_OPTIONS,
  type ExtractionOutputLanguage,
} from '@/lib/output-language'
import { ExtractionForm } from '@/app/home/components/ExtractionForm'
import { HistoryPanel } from '@/app/home/components/HistoryPanel'
import { IntegrationsPanel } from '@/app/home/components/IntegrationsPanel'
import { ResultPanel } from '@/app/home/components/ResultPanel'
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

const MODE_ICONS: Record<string, React.ReactNode> = {
  action_plan: <Zap size={15} />,
  executive_summary: <FileText size={15} />,
  business_ideas: <Lightbulb size={15} />,
  key_quotes: <MessageSquare size={15} />,
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.08 3.56-5.16 3.56-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3A7.17 7.17 0 0 1 12 19.33a7.2 7.2 0 0 1-6.75-4.97H1.24v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.36a7.2 7.2 0 0 1 0-4.72V6.55H1.24a12 12 0 0 0 0 10.9l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.82l3.42-3.42A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.24 6.55l4 3.09A7.2 7.2 0 0 1 12 4.77Z"
      />
    </svg>
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
  const [theme, setTheme] = useState<Theme>('light')
  const [reauthRequired, setReauthRequired] = useState(false)
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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur dark:bg-slate-950/90 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Image
              src="/roi-logo.png"
              alt="Roi Action Extractor App logo"
              fill
              sizes="36px"
              className="object-cover"
              priority
            />
          </div>
          <span className="font-bold text-base md:text-xl tracking-tight text-slate-800 dark:text-slate-100">
            Roi Action Extractor App
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 text-xs font-medium text-slate-500">
            <Link className="hover:text-indigo-600 transition-colors" href="/privacy-policy">
              Política de Privacidad
            </Link>
            <Link className="hover:text-indigo-600 transition-colors" href="/terms-of-use">
              Términos de Uso
            </Link>
          </div>

          <button
            onClick={toggleTheme}
            className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors inline-flex items-center gap-2 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-100"
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
              <span className="hidden md:inline text-sm text-slate-600 dark:text-slate-300">
                {user.name} ({user.email})
              </span>
              <Link
                href="/settings"
                className="bg-white text-slate-700 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-100 transition-colors dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Configuración
              </Link>
              <button
                onClick={handleLogout}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors inline-flex items-center gap-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <LogOut size={16} />
                Salir
              </button>
            </>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">Acceso requerido</span>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-10 md:py-14">
        {sessionLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Cargando sesión...</p>
          </div>
        ) : !user && !reauthRequired ? (
          <div className="space-y-8">
            {!resetTokenFromUrl && (
              <section className="max-w-5xl mx-auto rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
                <div className="grid lg:grid-cols-2 gap-0">
                  <div className="p-6 md:p-10 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 border-b lg:border-b-0 lg:border-r border-slate-200">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-bold tracking-wider uppercase text-indigo-700 mb-4">
                      <Zap size={13} />
                      ROI Action System
                    </div>

                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                      De 2 horas de video a un plan ejecutable en minutos.
                    </h2>
                    <p className="mt-4 text-sm md:text-base text-slate-600 leading-relaxed">
                      Convierte cualquier video de YouTube en decisiones listas para ejecutar:
                      plan de acción, resumen ejecutivo, ideas de negocio o frases clave.
                    </p>

                    <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-4">
                        <p className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">3m</p>
                        <p className="text-xs text-slate-500 mt-1 leading-tight">Lectura promedio</p>
                      </div>
                      <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-4">
                        <p className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">4</p>
                        <p className="text-xs text-slate-500 mt-1 leading-tight">Modos de extracción</p>
                      </div>
                      <div className="rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-4">
                        <p className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">1-click</p>
                        <p className="text-xs text-slate-500 mt-1 leading-tight">Export a apps</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setAuthMode('register')}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        Crear cuenta
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('login')}
                        className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
                      >
                        Ya tengo cuenta
                      </button>
                    </div>
                  </div>

                  <div className="p-6 md:p-10 bg-slate-50">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Vista previa del flujo
                    </h3>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-800">Resultado generado</p>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Plan de Acción
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="rounded-lg border border-slate-200 p-2 bg-slate-50">
                          <p className="text-xs font-semibold text-slate-700">Fase 1: Posicionamiento</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-2 bg-slate-50">
                          <p className="text-xs font-semibold text-slate-700">Fase 2: Oferta y monetización</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-2 bg-slate-50">
                          <p className="text-xs font-semibold text-slate-700">Fase 3: Ejecución diaria</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                          <p className="text-[11px] text-slate-500">Tiempo ahorrado</p>
                          <p className="text-sm font-bold text-emerald-600">1h 27m</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                          <p className="text-[11px] text-slate-500">Dificultad</p>
                          <p className="text-sm font-bold text-amber-600">Media</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs text-slate-700">
                          “Pasé de consumir contenido a ejecutar acciones concretas cada día.”
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs text-slate-700">
                          “El modo Resumen Ejecutivo me ahorra reuniones y acelera decisiones.”
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="max-w-md mx-auto">
            {resetTokenFromUrl ? (
              resetSuccess ? (
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={36} className="text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Contraseña actualizada</h2>
                    <p className="text-slate-600 text-sm mt-2">
                      Tu contraseña fue restablecida exitosamente.
                    </p>
                  </div>
                  <button
                    onClick={() => { window.location.href = '/' }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Iniciar sesión
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8 space-y-3">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                      Nueva contraseña
                    </h1>
                    <p className="text-slate-600 text-sm">
                      Escribe y confirma tu nueva contraseña.
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg shadow-slate-200/50">
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1.5">Nueva contraseña</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          required
                          minLength={8}
                          className="w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Mínimo 8 caracteres"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1.5">Confirmar contraseña</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          required
                          minLength={8}
                          className="w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Repite la contraseña"
                        />
                      </div>
                      {resetError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                          {resetError}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className={`w-full h-11 rounded-lg text-sm font-semibold text-white transition-colors ${
                          resetLoading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {resetLoading ? 'Guardando...' : 'Restablecer contraseña'}
                      </button>
                    </form>
                  </div>
                </>
              )
            ) : authMode === 'forgot' ? (
              forgotSuccess ? (
                <div className="text-center space-y-5">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={36} className="text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Revisa tu correo</h2>
                    <p className="text-slate-600 text-sm mt-2">
                      Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.
                      El enlace expira en 1 hora.
                    </p>
                  </div>
                  <button
                    onClick={() => { setAuthMode('login'); setForgotSuccess(false); setForgotEmail('') }}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8 space-y-3">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                      Recuperar contraseña
                    </h1>
                    <p className="text-slate-600 text-sm">
                      Te enviaremos un enlace para restablecer tu contraseña.
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg shadow-slate-200/50">
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1.5">Correo electrónico</label>
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(event) => setForgotEmail(event.target.value)}
                          required
                          className="w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="tu@correo.com"
                        />
                      </div>
                      {forgotError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                          {forgotError}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className={`w-full h-11 rounded-lg text-sm font-semibold text-white transition-colors ${
                          forgotLoading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {forgotLoading ? 'Enviando...' : 'Enviar enlace'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('login'); setForgotError(null) }}
                        className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium py-1"
                      >
                        ← Volver al inicio de sesión
                      </button>
                    </form>
                  </div>
                </>
              )
            ) : (
              <>
                <div className="text-center mb-8 space-y-3">
                  <p className="text-slate-600 text-sm">
                    Crea tu cuenta para guardar tu historial de extracciones por usuario.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg shadow-slate-200/50">
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <button
                      onClick={() => {
                        setAuthMode('login')
                        setAuthError(null)
                      }}
                      className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                        authMode === 'login'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Iniciar sesión
                    </button>
                    <button
                      onClick={() => {
                        setAuthMode('register')
                        setAuthNotice(null)
                        setAuthError(null)
                      }}
                      className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                        authMode === 'register'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Registrarme
                    </button>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
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
                      {googleAuthLoading
                        ? 'Conectando con Google...'
                        : authMode === 'register'
                          ? 'Crear cuenta con Google'
                          : 'Continuar con Google'}
                    </button>

                    <div className="relative py-1">
                      <div className="h-px w-full bg-slate-200" />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        o con correo
                      </span>
                    </div>

                    {authMode === 'register' && (
                      <div>
                        <label className="block text-sm text-slate-600 mb-1.5">Nombre</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                          className="w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          placeholder="Tu nombre"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm text-slate-600 mb-1.5">Correo</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        className="w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="tu@correo.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-600 mb-1.5">Contraseña</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={8}
                        className="w-full h-11 rounded-lg border border-slate-300 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Mínimo 8 caracteres"
                      />
                    </div>

                    {authNotice && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
                        {authNotice}
                      </div>
                    )}

                    {authError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className={`w-full h-11 rounded-lg text-sm font-semibold text-white transition-colors ${
                        authLoading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {authLoading
                        ? 'Procesando...'
                        : authMode === 'login'
                          ? 'Entrar'
                          : 'Crear cuenta'}
                    </button>

                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('forgot')
                          setAuthError(null)
                          setAuthNotice(null)
                        }}
                        className="w-full text-sm text-slate-500 hover:text-indigo-600 font-medium py-1 transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </form>
                </div>
              </>
            )}
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-100">
                <Brain size={12} />
                Historial Personal Activo
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                De Video a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                  Dinero Ejecutable
                </span>{' '}
                en Segundos.
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                {user ? (
                  <>
                    Usuario conectado: <span className="font-semibold text-slate-800">{user.name}</span>
                  </>
                ) : (
                  'Sesión expirada. Reautentica para continuar.'
                )}
              </p>
            </div>

            <div className="max-w-2xl mx-auto mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Modo de extracción
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {EXTRACTION_MODE_OPTIONS.map((option) => {
                  const isActive = extractionMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setExtractionMode(option.value)}
                      className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                        isActive
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <div className={`mb-1.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {MODE_ICONS[option.value]}
                      </div>
                      <p className="text-sm font-semibold leading-tight">{option.label}</p>
                      <p className="text-xs mt-1 leading-tight opacity-80">{option.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="max-w-2xl mx-auto mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Idioma de salida
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {EXTRACTION_OUTPUT_LANGUAGE_OPTIONS.map((option) => {
                  const isActive = outputLanguage === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setOutputLanguage(option.value)}
                      className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                        isActive
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <p className="text-sm font-semibold leading-tight">{option.label}</p>
                      <p className="text-xs mt-1 leading-tight opacity-80">{option.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <IntegrationsPanel
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

            <ExtractionForm
              url={url}
              isProcessing={isProcessing}
              urlError={urlError}
              onUrlChange={setUrl}
              onExtract={handleExtract}
            />

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

            {isProcessing && (
              <div className="max-w-2xl mx-auto mb-10 bg-indigo-50 border border-indigo-100 rounded-xl p-4 dark:bg-indigo-900/20 dark:border-indigo-800">
                <p className="text-sm text-indigo-700 font-medium animate-pulse dark:text-indigo-300">
                  {streamStatus ?? 'Obteniendo transcripción y procesando con IA...'}
                </p>
                {streamPreview && (
                  <pre className="mt-3 text-xs text-slate-700 bg-white border border-indigo-100 rounded-lg p-3 max-h-56 overflow-auto whitespace-pre-wrap break-words dark:text-slate-300 dark:bg-slate-800 dark:border-indigo-800">
                    {streamPreview}
                  </pre>
                )}
              </div>
            )}

            {notice && (
              <div className="max-w-2xl mx-auto mb-10 bg-emerald-50 border border-emerald-200 rounded-xl p-4 dark:bg-emerald-900/20 dark:border-emerald-800">
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>
              </div>
            )}

            {error && (
              <div className="max-w-2xl mx-auto mb-10 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 dark:bg-red-900/20 dark:border-red-800">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5 dark:text-red-400" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {!result && !isProcessing && !error && (
              <div className="grid md:grid-cols-3 gap-4 text-center">
                <div className="p-5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl mx-auto mb-4 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Clock size={24} />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Ahorra Horas</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">De 2 horas de video a 3 minutos de lectura.</p>
                </div>
                <div className="p-5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl mx-auto mb-4 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <CheckSquare size={24} />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Acción Pura</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sin relleno. Solo los pasos que generan ROI.</p>
                </div>
                <div className="p-5 rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
                  <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-2xl mx-auto mb-4 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Copy size={24} />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Exporta Fácil</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Exporta en un click a Notion, Trello, Todoist o Google Docs.</p>
                </div>
              </div>
            )}

            {result && (
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
                onExportToNotion={() => void handleExportToNotion(result.id)}
                onConnectNotion={handleConnectNotion}
                onExportToTrello={() => void handleExportToTrello(result.id)}
                onConnectTrello={handleConnectTrello}
                onExportToTodoist={() => void handleExportToTodoist(result.id)}
                onConnectTodoist={handleConnectTodoist}
                onExportToGoogleDocs={() => void handleExportToGoogleDocs(result.id)}
                onConnectGoogleDocs={handleConnectGoogleDocs}
                onReExtractMode={(mode) =>
                  void handleExtract({
                    url: (result.url ?? url).trim(),
                    mode,
                  })
                }
              />
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      }
    >
      <ActionExtractor />
    </Suspense>
  )
}
