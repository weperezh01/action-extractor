'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowUp,
  Brain,
  History,
  LayoutList,
  LogOut,
  Moon,
  Newspaper,
  Settings2,
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
import { CommunityPanel } from '@/app/home/components/CommunityPanel'
import { GoogleIcon } from '@/app/home/components/GoogleIcon'
import { ExtractionFeedCard } from '@/app/home/components/ExtractionFeedCard'
import { HistoryPanel } from '@/app/home/components/HistoryPanel'
import { KnowledgeChat } from '@/app/home/components/KnowledgeChat'
import { ResultPanel } from '@/app/home/components/ResultPanel'
import { PlaybookSideTabs } from '@/app/home/components/PlaybookSideTabs'
import { WorkspaceControlsDock } from '@/app/home/components/WorkspaceControlsDock'
import { FolderDock } from '@/app/home/components/FolderDock'
import { useFolders } from '@/app/home/hooks/useFolders'
import { useAuth } from '@/app/home/hooks/useAuth'
import { useHistory } from '@/app/home/hooks/useHistory'
import { useIntegrations } from '@/app/home/hooks/useIntegrations'
import {
  applyTheme,
  getThemeStorageKey,
  parseSseFrame,
  resolveInitialTheme,
} from '@/app/home/lib/utils'
import {
  getShareVisibilityChangeNotice,
  isShareVisibilityShareable,
  normalizeShareVisibility,
} from '@/app/home/lib/share-visibility'
import type {
  ExtractResult,
  ExtractionAccessRole,
  ExtractionMember,
  HistoryItem,
  Phase,
  ShareVisibility,
  SharedExtractionItem,
  SourceType,
  Theme,
} from '@/app/home/lib/types'
import type { UploadedFileState } from '@/app/home/components/ExtractionForm'
import { detectSourceType } from '@/lib/source-detector'

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

function normalizePersistedPhases(payload: unknown, fallback: Phase[]): Phase[] {
  if (!Array.isArray(payload)) return fallback

  const normalized = payload
    .map((phase, index) => {
      if (!phase || typeof phase !== 'object') return null

      const rawTitle = (phase as { title?: unknown }).title
      const rawItems = (phase as { items?: unknown }).items
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
      const items = Array.isArray(rawItems)
        ? rawItems.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
        : []

      if (!title || items.length === 0) return null

      return {
        id: index + 1,
        title,
        items,
      }
    })
    .filter((phase): phase is Phase => Boolean(phase))

  return normalized.length > 0 ? normalized : fallback
}

