'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Bot, MessageCircle, RotateCcw, Send, X } from 'lucide-react'

interface ChatReference {
  id: string
  orderNumber: number | null
  videoTitle: string | null
  mode: string
  createdAt: string
}

interface ChatApiResponse {
  answer?: unknown
  references?: unknown
  error?: unknown
}

interface ChatHistoryApiResponse {
  messages?: unknown
  error?: unknown
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  references?: ChatReference[]
}

interface KnowledgeChatProps {
  activeExtractionId: string | null
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildWelcomeMessage(): ChatMessage {
  return {
    id: createMessageId(),
    role: 'assistant',
    content:
      'Soy tu asistente de contenidos. Puedo responder preguntas sobre tus extracciones y lo que has trabajado en ellas.',
  }
}

function resolveErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as { error?: unknown }).error
  if (typeof error !== 'string') return fallback
  const trimmed = error.trim()
  return trimmed || fallback
}

function normalizeReferences(payload: unknown): ChatReference[] {
  if (!Array.isArray(payload)) return []
  return payload
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const id = typeof (entry as { id?: unknown }).id === 'string' ? (entry as { id: string }).id.trim() : ''
      if (!id) return null

      const orderNumberRaw = (entry as { orderNumber?: unknown }).orderNumber
      const orderNumber =
        typeof orderNumberRaw === 'number' && Number.isFinite(orderNumberRaw)
          ? Math.trunc(orderNumberRaw)
          : null

      return {
        id,
        orderNumber,
        videoTitle:
          typeof (entry as { videoTitle?: unknown }).videoTitle === 'string'
            ? (entry as { videoTitle: string }).videoTitle.trim() || null
            : null,
        mode:
          typeof (entry as { mode?: unknown }).mode === 'string'
            ? (entry as { mode: string }).mode.trim() || 'N/A'
            : 'N/A',
        createdAt:
          typeof (entry as { createdAt?: unknown }).createdAt === 'string'
            ? (entry as { createdAt: string }).createdAt
            : '',
      } satisfies ChatReference
    })
    .filter((entry): entry is ChatReference => Boolean(entry))
}

function normalizeChatRole(value: unknown): 'user' | 'assistant' {
  return value === 'assistant' ? 'assistant' : 'user'
}

function normalizeHistoryMessages(payload: unknown): ChatMessage[] {
  if (!Array.isArray(payload)) return []
  return payload
    .map((entry): ChatMessage | null => {
      if (!entry || typeof entry !== 'object') return null
      const contentRaw = (entry as { content?: unknown }).content
      const content = typeof contentRaw === 'string' ? contentRaw.trim() : ''
      if (!content) return null

      const idRaw = (entry as { id?: unknown }).id
      const id = typeof idRaw === 'string' && idRaw.trim().length > 0 ? idRaw : createMessageId()
      const references = normalizeReferences((entry as { references?: unknown }).references)

      return {
        id,
        role: normalizeChatRole((entry as { role?: unknown }).role),
        content,
        references: references.length > 0 ? references : undefined,
      }
    })
    .filter((entry): entry is ChatMessage => Boolean(entry))
}

