'use client'

import { Suspense, useEffect, useState } from 'react'
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
  Play,
  Zap,
} from 'lucide-react'

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

interface ParsedSseEvent {
  event: string
  data: string
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
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [streamPreview, setStreamPreview] = useState('')

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

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (authLoading) return

    setAuthLoading(true)
    setAuthError(null)

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

      const data = await res.json()
      if (!res.ok) {
        setAuthError(data.error ?? 'No se pudo completar la operación.')
        return
      }

      setUser(data.user as SessionUser)
      setPassword('')
      setAuthError(null)
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
        setForgotError('Error al enviar el correo. Intenta de nuevo.')
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
      setActivePhase(null)
      setStreamStatus(null)
      setStreamPreview('')
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
    setResult(null)
    setStreamStatus('Iniciando extracción...')
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
          setResult(payload as ExtractResult)
          setActivePhase(null)
          setError(null)
          setStreamStatus(
            (payload as { cached?: unknown }).cached === true
              ? 'Resultado recuperado desde caché.'
              : 'Extracción completada.'
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
        body: JSON.stringify({ url }),
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
    setUrl(item.url)
    setResult({
      id: item.id,
      createdAt: item.createdAt,
      objective: item.objective,
      phases: item.phases,
      proTip: item.proTip,
      metadata: item.metadata,
    })
    setActivePhase(null)
    setError(null)
    setStreamStatus(null)
    setStreamPreview('')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
            <Zap size={20} fill="currentColor" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800">
            Action<span className="text-indigo-600">Extractor</span>
          </span>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-sm text-slate-600">
              {user.name} ({user.email})
            </span>
            <button
              onClick={handleLogout}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
        ) : (
          <span className="text-sm text-slate-500">Acceso requerido</span>
        )}
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        {sessionLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Cargando sesión...</p>
          </div>
        ) : !user ? (
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
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    Acceso Multiusuario
                  </h1>
                  <p className="text-slate-600 text-sm">
                    Crea tu cuenta para guardar tu historial de extracciones por usuario.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg shadow-slate-200/50">
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <button
                      onClick={() => setAuthMode('login')}
                      className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                        authMode === 'login'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Iniciar sesión
                    </button>
                    <button
                      onClick={() => setAuthMode('register')}
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
                        onClick={() => { setAuthMode('forgot'); setAuthError(null) }}
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
                    Extraer Plan <ArrowRight size={18} />
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

              {history.length === 0 && !historyLoading && (
                <p className="px-5 py-6 text-sm text-slate-500">
                  Aún no tienes extracciones guardadas.
                </p>
              )}

              <div className="divide-y divide-slate-100">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openHistoryItem(item)}
                    className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <p className="font-semibold text-slate-800 line-clamp-1">
                      {item.objective || 'Extracción sin objetivo'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{item.url}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatHistoryDate(item.createdAt)}</p>
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
                  <p className="text-sm text-slate-500">Llévalo a Notion con un click.</p>
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
                </div>

                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 p-6 border-b border-slate-100">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Objetivo Estratégico
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

                  <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
                    <button
                      onClick={handleDownloadPdf}
                      disabled={isExportingPdf}
                      className="text-slate-500 hover:text-indigo-600 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all disabled:text-slate-400 disabled:cursor-wait"
                    >
                      <Download size={16} /> {isExportingPdf ? 'Generando PDF...' : 'Guardar PDF'}
                    </button>
                    <button
                      onClick={handleCopyNotion}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 px-6 py-2.5 rounded-lg shadow-md shadow-indigo-200 transition-all transform hover:-translate-y-0.5"
                    >
                      <Copy size={16} /> Copiar a Notion
                    </button>
                  </div>
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      }
    >
      <ActionExtractor />
    </Suspense>
  )
}