function parseStreamPreview(raw: string): {
  objective: string | null
  phases: Array<{ title: string; items: string[] }>
} {
  if (!raw) return { objective: null, phases: [] }

  // Extract objective (complete string only)
  const objM = raw.match(/"objective"\s*:\s*"([^"]+)"/)
  const objective = objM ? objM[1].trim() || null : null

  // Extract phases section
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
  const [isResultBookClosed, setIsResultBookClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activePhase, setActivePhase] = useState<number | null>(null)
  const [uploadedFile, setUploadedFile] = useState<UploadedFileState | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareVisibilityLoading, setShareVisibilityLoading] = useState(false)
  const [historyShareLoadingItemId, setHistoryShareLoadingItemId] = useState<string | null>(null)
  const [historyShareCopiedItemId, setHistoryShareCopiedItemId] = useState<string | null>(null)
  const [sharedWithMe, setSharedWithMe] = useState<SharedExtractionItem[]>([])
  const [sharedWithMeLoading, setSharedWithMeLoading] = useState(false)
  const [resultAccessRole, setResultAccessRole] = useState<ExtractionAccessRole>('owner')
  const [circleMembers, setCircleMembers] = useState<ExtractionMember[]>([])
  const [circleMembersLoading, setCircleMembersLoading] = useState(false)
  const [circleMemberMutationLoading, setCircleMemberMutationLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [streamPreview, setStreamPreview] = useState('')
  const [shouldScrollToResult, setShouldScrollToResult] = useState(false)
  const [showBackToExtractorButton, setShowBackToExtractorButton] = useState(false)
  const [showGoToHistoryButton, setShowGoToHistoryButton] = useState(false)
  const [isManualFormOpen, setIsManualFormOpen] = useState(false)
  const [activeFolderIds, setActiveFolderIds] = useState<string[]>([])
  const { folders, loadFolders, resetFolders, createFolder, deleteFolder } = useFolders()
  const [historyView, setHistoryView] = useState<'list' | 'feed'>('list')
  const [theme, setTheme] = useState<Theme>('light')
  const [reauthRequired, setReauthRequired] = useState(false)
  const extractorSectionRef = useRef<HTMLElement | null>(null)
  const resultAnchorRef = useRef<HTMLDivElement | null>(null)
  const historyAnchorRef = useRef<HTMLDivElement | null>(null)
  const themeStorageKey = getThemeStorageKey()
  const trimmedUrl = url.trim()
  const detectedSourceType: SourceType = uploadedFile
    ? uploadedFile.sourceType
    : detectSourceType(trimmedUrl)

  // Only show URL error for malformed http(s) URLs that are neither YouTube nor a valid web URL format
  const urlError = (() => {
    if (uploadedFile) return null
    if (!trimmedUrl) return null
    // If it starts with http but doesn't look like a valid URL structure, flag it
    if (/^https?:\/\//i.test(trimmedUrl) && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmedUrl)) {
      return 'Ingresa una URL válida (ejemplo: https://youtube.com/watch?v=... o https://ejemplo.com).'
    }
    return null
  })()

  const {
    history,
    setHistory,
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

  const loadSharedWithMe = useCallback(async () => {
    setSharedWithMeLoading(true)
    try {
      const res = await fetch('/api/shared-with-me', { cache: 'no-store' })
      if (res.status === 401) {
        setSharedWithMe([])
        return
      }
      const data = (await res.json().catch(() => null)) as
        | { items?: unknown }
        | null
      if (!res.ok) {
        setSharedWithMe([])
        return
      }
      const items = Array.isArray(data?.items) ? (data.items as SharedExtractionItem[]) : []
      setSharedWithMe(items)
    } catch {
      setSharedWithMe([])
    } finally {
      setSharedWithMeLoading(false)
    }
  }, [])

  const loadCircleMembers = useCallback(async (extractionId: string) => {
    const id = extractionId.trim()
    if (!id) {
      setCircleMembers([])
      return
    }
    setCircleMembersLoading(true)
    try {
      const res = await fetch(`/api/extractions/${encodeURIComponent(id)}/members`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setCircleMembers([])
        return
      }
      const data = (await res.json().catch(() => null)) as
        | { members?: unknown }
        | null
      const members = Array.isArray(data?.members) ? (data.members as ExtractionMember[]) : []
      setCircleMembers(members)
    } catch {
      setCircleMembers([])
    } finally {
      setCircleMembersLoading(false)
    }
  }, [])

  const resetExtractionUiState = useCallback(() => {
    setResult(null)
    setIsResultBookClosed(false)
    setError(null)
    setNotice(null)
    setActivePhase(null)
    setShareCopied(false)
    setShareVisibilityLoading(false)
    setHistoryShareCopiedItemId(null)
    setHistoryShareLoadingItemId(null)
    setStreamStatus(null)
    setStreamPreview('')
    setShouldScrollToResult(false)
    setResultAccessRole('owner')
    setCircleMembers([])
    setCircleMembersLoading(false)
    setCircleMemberMutationLoading(false)
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadError(null)
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract/upload', {
        method: 'POST',
        body: formData,
      })
      const data = (await res.json().catch(() => null)) as {
        text?: string
        charCount?: number
        sourceLabel?: string
        sourceType?: string
        error?: string
      } | null

      if (!res.ok) {
        const msg =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo procesar el archivo.'
        setUploadError(msg)
        return
      }

      if (
        data &&
        typeof data.text === 'string' &&
        typeof data.charCount === 'number' &&
        (data.sourceType === 'pdf' || data.sourceType === 'docx')
      ) {
        setUploadedFile({
          name: file.name,
          sourceType: data.sourceType,
          text: data.text,
          charCount: data.charCount,
          sourceLabel: data.sourceLabel ?? file.name,
        })
        setUrl('')
      } else {
        setUploadError('Respuesta inesperada del servidor.')
      }
    } catch {
      setUploadError('Error de conexión al subir el archivo.')
    } finally {
      setIsUploading(false)
    }
  }, [])

  const handleClearFile = useCallback(() => {
    setUploadedFile(null)
    setUploadError(null)
  }, [])

  const handleSessionMissing = useCallback(() => {
    setReauthRequired(false)
    resetHistory()
    resetFolders()
    setSharedWithMe([])
    setActiveFolderIds([])
    resetExtractionUiState()
  }, [resetExtractionUiState, resetFolders, resetHistory])

  const handleAuthenticated = useCallback(async () => {
    await Promise.all([loadHistory(), loadFolders(), loadSharedWithMe()])
  }, [loadFolders, loadHistory, loadSharedWithMe])

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
    onAuthenticated: handleAuthenticated,
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
    resetFolders()
    setSharedWithMe([])
    setCircleMembers([])
    setCircleMembersLoading(false)
    setCircleMemberMutationLoading(false)
    setResultAccessRole('owner')
    setActiveFolderIds([])
    setNotice(null)
    setStreamStatus(null)
    setStreamPreview('')
  }, [resetFolders, resetHistory, setAuthError, setAuthMode, setAuthNotice, setEmail, setUser, user])

  useEffect(() => {
    if (!user) return
    setReauthRequired(false)
  }, [user])

  useEffect(() => {
    setActiveFolderIds((previous) => {
      if (previous.length === 0) return previous
      const validIds = new Set(folders.map((folder) => folder.id))
      const next = previous.filter((id) => validIds.has(id))
      return next.length === previous.length ? previous : next
    })
  }, [folders])

  useEffect(() => {
    const extractionId = result?.id?.trim()
    if (!extractionId || resultAccessRole !== 'owner') {
      setCircleMembers([])
      setCircleMembersLoading(false)
      return
    }
    void loadCircleMembers(extractionId)
  }, [loadCircleMembers, result?.id, resultAccessRole])

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
          window.history.replaceState({}, '', '/app')
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
    window.location.href = '/'
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

    const extractionModeToUse = normalizeExtractionMode(options?.mode ?? extractionMode)

    // Build request body based on source
    let streamBody: Record<string, unknown>
    if (uploadedFile) {
      // File was uploaded: send extracted text
      streamBody = {
        text: uploadedFile.text,
        sourceType: uploadedFile.sourceType,
        sourceLabel: uploadedFile.sourceLabel,
        mode: extractionModeToUse,
        outputLanguage,
      }
    } else {
      const extractionUrl = (options?.url ?? url).trim()
      if (!extractionUrl || isProcessing) return

      const srcType = detectSourceType(extractionUrl)

      if (srcType === 'text') {
        // Plain pasted text
        streamBody = {
          text: extractionUrl,
          sourceType: 'text',
          sourceLabel: extractionUrl.slice(0, 60),
          mode: extractionModeToUse,
          outputLanguage,
        }
      } else {
        // youtube or web_url
        streamBody = {
          url: extractionUrl,
          sourceType: srcType,
          mode: extractionModeToUse,
          outputLanguage,
        }
      }

      if (extractionUrl !== url) {
        setUrl(extractionUrl)
      }
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
    setIsResultBookClosed(false)
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
          const resolvedShareVisibility = normalizeShareVisibility(
            (payload as { shareVisibility?: unknown }).shareVisibility
          )
          const fromCache = (payload as { cached?: unknown }).cached === true
          setResult({
            ...(payload as ExtractResult),
            mode: resolvedMode,
            shareVisibility: resolvedShareVisibility,
            accessRole: 'owner',
          })
          setResultAccessRole('owner')
          setCircleMembers([])
          setIsResultBookClosed(false)
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
        body: JSON.stringify(streamBody),
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

  const handleCopyMarkdown = async (source?: ExtractResult | HistoryItem) => {
    const markdownSource = source ?? result
    if (!markdownSource) return

    const markdown = buildExtractionMarkdown({
      extractionMode: markdownSource.mode ?? extractionMode,
      objective: markdownSource.objective,
      phases: markdownSource.phases,
      proTip: markdownSource.proTip,
      metadata: markdownSource.metadata,
      videoTitle: markdownSource.videoTitle ?? null,
      videoUrl: (markdownSource.url ?? url).trim(),
    })

    await navigator.clipboard.writeText(markdown)
    setNotice('Contenido copiado como Markdown.')
  }

  const handleCopyShareLink = async () => {
    if (resultAccessRole !== 'owner') {
      setError('Solo el owner puede generar enlaces compartibles.')
      return
    }
    if (!result?.id || shareLoading) return
    if (!isShareVisibilityShareable(normalizeShareVisibility(result.shareVisibility))) {
      setError('Este contenido no es compartible. Cámbialo a Público o Solo con enlace.')
      return
    }

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
            : res.status === 409
              ? 'Este contenido no es compartible. Cámbialo a Público o Solo con enlace.'
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

  const handleCopyShareLinkFromHistory = async (item: HistoryItem) => {
    const extractionId = item.id?.trim()
    if (!extractionId || historyShareLoadingItemId) return
    if (!isShareVisibilityShareable(normalizeShareVisibility(item.shareVisibility))) {
      setError('Este contenido no es compartible. Cámbialo a Público o Solo con enlace.')
      return
    }

    setHistoryShareLoadingItemId(extractionId)
    setHistoryShareCopiedItemId(null)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId }),
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
            : res.status === 409
              ? 'Este contenido no es compartible. Cámbialo a Público o Solo con enlace.'
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
      setHistoryShareCopiedItemId(extractionId)
      setNotice('Enlace compartible copiado.')
      window.setTimeout(() => {
        setHistoryShareCopiedItemId((current) => (current === extractionId ? null : current))
      }, 2500)
    } catch {
      setError('No se pudo copiar el enlace compartible. Intenta de nuevo.')
    } finally {
      setHistoryShareLoadingItemId((current) => (current === extractionId ? null : current))
    }
  }

  const handleUpdateShareVisibility = async (nextVisibility: ShareVisibility) => {
    if (resultAccessRole !== 'owner') {
      setError('Solo el owner puede cambiar la visibilidad.')
      return
    }
    const extractionId = result?.id?.trim()
    if (!extractionId || shareVisibilityLoading) return

    const currentVisibility = normalizeShareVisibility(result?.shareVisibility)
    if (currentVisibility === nextVisibility) return

    setError(null)
    setNotice(null)
    setShareVisibilityLoading(true)
    setResult((previous) => {
      if (!previous || previous.id !== extractionId) return previous
      return {
        ...previous,
        shareVisibility: nextVisibility,
      }
    })

    try {
      const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareVisibility: nextVisibility }),
      })

      if (res.status === 401) {
        handleUnauthorized()
        setError('Tu sesión expiró. Vuelve a iniciar sesión.')
        setResult((previous) => {
          if (!previous || previous.id !== extractionId) return previous
          return {
            ...previous,
            shareVisibility: currentVisibility,
          }
        })
        return
      }

      const data = (await res.json().catch(() => null)) as
        | { shareVisibility?: unknown; error?: unknown }
        | null

      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo actualizar la visibilidad del contenido.'
        setError(message)
        setResult((previous) => {
          if (!previous || previous.id !== extractionId) return previous
          return {
            ...previous,
            shareVisibility: currentVisibility,
          }
        })
        return
      }

      const persistedVisibility = normalizeShareVisibility(data?.shareVisibility)

      setResult((previous) => {
        if (!previous || previous.id !== extractionId) return previous
        return {
          ...previous,
          shareVisibility: persistedVisibility,
        }
      })

      if (!isShareVisibilityShareable(persistedVisibility)) {
        setShareCopied(false)
      }

      setNotice(getShareVisibilityChangeNotice(persistedVisibility))
      void loadHistory()
    } catch {
      setError('No se pudo actualizar la visibilidad. Intenta nuevamente.')
      setResult((previous) => {
        if (!previous || previous.id !== extractionId) return previous
        return {
          ...previous,
          shareVisibility: currentVisibility,
        }
      })
    } finally {
      setShareVisibilityLoading(false)
    }
  }

  const handleSaveResultMeta = useCallback(
    async (meta: { title: string; thumbnailUrl: string | null; objective: string }) => {
      if (resultAccessRole !== 'owner') return false
      const extractionId = result?.id?.trim()
      if (!extractionId) return false
      setError(null)
      setNotice(null)
      try {
        const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/meta`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: meta.title, thumbnailUrl: meta.thumbnailUrl, objective: meta.objective }),
        })
        if (res.status === 401) { handleUnauthorized(); return false }
        const data = (await res.json().catch(() => null)) as {
          videoTitle?: string
          sourceLabel?: string
          thumbnailUrl?: string | null
          objective?: string
          error?: string
        } | null
        if (!res.ok) { setError(data?.error ?? 'No se pudo guardar.'); return false }
        setResult((prev) =>
          !prev || prev.id !== extractionId ? prev : {
            ...prev,
            videoTitle: data?.videoTitle ?? meta.title,
            sourceLabel: data?.sourceLabel ?? meta.title,
            thumbnailUrl: data?.thumbnailUrl ?? meta.thumbnailUrl,
            objective: data?.objective ?? meta.objective,
          }
        )
        setNotice('Información actualizada correctamente.')
        void loadHistory()
        return true
      } catch {
        setError('Error de conexión al guardar.')
        return false
      }
    },
    [handleUnauthorized, loadHistory, result, resultAccessRole]
  )

  const handleAssignFolder = useCallback(
    async (extractionId: string, folderId: string | null) => {
      if (resultAccessRole !== 'owner') return
      try {
        const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/folder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId }),
        })
        if (res.status === 401) { handleUnauthorized(); return }
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        if (!res.ok) {
          setError(
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo asignar la carpeta.'
          )
          return
        }
        setError(null)
        setHistory((prev) =>
          prev.map((item) => (item.id === extractionId ? { ...item, folderId } : item))
        )
        setResult((prev) => (prev && prev.id === extractionId ? { ...prev, folderId } : prev))
      } catch {
        setError('Error de conexión al asignar carpeta.')
      }
    },
    [handleUnauthorized, resultAccessRole, setError, setHistory, setResult]
  )

  const handleAddCircleMember = useCallback(
    async (input: { email: string; role: 'editor' | 'viewer' }) => {
      const extractionId = result?.id?.trim()
      if (!extractionId || resultAccessRole !== 'owner') return false

      setCircleMemberMutationLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        if (res.status === 401) {
          handleUnauthorized()
          setError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return false
        }

        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        if (!res.ok) {
          setError(
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo agregar el miembro.'
          )
          return false
        }

        await loadCircleMembers(extractionId)
        setNotice('Miembro agregado al círculo.')
        return true
      } catch {
        setError('Error de conexión al agregar el miembro.')
        return false
      } finally {
        setCircleMemberMutationLoading(false)
      }
    },
    [handleUnauthorized, loadCircleMembers, result?.id, resultAccessRole]
  )

  const handleRemoveCircleMember = useCallback(
    async (memberUserId: string) => {
      const extractionId = result?.id?.trim()
      if (!extractionId || resultAccessRole !== 'owner') return false

      setCircleMemberMutationLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/extractions/${encodeURIComponent(extractionId)}/members/${encodeURIComponent(memberUserId)}`,
          { method: 'DELETE' }
        )

        if (res.status === 401) {
          handleUnauthorized()
          setError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return false
        }

        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        if (!res.ok) {
          setError(
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo eliminar el miembro.'
          )
          return false
        }

        await loadCircleMembers(extractionId)
        setNotice('Miembro eliminado del círculo.')
        return true
      } catch {
        setError('Error de conexión al eliminar el miembro.')
        return false
      } finally {
        setCircleMemberMutationLoading(false)
      }
    },
    [handleUnauthorized, loadCircleMembers, result?.id, resultAccessRole]
  )

  const handleSaveResultPhases = useCallback(
    async (phases: Phase[]) => {
      if (resultAccessRole !== 'owner' && resultAccessRole !== 'editor') return false
      const extractionId = result?.id?.trim()
      if (!extractionId) {
        setError('No se puede guardar: esta extracción no está en historial.')
        return false
      }

      setError(null)
      setNotice(null)

      try {
        const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/content`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phases }),
        })

        if (res.status === 401) {
          handleUnauthorized()
          setError('Tu sesión expiró. Vuelve a iniciar sesión.')
          return false
        }

        const data = (await res.json().catch(() => null)) as
          | { phases?: unknown; error?: unknown }
          | null

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : 'No se pudo guardar la edición del contenido.'
          setError(message)
          return false
        }

        const persistedPhases = normalizePersistedPhases(data?.phases, phases)
        setResult((previous) => {
          if (!previous || previous.id !== extractionId) return previous
          return {
            ...previous,
            phases: persistedPhases,
          }
        })
        setActivePhase(null)
        setNotice('Contenido actualizado correctamente.')
        void loadHistory()
        return true
      } catch {
        setError('No se pudo guardar la edición del contenido.')
        return false
      }
    },
    [handleUnauthorized, loadHistory, result, resultAccessRole]
  )

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
    setUrl(item.url ?? '')
    setUploadedFile(null)
    setExtractionMode(mode)
    setResult({
      id: item.id,
      orderNumber: item.orderNumber,
      shareVisibility: normalizeShareVisibility(item.shareVisibility),
      createdAt: item.createdAt,
      folderId: item.folderId ?? null,
      url: item.url ?? null,
      videoId: item.videoId ?? null,
      videoTitle: item.videoTitle ?? null,
      thumbnailUrl: item.thumbnailUrl ?? null,
      mode,
      objective: item.objective,
      phases: item.phases,
      proTip: item.proTip,
      metadata: item.metadata,
      sourceType: item.sourceType,
      sourceLabel: item.sourceLabel ?? null,
      accessRole: 'owner',
    })
    setResultAccessRole('owner')
    setCircleMembers([])
    if (item.id) {
      void loadCircleMembers(item.id)
    }
    setIsResultBookClosed(false)
    setActivePhase(null)
    setError(null)
    setShareCopied(false)
    setShareVisibilityLoading(false)
    setStreamStatus(null)
    setStreamPreview('')
    setShouldScrollToResult(true)
  }

  const openSharedItem = (item: SharedExtractionItem) => {
    const mode = normalizeExtractionMode(item.mode)
    setUrl(item.url ?? '')
    setUploadedFile(null)
    setExtractionMode(mode)
    setResult({
      id: item.id,
      orderNumber: item.orderNumber,
      shareVisibility: normalizeShareVisibility(item.shareVisibility),
      createdAt: item.createdAt,
      folderId: item.folderId ?? null,
      url: item.url ?? null,
      videoId: item.videoId ?? null,
      videoTitle: item.videoTitle ?? null,
      thumbnailUrl: item.thumbnailUrl ?? null,
      mode,
      objective: item.objective,
      phases: item.phases,
      proTip: item.proTip,
      metadata: item.metadata,
      sourceType: item.sourceType,
      sourceLabel: item.sourceLabel ?? null,
      accessRole: item.accessRole,
      ownerName: item.ownerName,
      ownerEmail: item.ownerEmail,
    })
    setResultAccessRole(item.accessRole)
    setCircleMembers([])
    setIsResultBookClosed(false)
    setActivePhase(null)
    setError(null)
    setShareCopied(false)
    setShareVisibilityLoading(false)
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
        orderNumber: undefined,
        shareVisibility: undefined,
        createdAt: undefined,
      }
    })
    setShareCopied(false)
  }, [])

  const handleDeleteHistoryItem = useCallback(
    async (item: HistoryItem) => {
      const title = item.videoTitle?.trim() || item.sourceLabel?.trim() || item.objective?.trim() || item.url || 'Sin fuente'
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
        orderNumber: undefined,
        shareVisibility: undefined,
        createdAt: undefined,
      }
    })
    setShareCopied(false)
    setHistoryShareCopiedItemId(null)
    setHistoryShareLoadingItemId(null)

    const deletedCount =
      typeof result.deletedCount === 'number' && result.deletedCount > 0
        ? ` (${result.deletedCount})`
        : ''
    setNotice(`Historial limpiado correctamente${deletedCount}.`)
  }, [clearAllHistory, handleUnauthorized, history.length])

  const activeFolderIdForCover =
    activeFolderIds.length > 0 ? activeFolderIds[activeFolderIds.length - 1] : null
  const currentResultFolderLabel = activeFolderIdForCover
    ? folders.find((folder) => folder.id === activeFolderIdForCover)?.name ?? 'Playbooks sueltos'
    : 'Playbooks sueltos'
  const filteredHistoryForActiveFolders = activeFolderIds.length > 0
    ? filteredHistory.filter((item) => item.folderId != null && activeFolderIds.includes(item.folderId))
    : filteredHistory

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6 md:py-4 dark:border-white/10 dark:bg-black/90">
        {/* ── Logo + title ── */}
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white md:h-9 md:w-9 dark:border-white/15 dark:bg-zinc-950">
            <Image
              src="/roi-logo.png"
              alt="Roi Action Extractor App logo"
              fill
              sizes="36px"
              className="object-cover"
              priority
            />
          </div>
          {/* Full name on md+, short name on sm, hidden on xs */}
          <span className="hidden text-sm font-bold tracking-tight text-zinc-900 sm:inline md:text-xl dark:text-zinc-100">
            <span className="md:hidden">ROI Extractor</span>
            <span className="hidden md:inline">Roi Action Extractor App</span>
          </span>
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-1.5 md:gap-3">

          {/* Privacy / Terms — desktop only */}
          <div className="hidden items-center gap-3 text-xs font-medium text-zinc-500 md:flex dark:text-zinc-400">
            <Link className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-100" href="/privacy-policy">
              Política de Privacidad
            </Link>
            <Link className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-100" href="/terms-of-use">
              Términos de Uso
            </Link>
          </div>

          {/* Theme toggle — icon only on mobile, icon+label on sm+ */}
          <button
            onClick={toggleTheme}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-transparent px-2.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 md:h-10 md:px-3 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-zinc-100"
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="hidden text-sm font-medium sm:inline whitespace-nowrap">
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </span>
          </button>

          {user ? (
            <>
              {/* User email — desktop only */}
              <span className="hidden max-w-[160px] truncate text-sm text-zinc-600 lg:inline dark:text-zinc-300">
                {user.name ?? user.email}
              </span>

              {/* Settings — icon only on mobile, icon+text on sm+ */}
              <Link
                href="/settings"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-transparent px-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 md:h-10 md:px-3 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
                title="Configuración"
              >
                <Settings2 size={16} />
                <span className="hidden sm:inline">Configuración</span>
              </Link>

              {/* Logout — icon only on mobile, icon+text on sm+ */}
              <button
                onClick={handleLogout}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-violet-600 px-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-violet-700 md:h-10 md:px-4 dark:shadow-[0_24px_52px_-22px_rgba(139,92,246,0.96)]"
                title="Salir"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </>
          ) : (
            <span className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">Acceso requerido</span>
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
          <div className="flex min-h-[60vh] flex-col items-center justify-center">
            <div className="w-full max-w-md space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ROI Action Extractor
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {resetTokenFromUrl
                    ? 'Reset your password'
                    : 'Log in or create an account to continue.'}
                </p>
              </div>

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

              <div className="text-center">
                <a href="/" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  ← Back to landing
                </a>
              </div>
            </div>
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
                    onUrlChange={(value) => {
                      setUrl(value)
                      if (uploadedFile) setUploadedFile(null)
                    }}
                    onExtract={handleExtract}
                    onScrollToHistory={handleScrollToHistory}
                    hasHistory={history.length > 0}
                    uploadedFile={uploadedFile}
                    isUploading={isUploading}
                    uploadError={uploadError}
                    onFileSelect={handleFileSelect}
                    onClearFile={handleClearFile}
                  onManualResult={(manualResult) => {
                    setResult(manualResult)
                    setResultAccessRole('owner')
                    setCircleMembers([])
                    setIsResultBookClosed(false)
                    setUrl('')
                    setUploadedFile(null)
                    setError(null)
                      setNotice('Extracción vacía creada. Usa "Editar estructura" para agregar contenido.')
                      setShouldScrollToResult(true)
                      void loadHistory()
                    }}
                    onManualToggle={setIsManualFormOpen}
                  />
                </div>

                <WorkspaceControlsDock
                  extractionMode={extractionMode}
                  outputLanguage={outputLanguage}
                  isProcessing={isProcessing}
                  isManualOpen={isManualFormOpen}
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

                {error && (
                  <div className="mx-auto mt-1 mb-8 w-full max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 dark:border-red-800 dark:bg-red-900/20">
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5 dark:text-red-400" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}

                {isProcessing && (() => {
                  const parsed = parseStreamPreview(streamPreview)
                  const PHASES = 3
                  const skeletonTitleWidths = [42, 58, 36]
                  return (
                    <div className="mx-auto mt-1 mb-8 w-full max-w-3xl space-y-3">
                      {/* Status */}
                      <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/20">
                        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-700 dark:border-t-indigo-300" />
                        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                          {streamStatus ?? 'Procesando con IA...'}
                        </p>
                      </div>
                      {/* Preview progresivo */}
                      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                        {/* Objetivo */}
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
                        {/* Fases */}
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
            </section>

            {/* ── Folder dock ── */}
            <FolderDock
              folders={folders}
              activeFolderIds={activeFolderIds}
              folderCounts={Object.fromEntries(
                folders.map((f) => [f.id, history.filter((h) => h.folderId === f.id).length])
              )}
              onFolderToggle={(id) => {
                setActiveFolderIds((prev) =>
                  prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
                )
              }}
              onCreateFolder={(name, color, parentId) => {
                const f = createFolder(name, color, parentId)
                setActiveFolderIds((prev) => [...prev, f.id])
              }}
              onDeleteFolder={(id) => {
                const deletedIds = new Set<string>()
                const collect = (folderId: string) => {
                  deletedIds.add(folderId)
                  folders.filter((f) => f.parentId === folderId).forEach((c) => collect(c.id))
                }
                collect(id)
                setActiveFolderIds((prev) => prev.filter((f) => !deletedIds.has(f)))
                deleteFolder(id)
              }}
            />

            <div className="relative">
              <div ref={resultAnchorRef} className="scroll-mt-24">
                {result ? (
                  <ResultPanel
                    result={result}
                    viewerUserId={user?.id ?? null}
                    url={url}
                    extractionMode={extractionMode}
                    isProcessing={isProcessing}
                    activePhase={activePhase}
                    onTogglePhase={togglePhase}
                    isExportingPdf={isExportingPdf}
                    shareLoading={shareLoading}
                    shareCopied={shareCopied}
                    shareVisibility={normalizeShareVisibility(result.shareVisibility)}
                    shareVisibilityLoading={shareVisibilityLoading}
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
                    onCopyMarkdown={() => handleCopyMarkdown()}
                    onShareVisibilityChange={handleUpdateShareVisibility}
                    onSavePhases={handleSaveResultPhases}
                    onSaveMeta={handleSaveResultMeta}
                    isBookClosed={isResultBookClosed}
                    bookFolderLabel={currentResultFolderLabel}
                    onClose={() => setIsResultBookClosed(true)}
                    folders={folders}
                    onAssignFolder={handleAssignFolder}
                    accessRole={resultAccessRole}
                    members={circleMembers}
                    membersLoading={circleMembersLoading}
                    memberMutationLoading={circleMemberMutationLoading}
                    onAddMember={handleAddCircleMember}
                    onRemoveMember={handleRemoveCircleMember}
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
                ) : !isProcessing ? (
                  <div className="animate-fade-slide">
                    <div
                      className="paper-playbook paper-playbook-closed min-h-screen min-h-[100dvh] bg-white rounded-sm shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 dark:shadow-none"
                    >
                      <span aria-hidden="true" className="paper-playbook-fold" />
                      <div aria-hidden="true" className="paper-playbook-cover translate-y-0 opacity-100">
                        <p className="paper-playbook-cover-kicker">Carpeta activa</p>
                        <p className="paper-playbook-cover-title">Playbooks sueltos</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {historyView === 'list' && (
                <div className="absolute left-full top-0 hidden w-[18rem] min-[1728px]:block">
                  <PlaybookSideTabs
                    items={filteredHistoryForActiveFolders}
                    folders={folders}
                    loading={historyLoading}
                    activeItemId={result?.id ?? null}
                    onSelectItem={openHistoryItem}
                    onRefresh={() => void loadHistory()}
                  />
                </div>
              )}
            </div>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Compartidos conmigo
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Playbooks de círculo donde tienes acceso como viewer o editor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadSharedWithMe()}
                  disabled={sharedWithMeLoading}
                  className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {sharedWithMeLoading ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>

              {sharedWithMeLoading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Cargando compartidos...</p>
              ) : sharedWithMe.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Aún no tienes playbooks compartidos en círculo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sharedWithMe.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openSharedItem(item)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {item.videoTitle || item.sourceLabel || item.objective || 'Sin título'}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            Owner: {item.ownerName?.trim() || item.ownerEmail || 'Sin datos'}
                          </p>
                        </div>
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:border-sky-700 dark:bg-sky-900/25 dark:text-sky-300">
                          {item.accessRole === 'editor' ? 'Editor' : 'Viewer'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <CommunityPanel
              currentExtractionId={result?.id ?? null}
              onError={setError}
              onNotice={setNotice}
            />

            <div ref={historyAnchorRef} className="scroll-mt-24 pt-6 md:pt-10">
              {/* View mode toggle */}
              {history.length > 0 && !historyLoading && (
                <div className="mb-4 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setHistoryView('list')}
                    title="Vista de lista"
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      historyView === 'list'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'border-slate-200 bg-transparent text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <LayoutList size={13} />
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryView('feed')}
                    title="Vista de feed"
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      historyView === 'feed'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'border-slate-200 bg-transparent text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Newspaper size={13} />
                    Feed
                  </button>
                </div>
              )}

              {historyView === 'feed' && history.length > 0 ? (
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-slate-400 dark:text-slate-500" />
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {history.length} extracción{history.length !== 1 ? 'es' : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadHistory()}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      Actualizar
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {history.map((item) => (
                      <ExtractionFeedCard
                        key={item.id}
                        item={item}
                        viewerUserId={user?.id ?? null}
                        isProcessing={false}
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
                        onConnectNotion={handleConnectNotion}
                        onConnectTrello={handleConnectTrello}
                        onConnectTodoist={handleConnectTodoist}
                        onConnectGoogleDocs={handleConnectGoogleDocs}
                        onExportToNotion={(id) => handleExportToNotion(id)}
                        onExportToTrello={(id) => handleExportToTrello(id)}
                        onExportToTodoist={(id) => handleExportToTodoist(id)}
                        onExportToGoogleDocs={(id) => handleExportToGoogleDocs(id)}
                        onError={(msg) => setError(msg)}
                        onNotice={(msg) => setNotice(msg)}
                        onUnauthorized={handleUnauthorized}
                        onScrollToExtractor={handleScrollToExtractor}
                        onReExtractMode={(itemUrl, mode) => {
                          setUrl(itemUrl)
                          setExtractionMode(mode)
                          handleScrollToExtractor()
                          void handleExtract({ url: itemUrl, mode })
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="min-[1728px]:hidden">
                  <HistoryPanel
                    history={history}
                    filteredHistory={filteredHistoryForActiveFolders}
                    historyLoading={historyLoading}
                    folders={folders}
                    activeFolderIds={activeFolderIds}
                    onAssignFolder={handleAssignFolder}
                    historyQuery={historyQuery}
                    pdfExportLoading={isExportingPdf}
                    historyShareLoadingItemId={historyShareLoadingItemId}
                    historyShareCopiedItemId={historyShareCopiedItemId}
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
                    onDownloadPdf={(item) => handleDownloadPdf(item)}
                    onCopyShareLink={handleCopyShareLinkFromHistory}
                    onCopyMarkdown={handleCopyMarkdown}
                    onExportToNotion={(item) => handleExportToNotion(item.id)}
                    onConnectNotion={handleConnectNotion}
                    onExportToTrello={(item) => handleExportToTrello(item.id)}
                    onConnectTrello={handleConnectTrello}
                    onExportToTodoist={(item) => handleExportToTodoist(item.id)}
                    onConnectTodoist={handleConnectTodoist}
                    onExportToGoogleDocs={(item) => handleExportToGoogleDocs(item.id)}
                    onConnectGoogleDocs={handleConnectGoogleDocs}
                    onDeleteItem={handleDeleteHistoryItem}
                    onClearHistory={() => void handleClearHistory()}
                  />
                </div>
              )}
            </div>

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

            <KnowledgeChat activeExtractionId={result?.id ?? null} />

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