export function KnowledgeChat({ activeExtractionId }: KnowledgeChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scope, setScope] = useState<'active' | 'all'>(activeExtractionId ? 'active' : 'all')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  const loadPersistedHistory = useCallback(async () => {
    if (historyLoading) return

    setHistoryLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat/history', {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => ({}))) as ChatHistoryApiResponse
      if (!response.ok) {
        setMessages((previous) => (previous.length > 0 ? previous : [buildWelcomeMessage()]))
        setError(resolveErrorMessage(payload, 'No se pudo cargar el historial del asistente.'))
        setHistoryLoaded(true)
        return
      }

      const restoredMessages = normalizeHistoryMessages(payload.messages)
      setMessages(restoredMessages.length > 0 ? restoredMessages : [buildWelcomeMessage()])
      setHistoryLoaded(true)
    } catch {
      setMessages((previous) => (previous.length > 0 ? previous : [buildWelcomeMessage()]))
      setError('No se pudo cargar el historial del asistente.')
      setHistoryLoaded(true)
    } finally {
      setHistoryLoading(false)
    }
  }, [historyLoading])

  useEffect(() => {
    if (activeExtractionId) return
    setScope('all')
  }, [activeExtractionId])

  useEffect(() => {
    if (!isOpen) return
    if (historyLoaded) return
    void loadPersistedHistory()
  }, [historyLoaded, isOpen, loadPersistedHistory])

  useEffect(() => {
    if (!isOpen) return
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [isOpen, messages, loading, historyLoading, clearingHistory])

  const canSend = input.trim().length > 0 && !loading && !historyLoading && !clearingHistory
  const scopeLabel = useMemo(() => {
    if (scope === 'active' && activeExtractionId) return 'Extracción activa'
    return 'Todas mis extracciones'
  }, [scope, activeExtractionId])

  const submitQuestion = async () => {
    const question = input.trim()
    if (!question || loading) return

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: question,
    }

    setMessages((previous) => [...previous, userMessage])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          activeExtractionId: scope === 'active' ? activeExtractionId : null,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as ChatApiResponse
      if (!response.ok) {
        setError(resolveErrorMessage(payload, 'No se pudo responder la pregunta.'))
        return
      }

      const answer =
        typeof payload.answer === 'string' && payload.answer.trim().length > 0
          ? payload.answer.trim()
          : 'No encontré una respuesta clara con el contexto actual.'
      const references = normalizeReferences(payload.references)

      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: 'assistant',
          content: answer,
          references,
        },
      ])
    } catch {
      setError('No se pudo responder la pregunta.')
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = async () => {
    if (clearingHistory || historyLoading) return
    setClearingHistory(true)
    setError(null)

    try {
      const response = await fetch('/api/chat/history', {
        method: 'DELETE',
      })
      const payload = (await response.json().catch(() => ({}))) as ChatHistoryApiResponse
      if (!response.ok) {
        setError(resolveErrorMessage(payload, 'No se pudo limpiar el historial del asistente.'))
        return
      }

      setMessages([buildWelcomeMessage()])
      setHistoryLoaded(true)
      setInput('')
    } catch {
      setError('No se pudo limpiar el historial del asistente.')
    } finally {
      setClearingHistory(false)
    }
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    void submitQuestion()
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-indigo-300/80 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_20px_42px_-18px_rgba(79,70,229,0.85)] transition-all hover:-translate-y-0.5 hover:from-indigo-500 hover:to-violet-500 md:right-6"
          aria-label="Abrir asistente de contenidos"
        >
          <MessageCircle size={16} />
          <span className="hidden sm:inline">Asistente IA</span>
          <span className="sm:hidden">Chat</span>
        </button>
      )}

      {isOpen && (
        <section className="fixed inset-x-3 bottom-3 z-50 max-h-[78vh] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:inset-x-auto md:bottom-6 md:right-6 md:w-[420px]">
          <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <Bot size={15} />
                Asistente de Contenidos
              </p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{scopeLabel}</p>
            </div>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void clearHistory()}
                disabled={clearingHistory || historyLoading || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Limpiar historial del chat"
                title="Limpiar historial"
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Cerrar chat"
              >
                <X size={14} />
              </button>
            </div>
          </header>

          <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-700">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  scope === 'all'
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                disabled={!activeExtractionId}
                onClick={() => activeExtractionId && setScope('active')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  scope === 'active'
                    ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                Activa
              </button>
            </div>
          </div>

          <div ref={scrollContainerRef} className="max-h-[44vh] space-y-3 overflow-y-auto px-4 py-3">
            {historyLoading && messages.length === 0 && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-600 dark:border-t-indigo-400" />
                Cargando historial...
              </div>
            )}

            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === 'assistant' && message.references && message.references.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.references.map((reference) => (
                      <span
                        key={`${message.id}-${reference.id}`}
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                        title={reference.videoTitle || reference.id}
                      >
                        {reference.orderNumber ? `#${reference.orderNumber}` : 'ID'} · {reference.mode}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}

            {loading && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-600 dark:border-t-indigo-400" />
                Pensando...
              </div>
            )}
          </div>

          <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            {error && (
              <p className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                {error}
              </p>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={2}
                maxLength={2000}
                placeholder="Pregunta sobre tus extracciones..."
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40"
              />
              <button
                type="button"
                onClick={() => void submitQuestion()}
                disabled={!canSend}
                className="inline-flex h-11 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <Send size={13} />
                {historyLoading ? 'Cargando...' : 'Enviar'}
              </button>
            </div>
          </footer>
        </section>
      )}
    </>
  )
}
