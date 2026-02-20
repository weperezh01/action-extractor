'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  History,
  LogOut,
  Moon,
  Play,
  Search,
  Share2,
  Sun,
  Zap,
} from 'lucide-react'
import {
  DEFAULT_EXTRACTION_MODE,
  EXTRACTION_MODE_OPTIONS,
  ExtractionMode,
  getExtractionModeLabel,
  normalizeExtractionMode,
} from '@/lib/extraction-modes'
import {
  DEFAULT_EXTRACTION_OUTPUT_LANGUAGE,
  EXTRACTION_OUTPUT_LANGUAGE_OPTIONS,
  ExtractionOutputLanguage,
} from '@/lib/output-language'

interface Phase {
  id: number
  title: string
  items: string[]
}

interface ExtractMetadata {
  originalTime: string
  readingTime: string
  difficulty: string
  savedTime: string
}

interface ExtractResult {
  id?: string
  createdAt?: string
  cached?: boolean
  url?: string
  videoId?: string | null
  videoTitle?: string | null
  thumbnailUrl?: string | null
  mode?: ExtractionMode
  objective: string
  phases: Phase[]
  proTip: string
  metadata: ExtractMetadata
}

interface HistoryItem extends ExtractResult {
  id: string
  url: string
  createdAt: string
}

interface SessionUser {
  id: string
  name: string
  email: string
}

type AuthMode = 'login' | 'register' | 'forgot'
type Theme = 'light' | 'dark'

interface ParsedSseEvent {
  event: string
  data: string
}

