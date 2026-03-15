'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronLeft, MessageSquarePlus, RotateCcw, Send, Trash2, X } from 'lucide-react'
import { useLang } from '@/app/home/hooks/useLang'

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
  chatTokensExhausted?: boolean
  resetAt?: string
}

interface ChatTokenSnapshot {
  limit: number
  used: number
  remaining: number
  reset_at: string
  allowed: boolean
}

interface ChatHistoryApiResponse {
  messages?: unknown
  error?: unknown
}

interface ConversationsApiResponse {
  conversations?: unknown
  error?: unknown
}

interface CreateConversationApiResponse {
  conversation?: unknown
  error?: unknown
  created?: unknown
}

interface ConversationItem {
  id: string
  title: string
  contextType: string
  contextId: string | null
  updatedAt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  references?: ChatReference[]
}

export interface FocusedItemContext {
  path: string
  text: string
  phaseTitle: string
}

interface KnowledgeChatProps {
  activeExtractionId: string | null
  focusedItemContext?: FocusedItemContext | null
  onClearFocusedItem?: () => void
}

const CHAT_COPY = {
  en: {
    assistantName: 'Content Assistant',
    assistantAlt: 'AI Assistant',
    welcome:
      'I am your content assistant. I can answer questions about your extractions and what you have built from them.',
    untitledConversation: 'Untitled',
    itemQuestionTitle: 'Item question',
    loadHistoryError: 'Could not load the assistant history.',
    createConversationError: 'Could not create the conversation.',
    answerQuestionError: 'Could not answer the question.',
    noClearAnswer: 'I could not find a clear answer with the current context.',
    clearHistoryError: 'Could not clear the assistant history.',
    activeExtraction: 'Active extraction',
    allExtractions: 'All my extractions',
    newConversation: 'New conversation',
    itemFocusIntro: (path: string, text: string) =>
      `I am ready to help with item **${path}**:\n\n_"${text}"_\n\nWhat do you need to know about this point?`,
    openAssistant: 'Open content assistant',
    myConversations: 'My conversations',
    viewConversations: 'View conversations',
    conversations: 'Conversations',
    clearChatHistory: 'Clear chat history',
    clearHistory: 'Clear history',
    backToChat: 'Back to chat',
    closeChat: 'Close chat',
    noConversations: 'No conversations yet.',
    loading: 'Loading...',
    deleteConversation: (title: string) => `Delete conversation: ${title}`,
    delete: 'Delete',
    all: 'All',
    active: 'Active',
    stopFocusing: 'Stop focusing this item',
    removeFocus: 'Remove focus',
    loadingHistory: 'Loading history...',
    thinking: 'Thinking...',
    tokenLimitReached: 'Daily token limit reached. Come back tomorrow to continue.',
    limitReachedPlaceholder: 'Daily limit reached',
    questionPlaceholder: 'Ask about your extractions...',
    send: 'Send',
    chatTokensToday: 'chat tokens today',
    rightNow: 'Just now',
    minutesAgo: (count: number) => `${count} min ago`,
    hoursAgo: (count: number) => `${count}h ago`,
    yesterday: 'Yesterday',
    daysAgo: (count: number) => `${count} days ago`,
  },
  es: {
    assistantName: 'Asistente de Contenidos',
    assistantAlt: 'Asistente IA',
    welcome:
      'Soy tu asistente de contenidos. Puedo responder preguntas sobre tus extracciones y lo que has trabajado en ellas.',
    untitledConversation: 'Sin título',
    itemQuestionTitle: 'Consulta de ítem',
    loadHistoryError: 'No se pudo cargar el historial del asistente.',
    createConversationError: 'No se pudo crear la conversación.',
    answerQuestionError: 'No se pudo responder la pregunta.',
    noClearAnswer: 'No encontré una respuesta clara con el contexto actual.',
    clearHistoryError: 'No se pudo limpiar el historial del asistente.',
    activeExtraction: 'Extracción activa',
    allExtractions: 'Todas mis extracciones',
    newConversation: 'Nueva conversación',
    itemFocusIntro: (path: string, text: string) =>
      `Estoy listo para ayudarte con el ítem **${path}**:\n\n_"${text}"_\n\n¿Qué necesitas saber sobre este punto?`,
    openAssistant: 'Abrir asistente de contenidos',
    myConversations: 'Mis conversaciones',
    viewConversations: 'Ver conversaciones',
    conversations: 'Conversaciones',
    clearChatHistory: 'Limpiar historial del chat',
    clearHistory: 'Limpiar historial',
    backToChat: 'Volver al chat',
    closeChat: 'Cerrar chat',
    noConversations: 'No hay conversaciones aún.',
    loading: 'Cargando...',
    deleteConversation: (title: string) => `Eliminar conversación: ${title}`,
    delete: 'Eliminar',
    all: 'Todas',
    active: 'Activa',
    stopFocusing: 'Dejar de enfocar este ítem',
    removeFocus: 'Quitar enfoque',
    loadingHistory: 'Cargando historial...',
    thinking: 'Pensando...',
    tokenLimitReached: 'Límite diario de tokens alcanzado. Vuelve mañana para continuar.',
    limitReachedPlaceholder: 'Límite diario alcanzado',
    questionPlaceholder: 'Pregunta sobre tus extracciones...',
    send: 'Enviar',
    chatTokensToday: 'tokens chat hoy',
    rightNow: 'Ahora mismo',
    minutesAgo: (count: number) => `Hace ${count} min`,
    hoursAgo: (count: number) => `Hace ${count}h`,
    yesterday: 'Ayer',
    daysAgo: (count: number) => `Hace ${count} días`,
  },
} as const

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildWelcomeMessage(lang: 'en' | 'es'): ChatMessage {
  return {
    id: createMessageId(),
    role: 'assistant',
    content: CHAT_COPY[lang].welcome,
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

function normalizeConversations(payload: unknown, lang: 'en' | 'es'): ConversationItem[] {
  if (!Array.isArray(payload)) return []
  return payload
    .map((entry): ConversationItem | null => {
      if (!entry || typeof entry !== 'object') return null
      const id = typeof (entry as { id?: unknown }).id === 'string' ? (entry as { id: string }).id.trim() : ''
      if (!id) return null
      const title =
        typeof (entry as { title?: unknown }).title === 'string'
          ? (entry as { title: string }).title.trim() || CHAT_COPY[lang].untitledConversation
          : CHAT_COPY[lang].untitledConversation
      return {
        id,
        title,
        contextType: typeof (entry as { contextType?: unknown }).contextType === 'string'
          ? (entry as { contextType: string }).contextType
          : 'global',
        contextId:
          typeof (entry as { contextId?: unknown }).contextId === 'string'
            ? (entry as { contextId: string }).contextId.trim() || null
            : null,
        updatedAt: typeof (entry as { updatedAt?: unknown }).updatedAt === 'string'
          ? (entry as { updatedAt: string }).updatedAt
          : '',
      }
    })
    .filter((entry): entry is ConversationItem => Boolean(entry))
}

function formatRelativeDate(isoDate: string, lang: 'en' | 'es') {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 2) return CHAT_COPY[lang].rightNow
  if (diffMins < 60) return CHAT_COPY[lang].minutesAgo(diffMins)
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return CHAT_COPY[lang].hoursAgo(diffHours)
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return CHAT_COPY[lang].yesterday
  if (diffDays < 7) return CHAT_COPY[lang].daysAgo(diffDays)
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { month: 'short', day: 'numeric' })
}