const THEME_STORAGE_KEY = 'actionextractor-theme'

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'

  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme
    }
  } catch {
    // noop
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function formatHistoryDate(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function parseSseFrame(frame: string): ParsedSseEvent | null {
  if (!frame.trim()) return null

  const lines = frame.split(/\r?\n/)
  let event = 'message'
  const dataLines: string[] = []

  for (const rawLine of lines) {
    if (rawLine.startsWith('event:')) {
      event = rawLine.slice(6).trim()
      continue
    }

    if (rawLine.startsWith('data:')) {
      dataLines.push(rawLine.slice(5).trimStart())
    }
  }

  return {
    event,
    data: dataLines.join('\n'),
  }
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

  const [sessionLoading, setSessionLoading] = useState(true)
  const [user, setUser] = useState<SessionUser | null>(null)

  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [notionConfigured, setNotionConfigured] = useState(false)
  const [notionConnected, setNotionConnected] = useState(false)
  const [notionWorkspaceName, setNotionWorkspaceName] = useState<string | null>(null)
  const [notionLoading, setNotionLoading] = useState(false)
  const [notionExportLoading, setNotionExportLoading] = useState(false)
  const [notionDisconnectLoading, setNotionDisconnectLoading] = useState(false)
  const [trelloConfigured, setTrelloConfigured] = useState(false)
  const [trelloConnected, setTrelloConnected] = useState(false)
  const [trelloUsername, setTrelloUsername] = useState<string | null>(null)
  const [trelloLoading, setTrelloLoading] = useState(false)
  const [trelloExportLoading, setTrelloExportLoading] = useState(false)
  const [trelloDisconnectLoading, setTrelloDisconnectLoading] = useState(false)
  const [todoistConfigured, setTodoistConfigured] = useState(false)
  const [todoistConnected, setTodoistConnected] = useState(false)
  const [todoistUserLabel, setTodoistUserLabel] = useState<string | null>(null)
  const [todoistLoading, setTodoistLoading] = useState(false)
  const [todoistExportLoading, setTodoistExportLoading] = useState(false)
  const [todoistDisconnectLoading, setTodoistDisconnectLoading] = useState(false)
  const [googleDocsConfigured, setGoogleDocsConfigured] = useState(false)
  const [googleDocsConnected, setGoogleDocsConnected] = useState(false)
  const [googleDocsUserEmail, setGoogleDocsUserEmail] = useState<string | null>(null)
  const [googleDocsLoading, setGoogleDocsLoading] = useState(false)
  const [googleDocsExportLoading, setGoogleDocsExportLoading] = useState(false)
  const [googleDocsDisconnectLoading, setGoogleDocsDisconnectLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [streamPreview, setStreamPreview] = useState('')
  const [theme, setTheme] = useState<Theme>('light')

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

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/history', { cache: 'no-store' })
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
      setHistoryLoading(false)
    }
  }

  const loadNotionStatus = async () => {
    if (!user) {
      setNotionConfigured(false)
      setNotionConnected(false)
      setNotionWorkspaceName(null)
      return
    }

    try {
      const res = await fetch('/api/notion/status', { cache: 'no-store' })
      if (res.status === 401) {
        setNotionConfigured(false)
        setNotionConnected(false)
        setNotionWorkspaceName(null)
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            configured?: unknown
            connected?: unknown
            workspaceName?: unknown
          }
        | null

      if (!res.ok) {
        setNotionConfigured(false)
        setNotionConnected(false)
        setNotionWorkspaceName(null)
        return
      }

      setNotionConfigured(data?.configured === true)
      setNotionConnected(data?.connected === true)
      setNotionWorkspaceName(
        typeof data?.workspaceName === 'string' && data.workspaceName.trim()
          ? data.workspaceName
          : null
      )
    } catch {
      setNotionConfigured(false)
      setNotionConnected(false)
      setNotionWorkspaceName(null)
    }
  }

  const loadTrelloStatus = async () => {
    if (!user) {
      setTrelloConfigured(false)
      setTrelloConnected(false)
      setTrelloUsername(null)
      return
    }

    try {
      const res = await fetch('/api/trello/status', { cache: 'no-store' })
      if (res.status === 401) {
        setTrelloConfigured(false)
        setTrelloConnected(false)
        setTrelloUsername(null)
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            configured?: unknown
            connected?: unknown
            username?: unknown
          }
        | null

      if (!res.ok) {
        setTrelloConfigured(false)
        setTrelloConnected(false)
        setTrelloUsername(null)
        return
      }

      setTrelloConfigured(data?.configured === true)
      setTrelloConnected(data?.connected === true)
      setTrelloUsername(
        typeof data?.username === 'string' && data.username.trim()
          ? data.username
          : null
      )
    } catch {
      setTrelloConfigured(false)
      setTrelloConnected(false)
      setTrelloUsername(null)
    }
  }

  const loadTodoistStatus = async () => {
    if (!user) {
      setTodoistConfigured(false)
      setTodoistConnected(false)
      setTodoistUserLabel(null)
      return
    }

    try {
      const res = await fetch('/api/todoist/status', { cache: 'no-store' })
      if (res.status === 401) {
        setTodoistConfigured(false)
        setTodoistConnected(false)
        setTodoistUserLabel(null)
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            configured?: unknown
            connected?: unknown
            userEmail?: unknown
            userName?: unknown
          }
        | null

      if (!res.ok) {
        setTodoistConfigured(false)
        setTodoistConnected(false)
        setTodoistUserLabel(null)
        return
      }

      setTodoistConfigured(data?.configured === true)
      setTodoistConnected(data?.connected === true)

      const email =
        typeof data?.userEmail === 'string' && data.userEmail.trim()
          ? data.userEmail
          : null
      const name =
        typeof data?.userName === 'string' && data.userName.trim()
          ? data.userName
          : null
      setTodoistUserLabel(email ?? name)
    } catch {
      setTodoistConfigured(false)
      setTodoistConnected(false)
      setTodoistUserLabel(null)
    }
  }

  const loadGoogleDocsStatus = async () => {
    if (!user) {
      setGoogleDocsConfigured(false)
      setGoogleDocsConnected(false)
      setGoogleDocsUserEmail(null)
      return
    }

    try {
      const res = await fetch('/api/google-docs/status', { cache: 'no-store' })
      if (res.status === 401) {
        setGoogleDocsConfigured(false)
        setGoogleDocsConnected(false)
        setGoogleDocsUserEmail(null)
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            configured?: unknown
            connected?: unknown
            userEmail?: unknown
          }
        | null

      if (!res.ok) {
        setGoogleDocsConfigured(false)
        setGoogleDocsConnected(false)
        setGoogleDocsUserEmail(null)
        return
      }

      setGoogleDocsConfigured(data?.configured === true)
      setGoogleDocsConnected(data?.connected === true)
      setGoogleDocsUserEmail(
        typeof data?.userEmail === 'string' && data.userEmail.trim()
          ? data.userEmail
          : null
      )
    } catch {
      setGoogleDocsConfigured(false)
      setGoogleDocsConnected(false)
      setGoogleDocsUserEmail(null)
    }
  }

  const loadSession = async () => {
    setSessionLoading(true)
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.user) {
        setUser(data.user as SessionUser)
        await loadHistory()
      } else {
        setUser(null)
        setHistory([])
      }
    } catch {
      setUser(null)
      setHistory([])
    } finally {
      setSessionLoading(false)
    }
  }

  useEffect(() => {
    void loadSession()
  }, [])

  useEffect(() => {
    if (!user) {
      setNotionConfigured(false)
      setNotionConnected(false)
      setNotionWorkspaceName(null)
      setTrelloConfigured(false)
      setTrelloConnected(false)
      setTrelloUsername(null)
      setTodoistConfigured(false)
      setTodoistConnected(false)
      setTodoistUserLabel(null)
      setGoogleDocsConfigured(false)
      setGoogleDocsConnected(false)
      setGoogleDocsUserEmail(null)
      return
    }
    void Promise.all([
      loadNotionStatus(),
      loadTrelloStatus(),
      loadTodoistStatus(),
      loadGoogleDocsStatus(),
    ])
  }, [user])

  useEffect(() => {
    const initialTheme = resolveInitialTheme()
    setTheme(initialTheme)
    applyTheme(initialTheme)
  }, [])

  useEffect(() => {
    const verificationStatus = searchParams.get('email_verification')
    if (!verificationStatus) return

    setAuthMode('login')
    if (verificationStatus === 'success') {
      setAuthError(null)
      setAuthNotice('Correo verificado correctamente. Ya puedes iniciar sesión.')
    } else if (verificationStatus === 'expired') {
      setAuthNotice(null)
      setAuthError('El enlace de verificación expiró. Regístrate nuevamente para recibir otro correo.')
    } else if (verificationStatus === 'invalid') {
      setAuthNotice(null)
      setAuthError('El enlace de verificación no es válido o ya fue utilizado.')
    } else {
      setAuthNotice(null)
      setAuthError('No se pudo verificar tu correo. Intenta nuevamente.')
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams])

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
          setUser(null)
          setHistory([])
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
  }, [searchParams, trelloLoading, user])

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (authLoading) return

    setAuthLoading(true)
    setAuthError(null)
    setAuthNotice(null)

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const payload: Record<string, string> = {
      email,
      password,
    }

    if (authMode === 'register') {
      payload.name = name
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = (await res.json().catch(() => null)) as
        | {
            user?: SessionUser
            error?: string
            message?: string
            requiresEmailVerification?: boolean
          }
        | null
      if (!res.ok) {
        setAuthError(
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo completar la operación.'
        )
        return
      }

      if (authMode === 'register') {
        const registerMessage =
          typeof data?.message === 'string' && data.message.trim()
            ? data.message
            : 'Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión.'
        setAuthMode('login')
        setPassword('')
        setAuthError(null)
        setAuthNotice(registerMessage)
        setError(null)
        return
      }

      if (!data?.user) {
        setAuthError('Respuesta inválida del servidor. Intenta de nuevo.')
        return
      }

      setUser(data.user as SessionUser)
      setPassword('')
      setAuthError(null)
      setAuthNotice(null)
      setError(null)
      await loadHistory()
    } catch {
      setAuthError('Error de conexión. Intenta de nuevo.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (forgotLoading) return
    setForgotLoading(true)
    setForgotError(null)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setForgotError(
          typeof data?.error === 'string'
            ? data.error
            : 'Error al enviar el correo. Intenta de nuevo.'
        )
        return
      }
      setForgotSuccess(true)
    } catch {
      setForgotError('Error de conexión. Intenta de nuevo.')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (resetLoading) return
    if (newPassword !== confirmPassword) {
      setResetError('Las contraseñas no coinciden.')
      return
    }
    setResetLoading(true)
    setResetError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetTokenFromUrl, password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResetError(data.error ?? 'No se pudo restablecer la contraseña.')
        return
      }
      setResetSuccess(true)
    } catch {
      setResetError('Error de conexión. Intenta de nuevo.')
    } finally {
      setResetLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setHistory([])
      setResult(null)
      setError(null)
      setNotice(null)
      setActivePhase(null)
      setStreamStatus(null)
      setStreamPreview('')
      setNotionConfigured(false)
      setNotionConnected(false)
      setNotionWorkspaceName(null)
      setNotionLoading(false)
      setNotionExportLoading(false)
      setNotionDisconnectLoading(false)
      setTrelloConfigured(false)
      setTrelloConnected(false)
      setTrelloUsername(null)
      setTrelloLoading(false)
      setTrelloExportLoading(false)
      setTrelloDisconnectLoading(false)
      setTodoistConfigured(false)
      setTodoistConnected(false)
      setTodoistUserLabel(null)
      setTodoistLoading(false)
      setTodoistExportLoading(false)
      setTodoistDisconnectLoading(false)
      setGoogleDocsConfigured(false)
      setGoogleDocsConnected(false)
      setGoogleDocsUserEmail(null)
      setGoogleDocsLoading(false)
      setGoogleDocsExportLoading(false)
      setGoogleDocsDisconnectLoading(false)
    }
  }

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    applyTheme(nextTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      // noop
    }
  }

  const handleExtract = async () => {
    if (!user) {
      setError('Debes iniciar sesión para extraer contenido.')
      return
    }

    if (!url.trim() || isProcessing) return
    setIsProcessing(true)
    setError(null)
    setNotice(null)
    setResult(null)
    setShareCopied(false)
    setStreamStatus(`Iniciando extracción (${getExtractionModeLabel(extractionMode)})...`)
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
        body: JSON.stringify({ url, mode: extractionMode, outputLanguage }),
      })

      if (res.status === 401) {
        setUser(null)
        setHistory([])
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
    const lines: string[] = [
      `# ${result.objective}`,
      '',
      `**Tiempo ahorrado:** ${result.metadata.savedTime} | **Dificultad:** ${result.metadata.difficulty}`,
      '',
    ]
    result.phases.forEach((phase) => {
      lines.push(`## ${phase.title}`)
      phase.items.forEach((item) => lines.push(`- [ ] ${item}`))
      lines.push('')
    })
    lines.push(`> **Consejo Pro:** ${result.proTip}`)
    await navigator.clipboard.writeText(lines.join('\n'))
    setNotice('Contenido copiado como Markdown.')
  }

  const handleConnectNotion = () => {
    if (notionLoading) return
    setNotionLoading(true)
    window.location.href = '/api/notion/connect'
  }

  const handleDisconnectNotion = async () => {
    if (notionDisconnectLoading) return
    setNotionDisconnectLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/notion/disconnect', {
        method: 'POST',
      })
      if (res.status === 401) {
        setUser(null)
        setHistory([])
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo desconectar Notion.'
        setError(message)
        return
      }

      setNotionConnected(false)
      setNotionWorkspaceName(null)
      setNotice('Notion desconectado. Ya puedes conectar otra cuenta.')
      void loadNotionStatus()
    } catch {
      setError('Error de conexión al desconectar Notion.')
    } finally {
      setNotionDisconnectLoading(false)
    }
  }

  const handleExportToNotion = async () => {
    if (!result?.id || notionExportLoading) return

    setNotionExportLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/notion/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId: result.id }),
      })

      if (res.status === 401) {
        setUser(null)
        setHistory([])
        setNotionConnected(false)
        setNotionWorkspaceName(null)
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }

      const data = (await res.json().catch(() => null)) as
        | { error?: unknown; pageUrl?: unknown }
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo exportar a Notion.'
        setError(message)
        void loadNotionStatus()
        return
      }

      const pageUrl = typeof data?.pageUrl === 'string' ? data.pageUrl : ''
      if (pageUrl) {
        window.open(pageUrl, '_blank', 'noopener,noreferrer')
      }

      setNotice('Exportación completada en Notion.')
      void loadNotionStatus()
    } catch {
      setError('Error de conexión al exportar a Notion.')
    } finally {
      setNotionExportLoading(false)
    }
  }

  const handleConnectTrello = () => {
    if (trelloLoading) return
    setTrelloLoading(true)
    window.location.href = '/api/trello/connect'
  }

  const handleDisconnectTrello = async () => {
    if (trelloDisconnectLoading) return
    setTrelloDisconnectLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/trello/disconnect', {
        method: 'POST',
      })
      if (res.status === 401) {
        setUser(null)
        setHistory([])
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo desconectar Trello.'
        setError(message)
        return
      }

      setTrelloConnected(false)
      setTrelloUsername(null)
      setNotice('Trello desconectado. Ya puedes conectar otra cuenta.')
      void loadTrelloStatus()
    } catch {
      setError('Error de conexión al desconectar Trello.')
    } finally {
      setTrelloDisconnectLoading(false)
    }
  }

  const handleExportToTrello = async () => {
    if (!result?.id || trelloExportLoading) return

    setTrelloExportLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/trello/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId: result.id }),
      })

      if (res.status === 401) {
        setUser(null)
        setHistory([])
        setTrelloConnected(false)
        setTrelloUsername(null)
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }

      const data = (await res.json().catch(() => null)) as
        | {
            error?: unknown
            cardUrl?: unknown
            boardName?: unknown
            listName?: unknown
          }
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo exportar a Trello.'
        setError(message)
        void loadTrelloStatus()
        return
      }

      const cardUrl = typeof data?.cardUrl === 'string' ? data.cardUrl : ''
      if (cardUrl) {
        const opened = window.open(cardUrl, '_blank', 'noopener,noreferrer')
        if (!opened) {
          window.location.href = cardUrl
        }
      }

      const boardName =
        typeof data?.boardName === 'string' && data.boardName.trim()
          ? data.boardName
          : null
      const listName =
        typeof data?.listName === 'string' && data.listName.trim()
          ? data.listName
          : null
      const locationText =
        boardName && listName
          ? ` Tablero: ${boardName} | Lista: ${listName}.`
          : ''

      setNotice(`Exportación completada en Trello.${locationText}`)
      void loadTrelloStatus()
    } catch {
      setError('Error de conexión al exportar a Trello.')
    } finally {
      setTrelloExportLoading(false)
    }
  }

  const handleConnectTodoist = () => {
    if (todoistLoading) return
    setTodoistLoading(true)
    window.location.href = '/api/todoist/connect'
  }

  const handleDisconnectTodoist = async () => {
    if (todoistDisconnectLoading) return
    setTodoistDisconnectLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/todoist/disconnect', {
        method: 'POST',
      })
      if (res.status === 401) {
        setUser(null)
        setHistory([])
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo desconectar Todoist.'
        setError(message)
        return
      }

      setTodoistConnected(false)
      setTodoistUserLabel(null)
      setNotice('Todoist desconectado. Ya puedes conectar otra cuenta.')
      void loadTodoistStatus()
    } catch {
      setError('Error de conexión al desconectar Todoist.')
    } finally {
      setTodoistDisconnectLoading(false)
    }
  }

  const handleExportToTodoist = async () => {
    if (!result?.id || todoistExportLoading) return

    setTodoistExportLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/todoist/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId: result.id }),
      })

      if (res.status === 401) {
        setUser(null)
        setHistory([])
        setTodoistConnected(false)
        setTodoistUserLabel(null)
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }

      const data = (await res.json().catch(() => null)) as
        | { error?: unknown; taskUrl?: unknown }
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo exportar a Todoist.'
        setError(message)
        void loadTodoistStatus()
        return
      }

      const taskUrl = typeof data?.taskUrl === 'string' ? data.taskUrl : ''
      if (taskUrl) {
        window.open(taskUrl, '_blank', 'noopener,noreferrer')
      }

      setNotice('Exportación completada en Todoist.')
      void loadTodoistStatus()
    } catch {
      setError('Error de conexión al exportar a Todoist.')
    } finally {
      setTodoistExportLoading(false)
    }
  }

  const handleConnectGoogleDocs = () => {
    if (googleDocsLoading) return
    setGoogleDocsLoading(true)
    window.location.href = '/api/google-docs/connect'
  }

  const handleDisconnectGoogleDocs = async () => {
    if (googleDocsDisconnectLoading) return
    setGoogleDocsDisconnectLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/google-docs/disconnect', {
        method: 'POST',
      })
      if (res.status === 401) {
        setUser(null)
        setHistory([])
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo desconectar Google Docs.'
        setError(message)
        return
      }

      setGoogleDocsConnected(false)
      setGoogleDocsUserEmail(null)
      setNotice('Google Docs desconectado. Ya puedes conectar otra cuenta.')
      void loadGoogleDocsStatus()
    } catch {
      setError('Error de conexión al desconectar Google Docs.')
    } finally {
      setGoogleDocsDisconnectLoading(false)
    }
  }

  const handleExportToGoogleDocs = async () => {
    if (!result?.id || googleDocsExportLoading) return

    setGoogleDocsExportLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/google-docs/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId: result.id }),
      })

      if (res.status === 401) {
        setUser(null)
        setHistory([])
        setGoogleDocsConnected(false)
        setGoogleDocsUserEmail(null)
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        return
      }

      const data = (await res.json().catch(() => null)) as
        | { error?: unknown; documentUrl?: unknown }
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo exportar a Google Docs.'
        setError(message)
        void loadGoogleDocsStatus()
        return
      }

      const documentUrl =
        typeof data?.documentUrl === 'string' ? data.documentUrl : ''
      if (documentUrl) {
        window.open(documentUrl, '_blank', 'noopener,noreferrer')
      }

      setNotice('Exportación completada en Google Docs.')
      void loadGoogleDocsStatus()
    } catch {
      setError('Error de conexión al exportar a Google Docs.')
    } finally {
      setGoogleDocsExportLoading(false)
    }
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
        setUser(null)
        setHistory([])
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

  const handleDownloadPdf = async () => {
    if (!result || isExportingPdf) return

    setIsExportingPdf(true)
    try {
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
      pdf.text('ActionExtractor - Plan de Accion', marginX, y)
      y += 8

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      const generatedAt = new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())
      pdf.text(`Generado: ${generatedAt}`, marginX, y)
      y += 6
      if (url.trim()) {
        addWrappedText(`Video: ${url}`, { fontSize: 9.5, spacingAfter: 4 })
      } else {
        y += 2
      }

      addWrappedText('Objetivo Estrategico', { fontSize: 13, fontStyle: 'bold', spacingAfter: 2 })
      addWrappedText(result.objective, { fontSize: 11, lineHeight: 5.6, spacingAfter: 4 })

      addWrappedText('Resumen', { fontSize: 12, fontStyle: 'bold', spacingAfter: 2 })
      addWrappedText(`Dificultad: ${result.metadata.difficulty}`, { fontSize: 10.5, spacingAfter: 1.5 })
      addWrappedText(`Tiempo original: ${result.metadata.originalTime}`, {
        fontSize: 10.5,
        spacingAfter: 1.5,
      })
      addWrappedText(`Tiempo de lectura: ${result.metadata.readingTime}`, {
        fontSize: 10.5,
        spacingAfter: 1.5,
      })
      addWrappedText(`Tiempo ahorrado: ${result.metadata.savedTime}`, {
        fontSize: 10.5,
        spacingAfter: 4,
      })

      addWrappedText('Fases y Acciones', { fontSize: 12, fontStyle: 'bold', spacingAfter: 2 })
      result.phases.forEach((phase, phaseIndex) => {
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
      addWrappedText(result.proTip, { fontSize: 10.8, lineHeight: 5.4, spacingAfter: 0 })

      const safeDate = new Date().toISOString().slice(0, 10)
      const filename = `action-extractor-plan-${safeDate}.pdf`
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

      <main className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-6">
          <p className="text-sm font-semibold text-slate-800">Roi Action Extractor App</p>
          <div className="mt-2 flex items-center justify-center gap-4 text-sm">
            <Link className="text-indigo-600 hover:text-indigo-700" href="/privacy-policy">
              Política de Privacidad
            </Link>
            <Link className="text-indigo-600 hover:text-indigo-700" href="/terms-of-use">
              Términos de Uso
            </Link>
          </div>
        </div>

        {sessionLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Cargando sesión...</p>
          </div>
        ) : !user ? (
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
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xl font-extrabold text-slate-900">3m</p>
                        <p className="text-xs text-slate-500 mt-1">Lectura promedio</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xl font-extrabold text-slate-900">4</p>
                        <p className="text-xs text-slate-500 mt-1">Modos de extracción</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xl font-extrabold text-slate-900">1 click</p>
                        <p className="text-xs text-slate-500 mt-1">Export a apps</p>
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
                Usuario conectado: <span className="font-semibold text-slate-800">{user.name}</span>
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
                      className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                        isActive
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
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
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <p className="text-sm font-semibold leading-tight">{option.label}</p>
                      <p className="text-xs mt-1 leading-tight opacity-80">{option.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="max-w-4xl mx-auto mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-md shadow-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-slate-700">Conexiones de Exportación</h3>
                <p className="text-xs text-slate-500">
                  Cambia cuentas sin cerrar sesión de la plataforma.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Notion</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {notionConnected
                      ? `Conectado: ${notionWorkspaceName ?? 'Workspace activo'}`
                      : notionConfigured
                        ? 'Sin conexión'
                        : 'No configurado en servidor'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    {!notionConnected ? (
                      <button
                        type="button"
                        onClick={handleConnectNotion}
                        disabled={notionLoading || !notionConfigured}
                        className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
                      >
                        {notionLoading ? 'Conectando...' : 'Conectar'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDisconnectNotion}
                        disabled={notionDisconnectLoading}
                        className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
                      >
                        {notionDisconnectLoading ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Trello</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {trelloConnected
                      ? `Conectado: @${trelloUsername ?? 'usuario'}`
                      : trelloConfigured
                        ? 'Sin conexión'
                        : 'No configurado en servidor'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    {!trelloConnected ? (
                      <button
                        type="button"
                        onClick={handleConnectTrello}
                        disabled={trelloLoading || !trelloConfigured}
                        className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
                      >
                        {trelloLoading ? 'Conectando...' : 'Conectar'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDisconnectTrello}
                        disabled={trelloDisconnectLoading}
                        className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
                      >
                        {trelloDisconnectLoading ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Todoist</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {todoistConnected
                      ? `Conectado: ${todoistUserLabel ?? 'usuario activo'}`
                      : todoistConfigured
                        ? 'Sin conexión'
                        : 'No configurado en servidor'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    {!todoistConnected ? (
                      <button
                        type="button"
                        onClick={handleConnectTodoist}
                        disabled={todoistLoading || !todoistConfigured}
                        className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
                      >
                        {todoistLoading ? 'Conectando...' : 'Conectar'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDisconnectTodoist}
                        disabled={todoistDisconnectLoading}
                        className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
                      >
                        {todoistDisconnectLoading ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Google Docs</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {googleDocsConnected
                      ? `Conectado: ${googleDocsUserEmail ?? 'cuenta activa'}`
                      : googleDocsConfigured
                        ? 'Sin conexión'
                        : 'No configurado en servidor'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    {!googleDocsConnected ? (
                      <button
                        type="button"
                        onClick={handleConnectGoogleDocs}
                        disabled={googleDocsLoading || !googleDocsConfigured}
                        className="text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
                      >
                        {googleDocsLoading ? 'Conectando...' : 'Conectar'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDisconnectGoogleDocs}
                        disabled={googleDocsDisconnectLoading}
                        className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-md disabled:bg-slate-400 disabled:cursor-wait"
                      >
                        {googleDocsDisconnectLoading ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-xl shadow-indigo-100/50 border border-slate-200 flex flex-col md:flex-row gap-2 max-w-2xl mx-auto mb-8 transform transition-all hover:scale-[1.01]">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Play size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Pega aquí el link de YouTube..."
                  className="w-full h-12 pl-12 pr-4 rounded-xl border-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 bg-transparent placeholder:text-slate-400 outline-none"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && handleExtract()}
                />
              </div>
              <button
                onClick={handleExtract}
                disabled={isProcessing || !url.trim()}
                className={`h-12 px-8 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 ${
                  isProcessing || !url.trim()
                    ? 'bg-slate-400 cursor-wait'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    Extraer <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-md shadow-slate-100 mb-10 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <History size={16} />
                  Historial de Extracciones
                </div>
                <button
                  onClick={() => void loadHistory()}
                  disabled={historyLoading}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:text-slate-400"
                >
                  {historyLoading ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>

              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search size={15} />
                  </div>
                  <input
                    type="text"
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder="Buscar por título, objetivo, URL o fecha..."
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {history.length === 0 && !historyLoading && (
                <p className="px-5 py-6 text-sm text-slate-500">
                  Aún no tienes extracciones guardadas.
                </p>
              )}

              {history.length > 0 && filteredHistory.length === 0 && !historyLoading && (
                <p className="px-5 py-6 text-sm text-slate-500">
                  No hay resultados para tu búsqueda.
                </p>
              )}

              <div className="divide-y divide-slate-100">
                {filteredHistory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openHistoryItem(item)}
                    className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.videoTitle ?? 'Miniatura del video'}
                          className="w-24 h-14 rounded-md object-cover border border-slate-200 flex-shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-24 h-14 rounded-md bg-slate-200 border border-slate-200 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 line-clamp-1">
                          {item.videoTitle || item.objective || 'Video de YouTube'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 truncate">{item.url}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-xs text-slate-400">{formatHistoryDate(item.createdAt)}</p>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {getExtractionModeLabel(normalizeExtractionMode(item.mode))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {isProcessing && (
              <div className="max-w-2xl mx-auto mb-10 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-sm text-indigo-700 font-medium animate-pulse">
                  {streamStatus ?? 'Obteniendo transcripción y procesando con IA...'}
                </p>
                {streamPreview && (
                  <pre className="mt-3 text-xs text-slate-700 bg-white border border-indigo-100 rounded-lg p-3 max-h-56 overflow-auto whitespace-pre-wrap break-words">
                    {streamPreview}
                  </pre>
                )}
              </div>
            )}

            {notice && (
              <div className="max-w-2xl mx-auto mb-10 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm text-emerald-700">{notice}</p>
              </div>
            )}

            {error && (
              <div className="max-w-2xl mx-auto mb-10 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {!result && !isProcessing && !error && (
              <div className="grid md:grid-cols-3 gap-6 text-center opacity-60">
                <div className="p-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl mx-auto mb-4 flex items-center justify-center text-slate-500">
                    <Clock size={24} />
                  </div>
                  <h3 className="font-semibold text-slate-800">Ahorra Horas</h3>
                  <p className="text-sm text-slate-500">De 2 horas de video a 3 minutos de lectura.</p>
                </div>
                <div className="p-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl mx-auto mb-4 flex items-center justify-center text-slate-500">
                    <CheckSquare size={24} />
                  </div>
                  <h3 className="font-semibold text-slate-800">Acción Pura</h3>
                  <p className="text-sm text-slate-500">Sin relleno. Solo los pasos que generan ROI.</p>
                </div>
                <div className="p-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl mx-auto mb-4 flex items-center justify-center text-slate-500">
                    <Copy size={24} />
                  </div>
                  <h3 className="font-semibold text-slate-800">Exporta Fácil</h3>
                  <p className="text-sm text-slate-500">Exporta en un click a Notion, Trello, Todoist o Google Docs.</p>
                </div>
              </div>
            )}

            {result && (
              <div className="animate-fade-slide">
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-emerald-100">
                    <Clock size={16} /> Tiempo Ahorrado: {result.metadata.savedTime}
                  </div>
                  <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-orange-100">
                    <Brain size={16} /> Dificultad: {result.metadata.difficulty}
                  </div>
                  <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-indigo-100">
                    <Zap size={16} /> Modo:{' '}
                    {getExtractionModeLabel(normalizeExtractionMode(result.mode ?? extractionMode))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-white">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Video Fuente
                    </h2>
                    <div className="flex flex-col md:flex-row gap-4">
                      {result.thumbnailUrl ? (
                        <img
                          src={result.thumbnailUrl}
                          alt={result.videoTitle ?? 'Miniatura del video'}
                          className="w-full md:w-56 h-32 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-full md:w-56 h-32 rounded-xl bg-slate-100 border border-slate-200" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 text-base line-clamp-2">
                          {result.videoTitle || 'Video de YouTube'}
                        </p>
                        {(result.url || url) && (
                          <p className="text-xs text-slate-500 mt-2 break-all">
                            {result.url || url}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 border-b border-slate-100">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Objetivo del Resultado
                    </h2>
                    <p className="text-lg font-medium text-slate-800 leading-relaxed">
                      {result.objective}
                    </p>
                  </div>

                  <div className="p-6 space-y-4">
                    {result.phases.map((phase: Phase) => (
                      <div
                        key={phase.id}
                        className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:border-indigo-200 hover:shadow-sm group"
                      >
                        <button
                          onClick={() => togglePhase(phase.id)}
                          className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                                activePhase === phase.id
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                              }`}
                            >
                              {phase.id}
                            </div>
                            <span className="font-bold text-slate-800">{phase.title}</span>
                          </div>
                          {activePhase === phase.id ? (
                            <ChevronUp size={20} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={20} className="text-slate-400" />
                          )}
                        </button>

                        {activePhase === phase.id && (
                          <div className="p-4 pt-0 bg-slate-50/50 border-t border-slate-100">
                            <ul className="space-y-3 mt-4">
                              {phase.items.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3 group/item cursor-pointer">
                                  <div className="mt-0.5 relative flex-shrink-0">
                                    <input
                                      type="checkbox"
                                      className="peer w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer appearance-none border checked:bg-indigo-600 checked:border-indigo-600 transition-all"
                                    />
                                    <CheckCircle2
                                      size={12}
                                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                                      strokeWidth={3}
                                    />
                                  </div>
                                  <span className="text-slate-600 group-hover/item:text-slate-900 transition-colors leading-relaxed text-sm">
                                    {item}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mx-6 mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-4">
                    <div className="text-amber-500 flex-shrink-0 mt-1">
                      <Zap size={24} fill="currentColor" className="opacity-20" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-800 mb-1 text-sm">
                        Consejo Pro (Gold Nugget)
                      </h4>
                      <p className="text-sm text-amber-700 leading-relaxed italic">
                        &ldquo;{result.proTip}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap gap-3 justify-between items-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleDownloadPdf}
                        disabled={isExportingPdf}
                        className="text-slate-500 hover:text-indigo-600 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all disabled:text-slate-400 disabled:cursor-wait"
                      >
                        <Download size={16} /> {isExportingPdf ? 'Generando PDF...' : 'Guardar PDF'}
                      </button>
                      <button
                        onClick={handleCopyShareLink}
                        disabled={!result.id || shareLoading}
                        className="text-slate-500 hover:text-indigo-600 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all disabled:text-slate-400 disabled:cursor-wait"
                      >
                        <Share2 size={16} />{' '}
                        {shareLoading ? 'Generando link...' : shareCopied ? 'Link copiado' : 'Compartir'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {notionConnected && notionWorkspaceName && (
                        <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-white border border-slate-200">
                          Notion: {notionWorkspaceName}
                        </span>
                      )}
                      {trelloConnected && trelloUsername && (
                        <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-white border border-slate-200">
                          Trello: @{trelloUsername}
                        </span>
                      )}
                      {todoistConnected && todoistUserLabel && (
                        <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-white border border-slate-200">
                          Todoist: {todoistUserLabel}
                        </span>
                      )}
                      {googleDocsConnected && googleDocsUserEmail && (
                        <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-white border border-slate-200">
                          Google: {googleDocsUserEmail}
                        </span>
                      )}

                      {notionConnected ? (
                        <button
                          onClick={handleExportToNotion}
                          disabled={!result.id || notionExportLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md shadow-indigo-200 transition-all transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-wait disabled:shadow-none"
                        >
                          <Zap size={16} />{' '}
                          {notionExportLoading ? 'Exportando...' : 'Exportar a Notion'}
                        </button>
                      ) : (
                        <button
                          onClick={handleConnectNotion}
                          disabled={notionLoading || !notionConfigured}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-wait"
                        >
                          <Zap size={16} />{' '}
                          {notionLoading
                            ? 'Conectando...'
                            : notionConfigured
                              ? 'Conectar Notion'
                              : 'Notion no configurado'}
                        </button>
                      )}

                      {trelloConnected ? (
                        <button
                          onClick={handleExportToTrello}
                          disabled={!result.id || trelloExportLoading}
                          className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md shadow-sky-200 transition-all transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-wait disabled:shadow-none"
                        >
                          <Zap size={16} />{' '}
                          {trelloExportLoading ? 'Exportando...' : 'Exportar a Trello'}
                        </button>
                      ) : (
                        <button
                          onClick={handleConnectTrello}
                          disabled={trelloLoading || !trelloConfigured}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-wait"
                        >
                          <Zap size={16} />{' '}
                          {trelloLoading
                            ? 'Conectando...'
                            : trelloConfigured
                              ? 'Conectar Trello'
                              : 'Trello no configurado'}
                        </button>
                      )}

                      {todoistConnected ? (
                        <button
                          onClick={handleExportToTodoist}
                          disabled={!result.id || todoistExportLoading}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md shadow-rose-200 transition-all transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-wait disabled:shadow-none"
                        >
                          <Zap size={16} />{' '}
                          {todoistExportLoading ? 'Exportando...' : 'Exportar a Todoist'}
                        </button>
                      ) : (
                        <button
                          onClick={handleConnectTodoist}
                          disabled={todoistLoading || !todoistConfigured}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-wait"
                        >
                          <Zap size={16} />{' '}
                          {todoistLoading
                            ? 'Conectando...'
                            : todoistConfigured
                              ? 'Conectar Todoist'
                              : 'Todoist no configurado'}
                        </button>
                      )}

                      {googleDocsConnected ? (
                        <button
                          onClick={handleExportToGoogleDocs}
                          disabled={!result.id || googleDocsExportLoading}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md shadow-emerald-200 transition-all transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-wait disabled:shadow-none"
                        >
                          <Zap size={16} />{' '}
                          {googleDocsExportLoading ? 'Exportando...' : 'Exportar a Google Docs'}
                        </button>
                      ) : (
                        <button
                          onClick={handleConnectGoogleDocs}
                          disabled={googleDocsLoading || !googleDocsConfigured}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-wait"
                        >
                          <Zap size={16} />{' '}
                          {googleDocsLoading
                            ? 'Conectando...'
                            : googleDocsConfigured
                              ? 'Conectar Google Docs'
                              : 'Google Docs no configurado'}
                        </button>
                      )}

                      <button
                        onClick={handleCopyNotion}
                        className="text-slate-600 hover:text-indigo-600 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                      >
                        <Copy size={16} /> Copiar Markdown
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-12 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500 mb-2">Roi Action Extractor App</p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <Link className="text-indigo-600 hover:text-indigo-700" href="/privacy-policy">
              Política de Privacidad
            </Link>
            <Link className="text-indigo-600 hover:text-indigo-700" href="/terms-of-use">
              Términos de Uso
            </Link>
          </div>
        </div>
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