function normalizeFocusedItemContextSegment(value: string | null | undefined, maxLength: number) {
  return (value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, maxLength)
}

function buildFocusedItemConversationContext(
  activeExtractionId: string | null,
  focusedItemContext: FocusedItemContext,
  lang: 'en' | 'es',
) {
  const titleBase = focusedItemContext.path
    ? `${focusedItemContext.path} - ${focusedItemContext.text}`
    : focusedItemContext.text
  const title = titleBase.slice(0, 80).trim() || CHAT_COPY[lang].itemQuestionTitle
  const contextId = JSON.stringify({
    extractionId: normalizeFocusedItemContextSegment(activeExtractionId, 120),
    phaseTitle: normalizeFocusedItemContextSegment(focusedItemContext.phaseTitle, 160),
    path: normalizeFocusedItemContextSegment(focusedItemContext.path, 80),
    text: normalizeFocusedItemContextSegment(focusedItemContext.text, 400),
  })

  return {
    title,
    contextType: 'playbook_item',
    contextId,
  }
}

export function KnowledgeChat({ activeExtractionId, focusedItemContext, onClearFocusedItem }: KnowledgeChatProps) {
  const { lang } = useLang()
  const ui = CHAT_COPY[lang]
  const [isOpen, setIsOpen] = useState(false)
  const [showConversations, setShowConversations] = useState(false)
  const [scope, setScope] = useState<'active' | 'all'>(activeExtractionId ? 'active' : 'all')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [clearingHistory, setClearingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Multi-conversation state
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [conversationsLoaded, setConversationsLoaded] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeConversationTitle, setActiveConversationTitle] = useState<string>(ui.assistantName)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const activeConversationIdRef = useRef<string | null>(null)
  const creatingConversationRef = useRef(false)

  // Chat token quota state
  const [chatTokens, setChatTokens] = useState<ChatTokenSnapshot | null>(null)
  const [tokensExhausted, setTokensExhausted] = useState(false)

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  useEffect(() => {
    if (!activeConversationId) {
      setActiveConversationTitle(ui.assistantName)
    }
  }, [activeConversationId, ui.assistantName])

  const fetchChatTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/account/chat-tokens', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as ChatTokenSnapshot
      setChatTokens(data)
      setTokensExhausted(!data.allowed)
    } catch {
      // non-blocking
    }
  }, [])

  // Load conversation list
  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/conversations', { cache: 'no-store' })
      const payload = (await response.json().catch(() => ({}))) as ConversationsApiResponse
      if (!response.ok) return
      const list = normalizeConversations(payload.conversations, lang)
      setConversations(list)
      setConversationsLoaded(true)
      return list
    } catch {
      setConversationsLoaded(true)
      return [] as ConversationItem[]
    }
  }, [])

  // Load messages for the active conversation
  const loadPersistedHistory = useCallback(
    async (conversationId: string | null) => {
      if (historyLoading) return

      setHistoryLoading(true)
      setError(null)

      try {
        const url = conversationId
          ? `/api/chat/history?conversationId=${encodeURIComponent(conversationId)}`
          : '/api/chat/history'
        const response = await fetch(url, { method: 'GET', cache: 'no-store' })
        const payload = (await response.json().catch(() => ({}))) as ChatHistoryApiResponse
        if (!response.ok) {
          setMessages((previous) => (previous.length > 0 ? previous : [buildWelcomeMessage(lang)]))
          setError(resolveErrorMessage(payload, ui.loadHistoryError))
          setHistoryLoaded(true)
          return
        }

        const restoredMessages = normalizeHistoryMessages(payload.messages)
        setMessages(restoredMessages.length > 0 ? restoredMessages : [buildWelcomeMessage(lang)])
        setHistoryLoaded(true)
      } catch {
        setMessages((previous) => (previous.length > 0 ? previous : [buildWelcomeMessage(lang)]))
        setError(ui.loadHistoryError)
        setHistoryLoaded(true)
      } finally {
        setHistoryLoading(false)
      }
    },
    [historyLoading, lang, ui.loadHistoryError]
  )

  useEffect(() => {
    if (activeExtractionId) return
    setScope('all')
  }, [activeExtractionId])

  // On open: load conversations, then messages for the most recent one
  useEffect(() => {
    if (!isOpen) return
    if (conversationsLoaded) return

    void loadConversations().then((list) => {
      if (!list || list.length === 0) return
      if (activeConversationIdRef.current) return
      const first = list[0]
      setActiveConversationId(first.id)
      setActiveConversationTitle(first.title)
    })
  }, [isOpen, conversationsLoaded, loadConversations])

  // Fetch token quota on open
  useEffect(() => {
    if (!isOpen) return
    void fetchChatTokens()
  }, [isOpen, fetchChatTokens])

  useEffect(() => {
    if (!isOpen) return
    if (historyLoaded) return
    if (!conversationsLoaded) return
    void loadPersistedHistory(activeConversationId)
  }, [historyLoaded, isOpen, loadPersistedHistory, conversationsLoaded, activeConversationId])

  // Auto scroll on message change
  useEffect(() => {
    if (!isOpen) return
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [isOpen, messages, loading, historyLoading, clearingHistory])

  const canSend = input.trim().length > 0 && !loading && !historyLoading && !clearingHistory && !tokensExhausted
  const scopeLabel = useMemo(() => {
    if (scope === 'active' && activeExtractionId) return ui.activeExtraction
    return ui.allExtractions
  }, [scope, activeExtractionId, ui.activeExtraction, ui.allExtractions])

  const switchConversation = useCallback((conv: ConversationItem) => {
    setActiveConversationId(conv.id)
    setActiveConversationTitle(conv.title)
    setShowConversations(false)
    setHistoryLoaded(false)
    setMessages([])
    setError(null)
  }, [])

  const createNewConversation = useCallback(async (input?: {
    title?: string
    contextType?: string
    contextId?: string
  }) => {
    if (creatingConversationRef.current) return null
    creatingConversationRef.current = true
    setCreatingConversation(true)
    setError(null)

    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input?.title || ui.newConversation,
          contextType: input?.contextType,
          contextId: input?.contextId,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as CreateConversationApiResponse
      if (!response.ok) {
        setError(resolveErrorMessage(payload, ui.createConversationError))
        return null
      }
      const convRaw = payload.conversation
      if (!convRaw || typeof convRaw !== 'object') return null
      const newConv: ConversationItem = {
        id: typeof (convRaw as { id?: unknown }).id === 'string' ? (convRaw as { id: string }).id : '',
        title: typeof (convRaw as { title?: unknown }).title === 'string' ? (convRaw as { title: string }).title : ui.newConversation,
        contextType:
          typeof (convRaw as { contextType?: unknown }).contextType === 'string'
            ? (convRaw as { contextType: string }).contextType
            : 'global',
        contextId:
          typeof (convRaw as { contextId?: unknown }).contextId === 'string'
            ? (convRaw as { contextId: string }).contextId.trim() || null
            : null,
        updatedAt: typeof (convRaw as { updatedAt?: unknown }).updatedAt === 'string' ? (convRaw as { updatedAt: string }).updatedAt : new Date().toISOString(),
      }
      if (!newConv.id) return null
      const created = payload.created !== false
      setConversations((prev) => [newConv, ...prev.filter((conversation) => conversation.id !== newConv.id)])
      return { conversation: newConv, created }
    } catch {
      setError(ui.createConversationError)
      return null
    } finally {
      creatingConversationRef.current = false
      setCreatingConversation(false)
    }
  }, [ui.createConversationError, ui.newConversation])

  // Auto-open the same conversation for a specific item if it already exists.
  useEffect(() => {
    if (!focusedItemContext) return

    setIsOpen(true)
    if (activeExtractionId) setScope('active')
    setShowConversations(false)

    const conversationContext = buildFocusedItemConversationContext(
      activeExtractionId,
      focusedItemContext,
      lang
    )

    void createNewConversation(conversationContext).then((result) => {
      if (!result) return

      if (!result.created) {
        switchConversation(result.conversation)
        return
      }

      switchConversation(result.conversation)
      setMessages([{
        id: createMessageId(),
        role: 'assistant',
        content: ui.itemFocusIntro(focusedItemContext.path, focusedItemContext.text),
      }])
      setHistoryLoaded(true)
    })
  }, [focusedItemContext, activeExtractionId, createNewConversation, switchConversation, lang, ui])

    const deleteConversation = useCallback(
    async (conv: ConversationItem) => {
      if (deletingConversationId) return
      setDeletingConversationId(conv.id)

      try {
        const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conv.id)}`, {
          method: 'DELETE',
        })
        if (!response.ok) return

        const remaining = conversations.filter((c) => c.id !== conv.id)
        setConversations(remaining)

        // If we deleted the active conversation, switch to the next one or create new
        if (activeConversationId === conv.id) {
          if (remaining.length > 0) {
            switchConversation(remaining[0])
          } else {
            setActiveConversationId(null)
            setActiveConversationTitle(ui.assistantName)
            setShowConversations(false)
            setHistoryLoaded(false)
            setMessages([])
          }
        }
      } catch {
        // ignore
      } finally {
        setDeletingConversationId(null)
      }
    },
    [deletingConversationId, conversations, activeConversationId, switchConversation, ui.assistantName]
  )

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          activeExtractionId: scope === 'active' ? activeExtractionId : null,
          conversationId: activeConversationId || undefined,
          focusedItemContext: focusedItemContext || undefined,
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as ChatApiResponse
      if (!response.ok) {
        if (payload.chatTokensExhausted) {
          setTokensExhausted(true)
          if (chatTokens) {
            setChatTokens((prev) => prev ? { ...prev, remaining: 0, allowed: false } : prev)
          }
        }
        setError(resolveErrorMessage(payload, ui.answerQuestionError))
        return
      }

      const answer =
        typeof payload.answer === 'string' && payload.answer.trim().length > 0
          ? payload.answer.trim()
          : ui.noClearAnswer
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

      // Re-fetch token quota after successful response
      void fetchChatTokens()

      // Refresh conversations list to update updatedAt
      void loadConversations().then((list) => {
        if (list) setConversations(list)
      })
    } catch {
      setError(ui.answerQuestionError)
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = async () => {
    if (clearingHistory || historyLoading) return
    setClearingHistory(true)
    setError(null)

    try {
      const url = activeConversationId
        ? `/api/chat/history?conversationId=${encodeURIComponent(activeConversationId)}`
        : '/api/chat/history'
      const response = await fetch(url, { method: 'DELETE' })
      const payload = (await response.json().catch(() => ({}))) as ChatHistoryApiResponse
      if (!response.ok) {
        setError(resolveErrorMessage(payload, ui.clearHistoryError))
        return
      }

      setMessages([buildWelcomeMessage(lang)])
      setHistoryLoaded(true)
      setInput('')
    } catch {
      setError(ui.clearHistoryError)
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
          className="group fixed bottom-24 right-4 z-40 rounded-full transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] lg:right-20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 dark:focus-visible:ring-indigo-900/50"
          aria-label={ui.openAssistant}
        >
          <span aria-hidden="true" className="chat-avatar-halo absolute inset-1 rounded-full bg-indigo-500/25 blur-md" />
          <span className="chat-avatar-float relative block">
            <span className="chat-avatar-inline inline-block">
              <img
                src="/notes-aide-bot.png"
                alt={ui.assistantAlt}
                className="h-16 w-16 rounded-full border-2 border-indigo-400/70 object-cover shadow-[0_24px_54px_-20px_rgba(79,70,229,0.95)] md:h-[4.5rem] md:w-[4.5rem]"
              />
            </span>
          </span>
        </button>
      )}

      {isOpen && (
        <section className="fixed inset-x-3 bottom-3 z-50 max-h-[78vh] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:inset-x-auto md:bottom-6 md:right-6 md:w-[420px]">
          {/* Header */}
          <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="min-w-0 flex-1">
              {showConversations ? (
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {ui.myConversations}
                </p>
              ) : (
                <>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="chat-avatar-inline inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100/80 ring-1 ring-indigo-200/80 dark:bg-indigo-500/10 dark:ring-indigo-400/20">
                      <img src="/notes-aide-bot.png" alt={ui.assistantName} className="h-7 w-7 rounded-full object-cover" />
                    </span>
                    <span className="truncate max-w-[160px]" title={activeConversationTitle}>
                      {activeConversationTitle}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{scopeLabel}</p>
                </>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5">
              {showConversations ? (
                <button
                  type="button"
                  onClick={() => {
                    void createNewConversation().then((result) => {
                      if (!result) return
                      switchConversation(result.conversation)
                    })
                  }}
                  disabled={creatingConversation}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  title={ui.newConversation}
                >
                  <MessageSquarePlus size={13} />
                  <span className="hidden sm:inline">{ui.newConversation}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowConversations(true)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label={ui.viewConversations}
                    title={ui.conversations}
                  >
                    <MessageSquarePlus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void clearHistory()}
                    disabled={clearingHistory || historyLoading || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label={ui.clearChatHistory}
                    title={ui.clearHistory}
                  >
                    <RotateCcw size={14} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  if (showConversations) {
                    setShowConversations(false)
                  } else {
                    setIsOpen(false)
                    onClearFocusedItem?.()
                  }
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label={showConversations ? ui.backToChat : ui.closeChat}
              >
                {showConversations ? <ChevronLeft size={14} /> : <X size={14} />}
              </button>
            </div>
          </header>

          {/* Conversations list view */}
          {showConversations && (
            <div className="max-h-[56vh] overflow-y-auto">
              {conversations.length === 0 && conversationsLoaded && (
                <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  {ui.noConversations}
                </div>
              )}
              {!conversationsLoaded && (
                <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-slate-500">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500" />
                  {ui.loading}
                </div>
              )}
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {conversations.map((conv) => (
                  <li key={conv.id} className="group flex items-center gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => switchConversation(conv)}
                      className={`flex-1 text-left ${
                        conv.id === activeConversationId
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <p className="truncate text-sm font-medium leading-tight">{conv.title}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                        {formatRelativeDate(conv.updatedAt, lang)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteConversation(conv)}
                      disabled={deletingConversationId === conv.id}
                      className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-all hover:text-rose-500 disabled:opacity-50 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-rose-400"
                      aria-label={ui.deleteConversation(conv.title)}
                      title={ui.delete}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Chat view */}
          {!showConversations && (
            <>
              {/* Scope selector */}
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
                    {ui.all}
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
                    {ui.active}
                  </button>
                </div>
              </div>

              {/* Focused item indicator */}
              {focusedItemContext && (
                <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50/60 px-4 py-2 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                  <img src="/notes-aide-bot.png" alt="" className="h-5 w-5 rounded-full object-cover flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                      {focusedItemContext.path}
                    </p>
                    <p className="truncate text-[10px] text-indigo-500 dark:text-indigo-400">
                      {focusedItemContext.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClearFocusedItem?.()}
                    className="flex-shrink-0 rounded p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300"
                    aria-label={ui.stopFocusing}
                    title={ui.removeFocus}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Messages */}
              <div ref={scrollContainerRef} className="max-h-[44vh] space-y-3 overflow-y-auto px-4 py-3">
                {historyLoading && messages.length === 0 && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-600 dark:border-t-indigo-400" />
                    {ui.loadingHistory}
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
                    {ui.thinking}
                  </div>
                )}
              </div>

              {/* Footer */}
              <footer className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                {tokensExhausted && (
                  <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    {ui.tokenLimitReached}
                  </p>
                )}
                {!tokensExhausted && error && (
                  <p className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                    {error}
                  </p>
                )}
                {tokensExhausted && error && !error.includes('límite') && (
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
                    disabled={tokensExhausted}
                    placeholder={tokensExhausted ? ui.limitReachedPlaceholder : ui.questionPlaceholder}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/40 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => void submitQuestion()}
                    disabled={!canSend}
                    className="inline-flex h-11 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    <Send size={13} />
                    {historyLoading ? ui.loading : ui.send}
                  </button>
                </div>

                {chatTokens && (
                  <p className={`mt-1.5 text-[10px] tabular-nums ${
                    tokensExhausted
                      ? 'text-amber-600 dark:text-amber-400'
                      : chatTokens.remaining < chatTokens.limit * 0.1
                        ? 'text-rose-500 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {tokensExhausted ? '0' : chatTokens.remaining.toLocaleString(lang === 'en' ? 'en-US' : 'es-MX')} / {chatTokens.limit.toLocaleString(lang === 'en' ? 'en-US' : 'es-MX')} {ui.chatTokensToday}
                  </p>
                )}
              </footer>
            </>
          )}
        </section>
      )}
    </>
  )
}
