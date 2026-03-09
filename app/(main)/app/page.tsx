'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowUp,
  BarChart2,
  Brain,
  History,
  Layers,
  LayoutList,
  LogOut,
  Moon,
  Newspaper,
  Search,
  Settings2,
  Sun,
} from 'lucide-react'
import {
  DEFAULT_EXTRACTION_MODE,
  type ExtractionMode,
  getExtractionModeLabel,
  normalizeExtractionMode,
} from '@/lib/extraction-modes'
import { NotesAideLogo } from '@/app/components/NotesAideLogo'
import { buildExtractionMarkdown } from '@/lib/export-content'
import { flattenItemsAsText, normalizePlaybookPhases } from '@/lib/playbook-tree'
import {
  DEFAULT_EXTRACTION_OUTPUT_LANGUAGE,
  type ExtractionOutputLanguage,
} from '@/lib/output-language'
import { ExtractionForm } from '@/app/home/components/ExtractionForm'
import { BatchExtractPanel } from '@/app/home/components/BatchExtractPanel'
import { AuthAccessPanel } from '@/app/home/components/AuthAccessPanel'
import { CommunityPanel } from '@/app/home/components/CommunityPanel'
import { GoogleIcon } from '@/app/home/components/GoogleIcon'
import { ExtractionFeedCard } from '@/app/home/components/ExtractionFeedCard'
import { HistoryPanel } from '@/app/home/components/HistoryPanel'
import { KnowledgeChat, type FocusedItemContext } from '@/app/home/components/KnowledgeChat'
import { KeyboardShortcutsModal } from '@/app/home/components/KeyboardShortcutsModal'
import { ExtractionStreamingPreview } from '@/app/home/components/ExtractionStreamingPreview'
import { ResultPanel } from '@/app/home/components/ResultPanel'
import { PlaybookSideTabs } from '@/app/home/components/PlaybookSideTabs'
import { WorkspaceControlsDock } from '@/app/home/components/WorkspaceControlsDock'
import {
  FolderDock,
  type FolderColor,
  type FolderItem,
  type FolderPlaybookItem,
  type OpenDeskPlaybookItem,
} from '@/app/home/components/FolderDock'
import { useFolders } from '@/app/home/hooks/useFolders'
import { useAuth } from '@/app/home/hooks/useAuth'
import { useHistory } from '@/app/home/hooks/useHistory'
import { useIntegrations } from '@/app/home/hooks/useIntegrations'
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts'
import { isSystemExtractionFolderId } from '@/lib/extraction-folders'
import {
  applyTheme,
  formatHistoryDate,
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
  ExtractionTag,
  HistoryItem,
  Phase,
  ShareVisibility,
  SharedExtractionItem,
  SourceType,
  Theme,
} from '@/app/home/lib/types'
import type { UploadedFileState } from '@/app/home/components/ExtractionForm'
import { detectSourceType } from '@/lib/source-detector'
import { useLang } from '@/app/home/hooks/useLang'
import { t } from '@/app/home/lib/i18n'

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
  const normalized = normalizePlaybookPhases(payload)
  return normalized.length > 0 ? normalized : fallback
}

const CURRENT_PLAYBOOK_PHASE_KEY = '__current__'
const SHARED_RESOURCES_BACKGROUND_REFRESH_MS = 30000
const SHARED_RESOURCES_DRAWER_REFRESH_MS = 10000
const SHARED_FOLDER_CLIENT_ID_PREFIX = 'ae-shared-folder'
const COMMUNITY_DRAWER_SWIPE_THRESHOLD_PX = 56
const COMMUNITY_DRAWER_EDGE_ACTIVATION_PX = 28
const DESK_SIDE_TABS_MIN_WIDTH_PX = 1728

function resolvePlaybookPhaseKey(playbookId: string | null | undefined) {
  const normalizedId = typeof playbookId === 'string' ? playbookId.trim() : ''
  return normalizedId || CURRENT_PLAYBOOK_PHASE_KEY
}

function resolvePlaybookDisplayTitle(
  item: {
    videoTitle?: string | null
    sourceLabel?: string | null
    objective?: string | null
    url?: string | null
  },
  untitledFallback = 'Untitled'
) {
  return (
    item.videoTitle?.trim() ||
    item.sourceLabel?.trim() ||
    item.objective?.trim() ||
    item.url?.trim() ||
    untitledFallback
  )
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function parseApiErrorMessage(payload: unknown, fallback: string) {
  const message = (payload as { error?: unknown } | null)?.error
  return typeof message === 'string' && message.trim() ? message : fallback
}

function normalizeSharedOwnerScope(value: string | null | undefined) {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

function buildSharedFolderClientId(input: { ownerScope: string; folderId: string }) {
  return `${SHARED_FOLDER_CLIENT_ID_PREFIX}:${encodeURIComponent(input.ownerScope)}:${encodeURIComponent(
    input.folderId
  )}`
}

function mapSharedFolderIdForClient(input: { ownerScope: string; folderId: string | null | undefined }) {
  const folderId = typeof input.folderId === 'string' ? input.folderId.trim() : ''
  if (!folderId) return null
  if (folderId.startsWith(`${SHARED_FOLDER_CLIENT_ID_PREFIX}:`)) return folderId
  return buildSharedFolderClientId({ ownerScope: input.ownerScope, folderId })
}

type GlobalPlaybookSearchHit =
  | {
      key: string
      source: 'mine'
      id: string
      title: string
      subtitle: string
      helper: string
      historyItem: HistoryItem
      sharedItem?: undefined
    }
  | {
      key: string
      source: 'shared'
      id: string
      title: string
      subtitle: string
      helper: string
      historyItem?: undefined
      sharedItem: SharedExtractionItem
    }

type ResolvedDeskPlaybook =
  | {
      source: 'mine'
      id: string
      historyItem: HistoryItem
      sharedItem?: undefined
    }
  | {
      source: 'shared'
      id: string
      historyItem?: undefined
      sharedItem: SharedExtractionItem
    }

interface PublicPlaybookDetailResponse {
  item?: ExtractResult
  error?: unknown
}

interface FolderShareMemberItem {
  folderId: string
  ownerUserId: string
  memberUserId: string
  role: 'viewer'
  createdAt: string
  userName: string | null
  userEmail: string | null
}

const FOLDER_COLOR_VALUES = new Set<FolderColor>([
  'amber',
  'indigo',
  'emerald',
  'rose',
  'sky',
  'violet',
  'orange',
])

function normalizeSharedFolder(raw: unknown): FolderItem | null {
  if (!raw || typeof raw !== 'object') return null

  const rawId = typeof (raw as { id?: unknown }).id === 'string'
    ? (raw as { id: string }).id.trim()
    : ''
  const name = typeof (raw as { name?: unknown }).name === 'string'
    ? (raw as { name: string }).name.trim()
    : ''
  const colorRaw = typeof (raw as { color?: unknown }).color === 'string'
    ? (raw as { color: string }).color.trim()
    : ''
  const color = FOLDER_COLOR_VALUES.has(colorRaw as FolderColor) ? (colorRaw as FolderColor) : null
  const parentIdFromApi = (raw as { parentId?: unknown }).parentId
  const rawParentId =
    parentIdFromApi === null
      ? null
      : typeof parentIdFromApi === 'string' && parentIdFromApi.trim()
        ? parentIdFromApi.trim()
        : null
  const ownerUserId = typeof (raw as { ownerUserId?: unknown }).ownerUserId === 'string'
    ? (raw as { ownerUserId: string }).ownerUserId.trim()
    : ''
  const ownerName =
    typeof (raw as { ownerName?: unknown }).ownerName === 'string'
      ? (raw as { ownerName: string }).ownerName.trim() || null
      : null
  const ownerEmail =
    typeof (raw as { ownerEmail?: unknown }).ownerEmail === 'string'
      ? (raw as { ownerEmail: string }).ownerEmail.trim() || null
      : null
  const rootSharedFolderIdRaw =
    typeof (raw as { rootSharedFolderId?: unknown }).rootSharedFolderId === 'string'
      ? (raw as { rootSharedFolderId: string }).rootSharedFolderId.trim() || null
      : null

  if (!rawId || !name || !color || !ownerUserId) return null

  const ownerScope = normalizeSharedOwnerScope(ownerEmail) || ownerUserId
  const id = buildSharedFolderClientId({ ownerScope, folderId: rawId })
  const parentId =
    rawParentId && !isSystemExtractionFolderId(rawParentId)
      ? mapSharedFolderIdForClient({ ownerScope, folderId: rawParentId })
      : rawParentId
  const rootSharedFolderId = mapSharedFolderIdForClient({
    ownerScope,
    folderId: rootSharedFolderIdRaw,
  })

  return {
    id,
    name,
    color,
    parentId,
    isShared: true,
    ownerUserId,
    ownerName,
    ownerEmail,
    rootSharedFolderId,
  }
}


function ActionExtractor() {
  const searchParams = useSearchParams()
  const resetTokenFromUrl = searchParams.get('token')
  const { lang, toggle: toggleLang } = useLang()

  const [url, setUrl] = useState('')
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>(DEFAULT_EXTRACTION_MODE)
  const [outputLanguage, setOutputLanguage] = useState<ExtractionOutputLanguage>(
    DEFAULT_EXTRACTION_OUTPUT_LANGUAGE
  )
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [isResultBookClosed, setIsResultBookClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activePhasesByPlaybookId, setActivePhasesByPlaybookId] = useState<Record<string, number | null>>({})
  const [stackedResultIds, setStackedResultIds] = useState<string[]>([])
  const [pendingStackedScrollPlaybookId, setPendingStackedScrollPlaybookId] = useState<string | null>(null)
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
  const [sharedFolders, setSharedFolders] = useState<FolderItem[]>([])
  const [folderShareTargetId, setFolderShareTargetId] = useState<string | null>(null)
  const [focusedItemForChat, setFocusedItemForChat] = useState<FocusedItemContext | null>(null)
  const [folderShareMembers, setFolderShareMembers] = useState<FolderShareMemberItem[]>([])
  const [folderShareMembersLoading, setFolderShareMembersLoading] = useState(false)
  const [folderShareMutationLoading, setFolderShareMutationLoading] = useState(false)
  const [folderShareEmailDraft, setFolderShareEmailDraft] = useState('')
  const [, setSharedWithMeLoading] = useState(false)
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
  const [isSearchFormOpen, setIsSearchFormOpen] = useState(false)
  const [globalPlaybookQuery, setGlobalPlaybookQuery] = useState('')
  const [activeFolderIds, setActiveFolderIds] = useState<string[]>([])
  const { folders, loadFolders, resetFolders, createFolder, deleteFolder } = useFolders()
  const [isFolderDockOpen, setIsFolderDockOpen] = useState(false)
  const [isCommunityDrawerOpen, setIsCommunityDrawerOpen] = useState(false)
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false)
  const [historyView, setHistoryView] = useState<'list' | 'feed'>('list')
  const [theme, setTheme] = useState<Theme>('light')
  const [reauthRequired, setReauthRequired] = useState(false)
  const [rateLimitUsed, setRateLimitUsed] = useState<number | null>(null)
  const [rateLimitTotal, setRateLimitTotal] = useState<number | null>(null)
  const [extraCredits, setExtraCredits] = useState<number | null>(null)
  const [hasUnlimitedExtractions, setHasUnlimitedExtractions] = useState(false)
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false)
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null)
  const [chatTokenUsed, setChatTokenUsed] = useState<number | null>(null)
  const [chatTokenLimit, setChatTokenLimit] = useState<number | null>(null)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [allTags, setAllTags] = useState<ExtractionTag[]>([])
  const [activeTagIds, setActiveTagIds] = useState<string[]>([])
  const extractorSectionRef = useRef<HTMLElement | null>(null)
  const resultAnchorRef = useRef<HTMLDivElement | null>(null)
  const historyAnchorRef = useRef<HTMLDivElement | null>(null)
  const communityDrawerEdgeTouchStartXRef = useRef<number | null>(null)
  const communityDrawerHandleGestureRef = useRef<{
    startX: number
    startOpen: boolean
  } | null>(null)
  const communityDrawerSuppressClickRef = useRef(false)
  const themeStorageKey = getThemeStorageKey()
  const normalizedFolderShareEmailDraft = folderShareEmailDraft.trim().toLowerCase()
  const isFolderShareEmailDraftValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedFolderShareEmailDraft)
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
      return t(lang, 'app.invalidUrl')
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
      const res = await fetch('/api/shared-with-me', {
        cache: 'no-store',
      })
      if (res.status === 401) {
        setSharedWithMe([])
        return
      }
      const data = (await res.json().catch(() => null)) as
        | { items?: unknown }
        | null
      if (!res.ok) {
        return
      }
      const items = Array.isArray(data?.items)
        ? (data.items as SharedExtractionItem[]).map((item) => {
            const ownerScope = normalizeSharedOwnerScope(item.ownerEmail)
            const shareSource = item.shareSource
            const isSharedViaFolder = shareSource === 'folder' || shareSource === 'both'
            const mappedFolderId =
              isSharedViaFolder && ownerScope
                ? mapSharedFolderIdForClient({
                    ownerScope,
                    folderId: item.folderId ?? null,
                  })
                : null
            const mappedRootFolderId =
              isSharedViaFolder && ownerScope
                ? mapSharedFolderIdForClient({
                    ownerScope,
                    folderId: item.sharedFolderContext?.rootFolderId ?? null,
                  })
                : null

            return {
              ...item,
              folderId: mappedFolderId,
              sharedFolderContext: item.sharedFolderContext
                ? {
                    ...item.sharedFolderContext,
                    rootFolderId: mappedRootFolderId,
                  }
                : null,
              phases: normalizePlaybookPhases(item.phases),
            }
          })
        : []
      setSharedWithMe(items)
    } catch {
      // Keep the last successful payload on transient failures. These shared
      // resources can respond slowly right after authentication.
    } finally {
      setSharedWithMeLoading(false)
    }
  }, [])

  const loadSharedFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders/shared-with-me', {
        cache: 'no-store',
      })
      if (res.status === 401) {
        setSharedFolders([])
        return
      }

      const data = (await res.json().catch(() => null)) as { folders?: unknown[] } | null
      if (!res.ok) {
        return
      }

      const normalizedFolders = Array.isArray(data?.folders)
        ? data.folders.map(normalizeSharedFolder).filter((item): item is FolderItem => Boolean(item))
        : []
      setSharedFolders(normalizedFolders)
    } catch {
      // Keep the last successful payload on transient failures. These shared
      // resources can respond slowly right after authentication.
    }
  }, [])

  const refreshSharedResources = useCallback(async () => {
    await Promise.all([loadSharedWithMe(), loadSharedFolders()])
  }, [loadSharedFolders, loadSharedWithMe])

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

  const normalizeFolderShareMember = useCallback((raw: unknown): FolderShareMemberItem | null => {
    if (!raw || typeof raw !== 'object') return null

    const folderId = typeof (raw as { folderId?: unknown }).folderId === 'string'
      ? (raw as { folderId: string }).folderId.trim()
      : ''
    const ownerUserId = typeof (raw as { ownerUserId?: unknown }).ownerUserId === 'string'
      ? (raw as { ownerUserId: string }).ownerUserId.trim()
      : ''
    const memberUserId = typeof (raw as { memberUserId?: unknown }).memberUserId === 'string'
      ? (raw as { memberUserId: string }).memberUserId.trim()
      : ''
    const roleRaw = (raw as { role?: unknown }).role
    const role: 'viewer' = roleRaw === 'viewer' ? 'viewer' : 'viewer'
    const createdAt = typeof (raw as { createdAt?: unknown }).createdAt === 'string'
      ? (raw as { createdAt: string }).createdAt
      : ''
    const userName =
      typeof (raw as { userName?: unknown }).userName === 'string'
        ? (raw as { userName: string }).userName
        : null
    const userEmail =
      typeof (raw as { userEmail?: unknown }).userEmail === 'string'
        ? (raw as { userEmail: string }).userEmail
        : null

    if (!folderId || !ownerUserId || !memberUserId) return null
    return {
      folderId,
      ownerUserId,
      memberUserId,
      role,
      createdAt,
      userName,
      userEmail,
    }
  }, [])

  const loadFolderShareMembers = useCallback(async (folderId: string) => {
    const id = folderId.trim()
    if (!id) {
      setFolderShareMembers([])
      return
    }

    setFolderShareMembersLoading(true)
    try {
      const res = await fetch(`/api/folders/${encodeURIComponent(id)}/members`, {
        cache: 'no-store',
      })
      if (res.status === 401) {
        setFolderShareMembers([])
        setFolderShareTargetId(null)
        setFolderShareEmailDraft('')
        setFolderShareMembersLoading(false)
        setFolderShareMutationLoading(false)
        return
      }
      const data = (await res.json().catch(() => null)) as { members?: unknown[]; error?: unknown } | null
      if (!res.ok) {
        const message =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : t(lang, 'app.folderShareLoadError')
        setError(message)
        return
      }
      const members = Array.isArray(data?.members)
        ? data.members.map(normalizeFolderShareMember).filter((item): item is FolderShareMemberItem => Boolean(item))
        : []
      setFolderShareMembers(members)
    } catch {
      setError(t(lang, 'app.folderShareLoadError'))
    } finally {
      setFolderShareMembersLoading(false)
    }
  }, [normalizeFolderShareMember, setError])

  const openFolderShareModal = useCallback((folderId: string) => {
    const id = folderId.trim()
    if (!id) return
    setFolderShareTargetId(id)
    setFolderShareEmailDraft('')
    setFolderShareMembers([])
    void loadFolderShareMembers(id)
  }, [loadFolderShareMembers])

  const closeFolderShareModal = useCallback(() => {
    setFolderShareTargetId(null)
    setFolderShareEmailDraft('')
    setFolderShareMembers([])
    setFolderShareMembersLoading(false)
    setFolderShareMutationLoading(false)
  }, [])

  const handleAddFolderShareMember = useCallback(async () => {
    const folderId = folderShareTargetId?.trim()
    const email = folderShareEmailDraft.trim().toLowerCase()
    if (!folderId || !email) return

    setFolderShareMutationLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/folders/${encodeURIComponent(folderId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 401) {
        setError(t(lang, 'app.sessionExpired'))
        return
      }
      const data = (await res.json().catch(() => null)) as {
        error?: unknown
        member?: {
          userEmail?: unknown
        }
      } | null
      if (!res.ok) {
        setError(
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : t(lang, 'app.folderShareError')
        )
        return
      }
      const sharedWithEmail =
        typeof data?.member?.userEmail === 'string'
          ? data.member.userEmail.trim().toLowerCase()
          : ''
      if (sharedWithEmail && sharedWithEmail !== email) {
        setError(
          `${t(lang, 'app.sharingEmailMismatch')} ${email}. ${t(lang, 'app.sharingEmailRegistered')} ${sharedWithEmail}.`
        )
        await loadFolderShareMembers(folderId)
        return
      }
      setFolderShareEmailDraft('')
      await loadFolderShareMembers(folderId)
      setNotice(t(lang, 'app.infoUpdated'))
    } catch {
      setError(t(lang, 'app.folderShareError'))
    } finally {
      setFolderShareMutationLoading(false)
    }
  }, [
    folderShareEmailDraft,
    folderShareTargetId,
    loadFolderShareMembers,
    setError,
    setNotice,
  ])

  const handleRemoveFolderShareMember = useCallback(async (memberUserId: string) => {
    const folderId = folderShareTargetId?.trim()
    const targetId = memberUserId.trim()
    if (!folderId || !targetId) return

    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(t(lang, 'app.confirmRevokeFolder'))
    if (!confirmed) return

    setFolderShareMutationLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/folders/${encodeURIComponent(folderId)}/members/${encodeURIComponent(targetId)}`,
        { method: 'DELETE' }
      )
      if (res.status === 401) {
        setError(t(lang, 'app.sessionExpired'))
        return
      }
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null
      if (!res.ok) {
        setError(
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : t(lang, 'app.folderRevokeError')
        )
        return
      }
      await loadFolderShareMembers(folderId)
      setNotice(t(lang, 'app.infoUpdated'))
    } catch {
      setError(t(lang, 'app.folderRevokeError'))
    } finally {
      setFolderShareMutationLoading(false)
    }
  }, [folderShareTargetId, loadFolderShareMembers, setError, setNotice])

  const resetExtractionUiState = useCallback(() => {
    setResult(null)
    setIsResultBookClosed(false)
    setError(null)
    setNotice(null)
    setActivePhasesByPlaybookId({})
    setStackedResultIds([])
    setPendingStackedScrollPlaybookId(null)
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
        sourceFileName?: string
        sourceFileSizeBytes?: number
        sourceFileMimeType?: string
        sourceFileUrl?: string | null
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
          sourceFileName: data.sourceFileName ?? file.name,
          sourceFileSizeBytes: data.sourceFileSizeBytes ?? null,
          sourceFileMimeType: data.sourceFileMimeType ?? null,
          sourceFileUrl: data.sourceFileUrl ?? null,
        })
        setUrl('')
      } else {
        setUploadError('Respuesta inesperada del servidor.')
      }
    } catch {
      setUploadError(t(lang, 'app.uploadError'))
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
    setSharedFolders([])
    setFolderShareTargetId(null)
    setFolderShareMembers([])
    setFolderShareMembersLoading(false)
    setFolderShareMutationLoading(false)
    setFolderShareEmailDraft('')
    setActiveFolderIds([])
    resetExtractionUiState()
  }, [resetExtractionUiState, resetFolders, resetHistory])

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { tags: ExtractionTag[] }
      setAllTags(data.tags ?? [])
    } catch { /* noop */ }
  }, [])

  const handleAuthenticated = useCallback(async () => {
    await Promise.all([loadHistory(), loadFolders(), refreshSharedResources(), loadTags()])
  }, [loadFolders, loadHistory, loadTags, refreshSharedResources])

  // ── Tag handlers ────────────────────────────────────────────────────────
  const handleAddTagToResult = useCallback(async (name: string, color: string) => {
    if (!result?.id) return
    // 1. Upsert tag
    const tagRes = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (!tagRes.ok) return
    const { tag } = (await tagRes.json()) as { tag: ExtractionTag }
    // 2. Assign to extraction
    await fetch(`/api/extractions/${result.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: tag.id }),
    })
    // 3. Refresh tags list + result tags
    await Promise.all([loadTags(), loadHistory()])
    setResult((prev) =>
      prev
        ? { ...prev, tags: [...(prev.tags ?? []).filter((t) => t.id !== tag.id), tag] }
        : prev
    )
  }, [result?.id, loadTags, loadHistory])

  const handleRemoveTagFromResult = useCallback(async (tagId: string) => {
    if (!result?.id) return
    await fetch(`/api/extractions/${result.id}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId }),
    })
    await loadHistory()
    setResult((prev) =>
      prev ? { ...prev, tags: (prev.tags ?? []).filter((t) => t.id !== tagId) } : prev
    )
  }, [result?.id, loadHistory])

  const handleToggleTagFilter = useCallback((tagId: string) => {
    setActiveTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }, [])

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
    setSharedFolders([])
    setFolderShareTargetId(null)
    setFolderShareMembers([])
    setFolderShareMembersLoading(false)
    setFolderShareMutationLoading(false)
    setFolderShareEmailDraft('')
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
    if (!user) {
      setIsCommunityDrawerOpen(false)
      return
    }
    setReauthRequired(false)
  }, [user])

  useEffect(() => {
    if (!user) return

    const refreshShared = () => {
      void refreshSharedResources()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      refreshShared()
    }

    const intervalId = window.setInterval(refreshShared, SHARED_RESOURCES_BACKGROUND_REFRESH_MS)
    window.addEventListener('focus', refreshShared)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshShared)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshSharedResources, user])

  useEffect(() => {
    if (!user || !isFolderDockOpen) return
    void refreshSharedResources()

    const intervalId = window.setInterval(() => {
      void refreshSharedResources()
    }, SHARED_RESOURCES_DRAWER_REFRESH_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isFolderDockOpen, refreshSharedResources, user])

  useEffect(() => {
    setActiveFolderIds((previous) => {
      if (previous.length === 0) return previous
      const validIds = new Set(
        [...folders, ...sharedFolders].map((folder) => folder.id.trim()).filter((id) => id.length > 0)
      )
      const next = previous.filter((id) => validIds.has(id))
      return next.length === previous.length ? previous : next
    })
  }, [folders, sharedFolders])

  useEffect(() => {
    setStackedResultIds((previous) => {
      if (previous.length === 0) return previous
      const validDeskPlaybookIds = new Set([
        ...history.map((item) => item.id),
        ...sharedWithMe.map((item) => item.id),
      ])
      const next = previous.filter((id) => validDeskPlaybookIds.has(id))
      return next.length === previous.length ? previous : next
    })

    setActivePhasesByPlaybookId((previous) => {
      const validDeskPlaybookIds = new Set([
        ...history.map((item) => item.id),
        ...sharedWithMe.map((item) => item.id),
      ])
      const nextEntries = Object.entries(previous).filter(([playbookId]) => {
        if (playbookId === CURRENT_PLAYBOOK_PHASE_KEY) return true
        return validDeskPlaybookIds.has(playbookId)
      })

      if (nextEntries.length === Object.keys(previous).length) return previous
      return Object.fromEntries(nextEntries)
    })
  }, [history, sharedWithMe])

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
    const targetId = folderShareTargetId?.trim()
    if (!targetId) return
    const exists = folders.some((folder) => folder.id === targetId)
    if (!exists) {
      closeFolderShareModal()
    }
  }, [closeFolderShareModal, folderShareTargetId, folders])

  useEffect(() => {
    if (!folderShareTargetId) return
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFolderShareModal()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [closeFolderShareModal, folderShareTargetId])

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (isCommunityDrawerOpen) {
        communityDrawerEdgeTouchStartXRef.current = null
        return
      }
      const touch = event.touches[0]
      if (!touch) {
        communityDrawerEdgeTouchStartXRef.current = null
        return
      }
      if (touch.clientX > COMMUNITY_DRAWER_EDGE_ACTIVATION_PX) {
        communityDrawerEdgeTouchStartXRef.current = null
        return
      }
      communityDrawerEdgeTouchStartXRef.current = touch.clientX
    }

    const handleTouchMove = (event: TouchEvent) => {
      const startX = communityDrawerEdgeTouchStartXRef.current
      if (startX === null) return
      const touch = event.touches[0]
      if (!touch) return
      if (touch.clientX - startX >= COMMUNITY_DRAWER_SWIPE_THRESHOLD_PX) {
        setIsCommunityDrawerOpen(true)
        communityDrawerEdgeTouchStartXRef.current = null
      }
    }

    const resetTouchTracking = () => {
      communityDrawerEdgeTouchStartXRef.current = null
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', resetTouchTracking, { passive: true })
    window.addEventListener('touchcancel', resetTouchTracking, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', resetTouchTracking)
      window.removeEventListener('touchcancel', resetTouchTracking)
    }
  }, [isCommunityDrawerOpen])

  useEffect(() => {
    if (!isCommunityDrawerOpen && !isHistoryDrawerOpen) return
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCommunityDrawerOpen(false)
        setIsHistoryDrawerOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [isCommunityDrawerOpen, isHistoryDrawerOpen])

  useEffect(() => {
    if (historyView === 'list') return
    setIsHistoryDrawerOpen(false)
  }, [historyView])

  useEffect(() => {
    const closeDrawerOnWideViewport = () => {
      if (window.innerWidth >= DESK_SIDE_TABS_MIN_WIDTH_PX) {
        setIsHistoryDrawerOpen(false)
      }
    }

    closeDrawerOnWideViewport()
    window.addEventListener('resize', closeDrawerOnWideViewport)
    return () => {
      window.removeEventListener('resize', closeDrawerOnWideViewport)
    }
  }, [])

  useEffect(() => {
    if (!shouldScrollToResult || isProcessing || !result) return

    const anchor = resultAnchorRef.current
    if (!anchor) return

    window.requestAnimationFrame(() => {
      slowScrollToElement(anchor)
      setShouldScrollToResult(false)
    })
  }, [isProcessing, result, shouldScrollToResult])

  useEffect(() => {
    if (!pendingStackedScrollPlaybookId) return

    const stackedPlaybookElement = document.getElementById(
      `stacked-playbook-${pendingStackedScrollPlaybookId}`
    )
    if (!stackedPlaybookElement) return

    window.requestAnimationFrame(() => {
      slowScrollToElement(stackedPlaybookElement, 1500)
      setPendingStackedScrollPlaybookId(null)
    })
  }, [pendingStackedScrollPlaybookId, stackedResultIds])

  const handleScrollToHistory = useCallback(() => {
    if (historyView === 'list') {
      if (window.innerWidth < DESK_SIDE_TABS_MIN_WIDTH_PX) {
        setIsHistoryDrawerOpen(true)
      } else if (resultAnchorRef.current) {
        slowScrollToElement(resultAnchorRef.current, 1200)
      }
      return
    }
    const anchor = historyAnchorRef.current
    if (!anchor) return
    window.requestAnimationFrame(() => {
      slowScrollToElement(anchor, 1500)
    })
  }, [historyView])

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

    const upgradeStatus = searchParams.get('upgrade')
    if (upgradeStatus === 'success') {
      const planName = searchParams.get('plan') ?? ''
      const label = planName ? planName.charAt(0).toUpperCase() + planName.slice(1) : ''
      setNotice(label ? `${t(lang, 'app.welcomePlan')} ${label}${t(lang, 'app.welcomePlanSuffix')}` : t(lang, 'app.subscriptionActivated'))
    }

    const notionStatus = searchParams.get('notion')
    if (notionStatus === 'connected') {
      setNotice(t(lang, 'app.notionConnected'))
      void loadNotionStatus()
    } else if (notionStatus === 'auth_required') {
      setError(t(lang, 'app.sessionExpired'))
    } else if (notionStatus === 'connect_denied') {
      setError(t(lang, 'app.notionCanceled'))
    } else if (notionStatus === 'invalid_state') {
      setError(t(lang, 'app.notionStateError'))
    } else if (notionStatus === 'not_configured') {
      setError(t(lang, 'app.notionNotConfigured'))
    } else if (notionStatus === 'error') {
      setError(t(lang, 'app.notionError'))
    }

    const todoistStatus = searchParams.get('todoist')
    if (todoistStatus === 'connected') {
      setNotice(t(lang, 'app.todoistConnected'))
      void loadTodoistStatus()
    } else if (todoistStatus === 'auth_required') {
      setError(t(lang, 'app.sessionExpired'))
    } else if (todoistStatus === 'connect_denied') {
      setError(t(lang, 'app.todoistCanceled'))
    } else if (todoistStatus === 'invalid_state') {
      setError(t(lang, 'app.todoistStateError'))
    } else if (todoistStatus === 'not_configured') {
      setError(t(lang, 'app.todoistNotConfigured'))
    } else if (todoistStatus === 'error') {
      setError(t(lang, 'app.todoistError'))
    }

    const googleStatus = searchParams.get('gdocs')
    if (googleStatus === 'connected') {
      setNotice(t(lang, 'app.googleDocsConnected'))
      void loadGoogleDocsStatus()
    } else if (googleStatus === 'auth_required') {
      setError(t(lang, 'app.sessionExpired'))
    } else if (googleStatus === 'connect_denied') {
      setError(t(lang, 'app.googleDocsCanceled'))
    } else if (googleStatus === 'invalid_state') {
      setError(t(lang, 'app.googleDocsStateError'))
    } else if (googleStatus === 'not_configured') {
      setError(t(lang, 'app.googleDocsNotConfigured'))
    } else if (googleStatus === 'error') {
      setError(t(lang, 'app.googleDocsError'))
    }

    const trelloStatus = searchParams.get('trello')
    if (trelloStatus === 'auth_required') {
      setError(t(lang, 'app.sessionExpired'))
      return
    }
    if (trelloStatus === 'not_configured') {
      setError(t(lang, 'app.trelloNotConfigured'))
      return
    }
    if (trelloStatus === 'error') {
      setError(t(lang, 'app.trelloError'))
      return
    }
    if (trelloStatus !== 'token') return
    if (trelloLoading) return

    const trelloState = searchParams.get('trello_state') ?? ''
    const rawHash = typeof window !== 'undefined' ? window.location.hash : ''
    const hashParams = new URLSearchParams(rawHash.startsWith('#') ? rawHash.slice(1) : rawHash)
    const trelloToken = hashParams.get('token')?.trim() ?? ''

    if (!trelloState || !trelloToken) {
      setError(t(lang, 'app.trelloTokenError'))
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
          setError(t(lang, 'app.sessionExpired'))
          return
        }

        const data = (await res.json().catch(() => null)) as
          | { error?: unknown }
          | null
        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : t(lang, 'app.trelloError')
          setError(message)
          return
        }

        setNotice(t(lang, 'app.trelloConnected'))
        void loadTrelloStatus()
      } catch {
        setError(t(lang, 'app.trelloOAuthError'))
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
      setError(t(lang, 'app.mustSignIn'))
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
        sourceFileName: uploadedFile.sourceFileName,
        sourceFileSizeBytes: uploadedFile.sourceFileSizeBytes,
        sourceFileMimeType: uploadedFile.sourceFileMimeType,
        sourceFileUrl: uploadedFile.sourceFileUrl,
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
    setRateLimitExceeded(false)
    setRateLimitMessage(null)
    setResult(null)
    setStackedResultIds([])
    setActivePhasesByPlaybookId({})
    setPendingStackedScrollPlaybookId(null)
    setIsResultBookClosed(false)
    setShareCopied(false)
    setStreamStatus(`${t(lang, 'app.extracting')} (${getExtractionModeLabel(extractionModeToUse)})...`)
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
            phases: normalizePlaybookPhases((payload as { phases?: unknown }).phases),
            mode: resolvedMode,
            shareVisibility: resolvedShareVisibility,
            accessRole: 'owner',
          })
          setResultAccessRole('owner')
          setCircleMembers([])
          setIsResultBookClosed(false)
          setExtractionMode(resolvedMode)
          setShareCopied(false)
          setActivePhasesByPlaybookId({})
          setStackedResultIds([])
          setPendingStackedScrollPlaybookId(null)
          setError(null)
          setStreamStatus(fromCache ? t(lang, 'app.resultFromCache') : t(lang, 'app.extractionComplete'))
          setNotice(
            fromCache
              ? t(lang, 'app.fromCache')
              : t(lang, 'app.newExtraction')
          )
          streamHadResult = true
          if (!fromCache) {
            setRateLimitUsed((prev) => prev !== null ? prev + 1 : null)
            setRateLimitExceeded(false)
            setRateLimitMessage(null)
          }
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
            setError(t(lang, 'app.connectionError'))
          }
        } else {
          setError(t(lang, 'app.connectionError'))
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
        setError(t(lang, 'app.sessionExpired'))
        return
      }

      if (!res.ok) {
        let apiError = t(lang, 'app.connectionError')
        try {
          const data = (await res.json()) as { error?: unknown }
          if (typeof data.error === 'string' && data.error.trim()) {
            apiError = data.error
          }
        } catch {
          // noop
        }
        if (res.status === 429) {
          setRateLimitExceeded(true)
          setRateLimitMessage(apiError)
          setError(null)
          return
        }
        setError(apiError)
        return
      }

      if (!res.body) {
        setError(t(lang, 'app.streamFailed'))
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
        setError(t(lang, 'app.streamNoResult'))
      }
    } catch {
      setError(t(lang, 'app.connectionErrorRetry'))
    } finally {
      setIsProcessing(false)
      setStreamStatus(null)
      setStreamPreview('')
      if (!streamHadResult) {
        setShouldScrollToResult(false)
      }
    }
  }

  const togglePhaseForPlaybook = useCallback((playbookId: string | null | undefined, phaseId: number) => {
    const phaseKey = resolvePlaybookPhaseKey(playbookId)
    setActivePhasesByPlaybookId((previous) => {
      const currentPhase = previous[phaseKey] ?? null
      return {
        ...previous,
        [phaseKey]: currentPhase === phaseId ? null : phaseId,
      }
    })
  }, [])

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
    setNotice(t(lang, 'app.markdownCopied'))
  }

  const handleCopyShareLink = async () => {
    if (resultAccessRole !== 'owner') {
      setError(t(lang, 'app.onlyOwnerShare'))
      return
    }
    if (!result?.id || shareLoading) return
    if (!isShareVisibilityShareable(normalizeShareVisibility(result.shareVisibility))) {
      setError(t(lang, 'app.notShareable'))
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
        setError(t(lang, 'app.sessionExpired'))
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
              ? t(lang, 'app.notShareable')
            : t(lang, 'app.shareLinkError')
        setError(message)
        return
      }

      const token = typeof data?.token === 'string' ? data.token : ''
      if (!token) {
        setError(t(lang, 'app.shareLinkError'))
        return
      }

      const shareUrl = `${window.location.origin}/share/${token}`
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2500)
    } catch {
      setError(t(lang, 'app.shareLinkCopyError'))
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShareLinkFromHistory = async (item: HistoryItem) => {
    const extractionId = item.id?.trim()
    if (!extractionId || historyShareLoadingItemId) return
    if (!isShareVisibilityShareable(normalizeShareVisibility(item.shareVisibility))) {
      setError(t(lang, 'app.notShareable'))
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
        setError(t(lang, 'app.sessionExpired'))
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
              ? t(lang, 'app.notShareable')
            : t(lang, 'app.shareLinkError')
        setError(message)
        return
      }

      const token = typeof data?.token === 'string' ? data.token : ''
      if (!token) {
        setError(t(lang, 'app.shareLinkError'))
        return
      }

      const shareUrl = `${window.location.origin}/share/${token}`
      await navigator.clipboard.writeText(shareUrl)
      setHistoryShareCopiedItemId(extractionId)
      setNotice(t(lang, 'app.shareLinkCopied'))
      window.setTimeout(() => {
        setHistoryShareCopiedItemId((current) => (current === extractionId ? null : current))
      }, 2500)
    } catch {
      setError(t(lang, 'app.shareLinkCopyError'))
    } finally {
      setHistoryShareLoadingItemId((current) => (current === extractionId ? null : current))
    }
  }

  const handleUpdateShareVisibility = async (nextVisibility: ShareVisibility) => {
    if (resultAccessRole !== 'owner') {
      setError(t(lang, 'app.onlyOwnerVisibility'))
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
        setError(t(lang, 'app.sessionExpired'))
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
            : t(lang, 'app.visibilityError')
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
      setError(t(lang, 'app.visibilityError'))
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
        if (!res.ok) { setError(data?.error ?? t(lang, 'app.infoUpdated')); return false }
        setResult((prev) =>
          !prev || prev.id !== extractionId ? prev : {
            ...prev,
            videoTitle: data?.videoTitle ?? meta.title,
            sourceLabel: data?.sourceLabel ?? meta.title,
            thumbnailUrl: data?.thumbnailUrl ?? meta.thumbnailUrl,
            objective: data?.objective ?? meta.objective,
          }
        )
        setNotice(t(lang, 'app.infoUpdated'))
        void loadHistory()
        return true
      } catch {
        setError(t(lang, 'app.saveConnectionError'))
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
        const data = (await res.json().catch(() => null)) as
          | { folderId?: unknown; error?: unknown }
          | null
        if (!res.ok) {
          setError(
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : t(lang, 'app.folderAssignError')
          )
          return
        }
        const persistedFolderId =
          typeof data?.folderId === 'string' && data.folderId.trim()
            ? data.folderId.trim()
            : folderId
        setError(null)
        setHistory((prev) =>
          prev.map((item) => (item.id === extractionId ? { ...item, folderId: persistedFolderId } : item))
        )
        setResult((prev) =>
          prev && prev.id === extractionId ? { ...prev, folderId: persistedFolderId } : prev
        )
      } catch {
        setError(t(lang, 'app.folderAssignError'))
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
          setError(t(lang, 'app.sessionExpired'))
          return false
        }

        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        if (!res.ok) {
          setError(
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : t(lang, 'app.memberAddError')
          )
          return false
        }

        await loadCircleMembers(extractionId)
        setNotice(t(lang, 'app.memberAdded'))
        return true
      } catch {
        setError(t(lang, 'app.memberAddError'))
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
          setError(t(lang, 'app.sessionExpired'))
          return false
        }

        const data = (await res.json().catch(() => null)) as { error?: unknown } | null
        if (!res.ok) {
          setError(
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : t(lang, 'app.memberRemoveError')
          )
          return false
        }

        await loadCircleMembers(extractionId)
        setNotice(t(lang, 'app.memberRemoved'))
        return true
      } catch {
        setError(t(lang, 'app.memberRemoveError'))
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
        setError(t(lang, 'app.saveNotInHistory'))
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
          setError(t(lang, 'app.sessionExpired'))
          return false
        }

        const data = (await res.json().catch(() => null)) as
          | { phases?: unknown; error?: unknown }
          | null

        if (!res.ok) {
          const message =
            typeof data?.error === 'string' && data.error.trim()
              ? data.error
              : t(lang, 'app.saveContentError')
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
        setActivePhasesByPlaybookId((previous) => {
          const phaseKey = resolvePlaybookPhaseKey(extractionId)
          if (!(phaseKey in previous)) return previous
          return {
            ...previous,
            [phaseKey]: null,
          }
        })
        setNotice(t(lang, 'app.infoUpdated'))
        void loadHistory()
        return true
      } catch {
        setError(t(lang, 'app.saveContentError'))
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
        concept_map: 'mapa-conceptual',
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
        hour12: true,
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

        flattenItemsAsText(phase.items).forEach((item) => {
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
      setError(t(lang, 'app.pdfError'))
    } finally {
      setIsExportingPdf(false)
    }
  }

  const mapHistoryItemToResult = useCallback((item: HistoryItem): ExtractResult => {
    const mode = normalizeExtractionMode(item.mode)
    return {
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
      phases: normalizePlaybookPhases(item.phases),
      proTip: item.proTip,
      metadata: item.metadata,
      sourceType: item.sourceType,
      sourceLabel: item.sourceLabel ?? null,
      sourceFileUrl: item.sourceFileUrl ?? null,
      sourceFileName: item.sourceFileName ?? null,
      sourceFileSizeBytes: item.sourceFileSizeBytes ?? null,
      sourceFileMimeType: item.sourceFileMimeType ?? null,
      hasSourceText: item.hasSourceText ?? false,
      isStarred: item.isStarred ?? false,
      accessRole: 'owner',
      ownerName: user?.name ?? null,
      ownerEmail: user?.email ?? null,
    }
  }, [user?.email, user?.name])

  const mapSharedItemToResult = useCallback((item: SharedExtractionItem): ExtractResult => {
    const mode = normalizeExtractionMode(item.mode)
    return {
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
      phases: normalizePlaybookPhases(item.phases),
      proTip: item.proTip,
      metadata: item.metadata,
      sourceType: item.sourceType,
      sourceLabel: item.sourceLabel ?? null,
      sourceFileUrl: item.sourceFileUrl ?? null,
      sourceFileName: item.sourceFileName ?? null,
      sourceFileSizeBytes: item.sourceFileSizeBytes ?? null,
      sourceFileMimeType: item.sourceFileMimeType ?? null,
      hasSourceText: item.hasSourceText ?? false,
      accessRole: item.accessRole,
      ownerName: item.ownerName,
      ownerEmail: item.ownerEmail,
    }
  }, [])

  const openHistoryItem = (item: HistoryItem) => {
    const mode = normalizeExtractionMode(item.mode)
    setUrl(item.url ?? '')
    setUploadedFile(null)
    setExtractionMode(mode)
    setResult(mapHistoryItemToResult(item))
    setStackedResultIds([])
    setPendingStackedScrollPlaybookId(null)
    setResultAccessRole('owner')
    setCircleMembers([])
    if (item.id) {
      void loadCircleMembers(item.id)
    }
    setIsResultBookClosed(false)
    setActivePhasesByPlaybookId({})
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
    setResult(mapSharedItemToResult(item))
    setStackedResultIds([])
    setPendingStackedScrollPlaybookId(null)
    setResultAccessRole(item.accessRole)
    setCircleMembers([])
    setIsResultBookClosed(false)
    setActivePhasesByPlaybookId({})
    setError(null)
    setShareCopied(false)
    setShareVisibilityLoading(false)
    setStreamStatus(null)
    setStreamPreview('')
    setShouldScrollToResult(true)
  }

  const openPublicPlaybookFromSearch = useCallback(async (playbookIdRaw: string) => {
    const playbookId = playbookIdRaw.trim()
    if (!playbookId) return

    const res = await fetch(`/api/public-playbooks/${encodeURIComponent(playbookId)}`, {
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => null)) as PublicPlaybookDetailResponse | null
    if (!res.ok) {
      throw new Error(parseApiErrorMessage(data, 'No se pudo abrir el playbook público.'))
    }

    const item = data?.item
    if (!item) {
      throw new Error('Respuesta inesperada del servidor al abrir el playbook público.')
    }

    const mode = normalizeExtractionMode(item.mode)
    const accessRole = item.accessRole === 'owner' || item.accessRole === 'editor' ? item.accessRole : 'viewer'
    setUrl(item.url ?? '')
    setUploadedFile(null)
    setExtractionMode(mode)
    setResult({
      ...item,
      mode,
      objective: typeof item.objective === 'string' ? item.objective : '',
      phases: normalizePlaybookPhases(item.phases),
    })
    setStackedResultIds([])
    setPendingStackedScrollPlaybookId(null)
    setResultAccessRole(accessRole)
    setCircleMembers([])
    setIsResultBookClosed(false)
    setActivePhasesByPlaybookId({})
    setError(null)
    setShareCopied(false)
    setShareVisibilityLoading(false)
    setStreamStatus(null)
    setStreamPreview('')
    setShouldScrollToResult(true)
  }, [])

  const resolveHistoryPlaybookByIdentifier = useCallback((identifierRaw: string): HistoryItem | null => {
    const identifier = identifierRaw.trim()
    if (!identifier) return null

    const directIdMatch = history.find((item) => item.id.trim() === identifier)
    if (directIdMatch) return directIdMatch

    const normalizedIdentifier = identifier.toLowerCase()
    const caseInsensitiveIdMatch = history.find(
      (item) => item.id.trim().toLowerCase() === normalizedIdentifier
    )
    if (caseInsensitiveIdMatch) return caseInsensitiveIdMatch

    const orderToken = identifier.startsWith('#') ? identifier.slice(1) : identifier
    const parsedOrder = Number.parseInt(orderToken, 10)
    if (!Number.isNaN(parsedOrder)) {
      const orderMatch = history.find((item) => item.orderNumber === parsedOrder)
      if (orderMatch) return orderMatch
    }

    const exactTitleMatches = history.filter(
      (item) => resolvePlaybookDisplayTitle(item).trim().toLowerCase() === normalizedIdentifier
    )
    if (exactTitleMatches.length === 1) return exactTitleMatches[0]

    const partialTitleMatches = history.filter((item) =>
      resolvePlaybookDisplayTitle(item).trim().toLowerCase().includes(normalizedIdentifier)
    )
    if (partialTitleMatches.length === 1) return partialTitleMatches[0]

    return null
  }, [history])

  const resolveSharedPlaybookByIdentifier = useCallback((identifierRaw: string): SharedExtractionItem | null => {
    const identifier = identifierRaw.trim()
    if (!identifier) return null

    const directIdMatch = sharedWithMe.find((item) => item.id.trim() === identifier)
    if (directIdMatch) return directIdMatch

    const normalizedIdentifier = identifier.toLowerCase()
    const caseInsensitiveIdMatch = sharedWithMe.find(
      (item) => item.id.trim().toLowerCase() === normalizedIdentifier
    )
    if (caseInsensitiveIdMatch) return caseInsensitiveIdMatch

    const orderToken = identifier.startsWith('#') ? identifier.slice(1) : identifier
    const parsedOrder = Number.parseInt(orderToken, 10)
    if (!Number.isNaN(parsedOrder)) {
      const orderMatch = sharedWithMe.find((item) => item.orderNumber === parsedOrder)
      if (orderMatch) return orderMatch
    }

    const exactTitleMatches = sharedWithMe.filter(
      (item) => resolvePlaybookDisplayTitle(item).trim().toLowerCase() === normalizedIdentifier
    )
    if (exactTitleMatches.length === 1) return exactTitleMatches[0]

    const partialTitleMatches = sharedWithMe.filter((item) =>
      resolvePlaybookDisplayTitle(item).trim().toLowerCase().includes(normalizedIdentifier)
    )
    if (partialTitleMatches.length === 1) return partialTitleMatches[0]

    return null
  }, [sharedWithMe])

  const resolveDeskPlaybookById = useCallback((playbookIdRaw: string): ResolvedDeskPlaybook | null => {
    const playbookId = playbookIdRaw.trim()
    if (!playbookId) return null

    const ownPlaybook = history.find((item) => item.id === playbookId)
    if (ownPlaybook) {
      return {
        source: 'mine',
        id: ownPlaybook.id,
        historyItem: ownPlaybook,
      }
    }

    const sharedPlaybook = sharedWithMe.find((item) => item.id === playbookId)
    if (sharedPlaybook) {
      return {
        source: 'shared',
        id: sharedPlaybook.id,
        sharedItem: sharedPlaybook,
      }
    }

    return null
  }, [history, sharedWithMe])

  const resolveDeskPlaybookByIdentifier = useCallback((
    identifierRaw: string,
    preferredSource: 'mine' | 'shared' = 'mine'
  ): ResolvedDeskPlaybook | null => {
    if (preferredSource === 'shared') {
      const sharedCandidate = resolveSharedPlaybookByIdentifier(identifierRaw)
      if (sharedCandidate) {
        return { source: 'shared', id: sharedCandidate.id, sharedItem: sharedCandidate }
      }
      const fallbackOwnCandidate = resolveHistoryPlaybookByIdentifier(identifierRaw)
      if (fallbackOwnCandidate) {
        return { source: 'mine', id: fallbackOwnCandidate.id, historyItem: fallbackOwnCandidate }
      }
      return null
    }

    const ownCandidate = resolveHistoryPlaybookByIdentifier(identifierRaw)
    if (ownCandidate) {
      return { source: 'mine', id: ownCandidate.id, historyItem: ownCandidate }
    }
    const fallbackSharedCandidate = resolveSharedPlaybookByIdentifier(identifierRaw)
    if (fallbackSharedCandidate) {
      return { source: 'shared', id: fallbackSharedCandidate.id, sharedItem: fallbackSharedCandidate }
    }
    return null
  }, [resolveHistoryPlaybookByIdentifier, resolveSharedPlaybookByIdentifier])

  const openDeskPlaybookByIdentifier = (
    identifierRaw: string,
    preferredSource: 'mine' | 'shared' = 'mine'
  ) => {
    const identifier = identifierRaw.trim()
    if (!identifier) return

    const resolvedPlaybook = resolveDeskPlaybookByIdentifier(identifier, preferredSource)
    if (!resolvedPlaybook) {
      setNotice(`${t(lang, 'app.playbookNotFound')} "${identifier}".`)
      return
    }

    const playbookIdNormalized = resolvedPlaybook.id.trim()
    const currentResultId = result?.id?.trim() ?? ''

    if (!result) {
      if (resolvedPlaybook.source === 'mine') {
        openHistoryItem(resolvedPlaybook.historyItem)
      } else {
        openSharedItem(resolvedPlaybook.sharedItem)
      }
      return
    }

    if (!playbookIdNormalized) return

    if (playbookIdNormalized === currentResultId) {
      const anchor = resultAnchorRef.current
      if (anchor) {
        window.requestAnimationFrame(() => {
          slowScrollToElement(anchor, 1200)
        })
      }
      return
    }

    if (stackedResultIds.includes(playbookIdNormalized)) {
      setPendingStackedScrollPlaybookId(playbookIdNormalized)
      return
    }

    setStackedResultIds((previous) =>
      previous.includes(playbookIdNormalized) ? previous : [...previous, playbookIdNormalized]
    )
    setPendingStackedScrollPlaybookId(playbookIdNormalized)
  }

  const scrollToDeskPlaybook = useCallback(
    (playbookId: string) => {
      const id = playbookId.trim()
      if (!id) return

      const currentMainId = result?.id?.trim() || (result ? CURRENT_PLAYBOOK_PHASE_KEY : '')
      if (id === currentMainId) {
        const anchor = resultAnchorRef.current
        if (!anchor) return
        window.requestAnimationFrame(() => {
          slowScrollToElement(anchor, 1200)
        })
        return
      }

      const target = document.getElementById(`stacked-playbook-${id}`)
      if (!target) return
      window.requestAnimationFrame(() => {
        slowScrollToElement(target, 1200)
      })
    },
    [result]
  )

  const closeDeskPlaybook = useCallback(
    (playbookId: string) => {
      const id = playbookId.trim()
      if (!id) return

      const currentMainId = result?.id?.trim() || (result ? CURRENT_PLAYBOOK_PHASE_KEY : '')
      const stackedCandidates = stackedResultIds
        .map((stackedId) => resolveDeskPlaybookById(stackedId))
        .filter((item): item is ResolvedDeskPlaybook => Boolean(item))

      if (id === currentMainId) {
        if (stackedCandidates.length > 0) {
          const [nextMain, ...remainingStack] = stackedCandidates
          if (nextMain.source === 'mine') {
            openHistoryItem(nextMain.historyItem)
          } else {
            openSharedItem(nextMain.sharedItem)
          }
          setStackedResultIds(remainingStack.map((item) => item.id))
        } else {
          setResult(null)
          setCircleMembers([])
          setResultAccessRole('owner')
          setIsResultBookClosed(false)
        }
      } else {
        setStackedResultIds((previous) => previous.filter((stackedId) => stackedId !== id))
      }

      setPendingStackedScrollPlaybookId((previous) => (previous === id ? null : previous))
      setActivePhasesByPlaybookId((previous) => {
        if (!(id in previous)) return previous
        const next = { ...previous }
        delete next[id]
        return next
      })
    },
    [openHistoryItem, openSharedItem, resolveDeskPlaybookById, result, stackedResultIds]
  )

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
    setStackedResultIds((previous) => previous.filter((id) => id !== extractionId))
    setPendingStackedScrollPlaybookId((previous) => (previous === extractionId ? null : previous))
    setActivePhasesByPlaybookId((previous) => {
      if (!(extractionId in previous)) return previous
      const next = { ...previous }
      delete next[extractionId]
      return next
    })
    setShareCopied(false)
  }, [])

  const handleDeleteHistoryItem = useCallback(
    async (item: HistoryItem) => {
      const title = item.videoTitle?.trim() || item.sourceLabel?.trim() || item.objective?.trim() || item.url || t(lang, 'app.noSource')
      const confirmed =
        typeof window === 'undefined'
          ? false
          : window.confirm(`${t(lang, 'app.confirmDeleteExtraction')}\n\n${title}`)
      if (!confirmed) return

      setError(null)
      setNotice(null)

      const result = await removeHistoryItem(item.id)
      if (result.unauthorized) {
        handleUnauthorized()
        setError(t(lang, 'app.sessionExpired'))
        return
      }

      if (!result.ok) {
        setError(result.error ?? t(lang, 'app.deletionError'))
        return
      }

      detachCurrentResultFromHistory(item.id)
      setNotice(t(lang, 'app.extractionDeleted'))
    },
    [detachCurrentResultFromHistory, handleUnauthorized, removeHistoryItem]
  )

  const handleClearHistory = useCallback(async () => {
    if (history.length === 0) return

    const confirmed =
      typeof window === 'undefined'
        ? false
        : window.confirm(t(lang, 'app.confirmClearHistory'))
    if (!confirmed) return

    setError(null)
    setNotice(null)

    const result = await clearAllHistory()
    if (result.unauthorized) {
      handleUnauthorized()
      setError(t(lang, 'app.sessionExpired'))
      return
    }

    if (!result.ok) {
      setError(result.error ?? t(lang, 'app.clearHistoryError'))
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
    setStackedResultIds([])
    setActivePhasesByPlaybookId({})
    setPendingStackedScrollPlaybookId(null)
    setHistoryShareCopiedItemId(null)
    setHistoryShareLoadingItemId(null)

    const deletedCount =
      typeof result.deletedCount === 'number' && result.deletedCount > 0
        ? ` (${result.deletedCount})`
        : ''
    setNotice(`${t(lang, 'app.historyCleared')}${deletedCount}.`)
  }, [clearAllHistory, handleUnauthorized, history.length])

  const filteredHistoryForActiveFolders = (() => {
    let items = activeFolderIds.length > 0
      ? filteredHistory.filter((item) => item.folderId != null && activeFolderIds.includes(item.folderId))
      : filteredHistory
    if (activeTagIds.length > 0) {
      items = items.filter((item) =>
        activeTagIds.every((tid) => (item.tags ?? []).some((t) => t.id === tid))
      )
    }
    return items
  })()
  const allFolders = useMemo<FolderItem[]>(() => {
    const byId = new Map<string, FolderItem>()
    for (const folder of folders) {
      byId.set(folder.id, folder)
    }
    for (const folder of sharedFolders) {
      if (!byId.has(folder.id)) {
        byId.set(folder.id, folder)
      }
    }
    return Array.from(byId.values())
  }, [folders, sharedFolders])
  const folderPlaybooks = useMemo<FolderPlaybookItem[]>(
    () => [
      ...history.map((item) => ({
        id: item.id,
        folderId: item.folderId ?? null,
        title: resolvePlaybookDisplayTitle(item),
        subtitle: item.url ?? item.sourceLabel ?? null,
        createdAt: item.createdAt,
        source: 'mine' as const,
        ownerName: user?.name ?? null,
        ownerEmail: user?.email ?? null,
      })),
      ...sharedWithMe.map((item) => ({
        id: item.id,
        folderId: item.folderId ?? null,
        title: resolvePlaybookDisplayTitle(item),
        subtitle: item.url ?? item.sourceLabel ?? null,
        createdAt: item.createdAt,
        source: 'shared' as const,
        ownerName: item.ownerName ?? null,
        ownerEmail: item.ownerEmail ?? null,
      })),
    ],
    [history, sharedWithMe, user?.email, user?.name]
  )
  const stackedDeskPlaybooks = useMemo(
    () =>
      stackedResultIds
        .map((id) => resolveDeskPlaybookById(id))
        .filter((item): item is ResolvedDeskPlaybook => Boolean(item)),
    [resolveDeskPlaybookById, stackedResultIds]
  )
  const hasMultipleDeskPlaybooksOpen = Boolean(result) && stackedDeskPlaybooks.length > 0
  const openDeskPlaybooks = useMemo<OpenDeskPlaybookItem[]>(
    () => {
      if (!result) return []

      const mainPlaybookId = result.id?.trim() || CURRENT_PLAYBOOK_PHASE_KEY
      return [
        {
          id: mainPlaybookId,
          title: resolvePlaybookDisplayTitle(result),
          isMain: true,
        },
        ...stackedDeskPlaybooks.map((item) => ({
          id: item.id,
          title: resolvePlaybookDisplayTitle(
            item.source === 'mine' ? item.historyItem : item.sharedItem
          ),
          isMain: false,
        })),
      ]
    },
    [result, stackedDeskPlaybooks]
  )
  const folderCounts = useMemo(() => {
    const nextCounts: Record<string, number> = {}
    for (const playbook of folderPlaybooks) {
      const folderId = playbook.folderId?.trim()
      if (!folderId) continue
      nextCounts[folderId] = (nextCounts[folderId] ?? 0) + 1
    }
    return nextCounts
  }, [folderPlaybooks])
  const folderShareTargetFolder = useMemo(() => {
    const id = folderShareTargetId?.trim()
    if (!id) return null
    return folders.find((folder) => folder.id === id) ?? null
  }, [folderShareTargetId, folders])
  const getFolderLabelById = useCallback(
    (folderId: string | null | undefined) => {
      if (!folderId) return 'General'
      return allFolders.find((folder) => folder.id === folderId)?.name ?? 'General'
    },
    [allFolders]
  )
  const normalizedGlobalPlaybookQuery = useMemo(
    () => normalizeSearchText(globalPlaybookQuery).trim(),
    [globalPlaybookQuery]
  )
  const globalPlaybookSearchHits = useMemo<GlobalPlaybookSearchHit[]>(() => {
    if (!normalizedGlobalPlaybookQuery) return []

    const ownHits: GlobalPlaybookSearchHit[] = history
      .filter((item) => {
        const title = resolvePlaybookDisplayTitle(item)
        const searchable = normalizeSearchText(
          [
            item.id,
            item.orderNumber ? `#${item.orderNumber}` : '',
            title,
            item.objective ?? '',
            item.sourceLabel ?? '',
            item.videoTitle ?? '',
            item.url ?? '',
            getFolderLabelById(item.folderId),
            getExtractionModeLabel(normalizeExtractionMode(item.mode)),
            formatHistoryDate(item.createdAt),
          ].join(' ')
        )
        return searchable.includes(normalizedGlobalPlaybookQuery)
      })
      .map((item) => {
        const title = resolvePlaybookDisplayTitle(item)
        const folderLabel = getFolderLabelById(item.folderId)
        return {
          key: `mine-${item.id}`,
          source: 'mine' as const,
          id: item.id,
          title,
          subtitle: item.url ?? item.sourceLabel ?? '',
          helper: `${folderLabel} · ${item.orderNumber ? `#${item.orderNumber}` : 'Sin #'} · ${formatHistoryDate(item.createdAt)}`,
          historyItem: item,
        }
      })

    const sharedHits: GlobalPlaybookSearchHit[] = sharedWithMe
      .filter((item) => {
        const title = resolvePlaybookDisplayTitle(item)
        const searchable = normalizeSearchText(
          [
            item.id,
            item.orderNumber ? `#${item.orderNumber}` : '',
            title,
            item.objective ?? '',
            item.sourceLabel ?? '',
            item.videoTitle ?? '',
            item.url ?? '',
            item.ownerName ?? '',
            item.ownerEmail ?? '',
            item.accessRole,
            getFolderLabelById(item.folderId),
            getExtractionModeLabel(normalizeExtractionMode(item.mode)),
            formatHistoryDate(item.createdAt),
          ].join(' ')
        )
        return searchable.includes(normalizedGlobalPlaybookQuery)
      })
      .map((item) => ({
        key: `shared-${item.id}`,
        source: 'shared' as const,
        id: item.id,
        title: resolvePlaybookDisplayTitle(item),
        subtitle: item.url ?? item.sourceLabel ?? '',
        helper: `${item.accessRole === 'editor' ? 'Editor' : 'Viewer'} · Owner: ${item.ownerName?.trim() || item.ownerEmail || 'Sin datos'}`,
        sharedItem: item,
      }))

    return [...ownHits, ...sharedHits].slice(0, 30)
  }, [getFolderLabelById, history, normalizedGlobalPlaybookQuery, sharedWithMe])

  const openGlobalPlaybookHit = (hit: GlobalPlaybookSearchHit) => {
    openDeskPlaybookByIdentifier(hit.id, hit.source)
    setGlobalPlaybookQuery('')
  }

  const closeCommunityDrawer = useCallback(() => {
    setIsCommunityDrawerOpen(false)
  }, [])

  const closeHistoryDrawer = useCallback(() => {
    setIsHistoryDrawerOpen(false)
  }, [])

  const finishCommunityDrawerHandleGesture = useCallback((clientX: number) => {
    const gesture = communityDrawerHandleGestureRef.current
    if (!gesture) return

    const deltaX = clientX - gesture.startX
    if (Math.abs(deltaX) >= 8) {
      communityDrawerSuppressClickRef.current = true
    }

    if (!gesture.startOpen && deltaX >= COMMUNITY_DRAWER_SWIPE_THRESHOLD_PX) {
      setIsCommunityDrawerOpen(true)
    } else if (gesture.startOpen && deltaX <= -COMMUNITY_DRAWER_SWIPE_THRESHOLD_PX) {
      setIsCommunityDrawerOpen(false)
    }

    communityDrawerHandleGestureRef.current = null
  }, [])

  const handleCommunityDrawerHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      communityDrawerHandleGestureRef.current = {
        startX: event.clientX,
        startOpen: isCommunityDrawerOpen,
      }
    },
    [isCommunityDrawerOpen]
  )

  const handleCommunityDrawerHandlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      finishCommunityDrawerHandleGesture(event.clientX)
    },
    [finishCommunityDrawerHandleGesture]
  )

  const handleCommunityDrawerHandlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      communityDrawerHandleGestureRef.current = null
    },
    []
  )

  const toggleCommunityDrawer = useCallback(() => {
    if (communityDrawerSuppressClickRef.current) {
      communityDrawerSuppressClickRef.current = false
      return
    }
    setIsCommunityDrawerOpen((previous) => !previous)
  }, [])

  const toggleHistoryDrawer = useCallback(() => {
    setIsHistoryDrawerOpen((previous) => !previous)
  }, [])

  const handleSelectHistoryItemFromDrawer = (item: HistoryItem) => {
    openHistoryItem(item)
    setIsHistoryDrawerOpen(false)
  }

  // Rate limit + chat token quota fetch — runs once after user logs in
  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const [rlRes, ctRes] = await Promise.all([
          fetch('/api/account/rate-limit', { cache: 'no-store' }),
          fetch('/api/account/chat-tokens', { cache: 'no-store' }),
        ])
        if (!cancelled) {
          if (rlRes.ok) {
            const data = (await rlRes.json()) as { used?: number; limit?: number; extra_credits?: number; isUnlimited?: boolean }
            setHasUnlimitedExtractions(data.isUnlimited === true)
            if (typeof data.used === 'number') setRateLimitUsed(data.used)
            if (typeof data.limit === 'number') setRateLimitTotal(data.limit)
            if (typeof data.extra_credits === 'number') setExtraCredits(data.extra_credits)
          }
          if (ctRes.ok) {
            const data = (await ctRes.json()) as { used?: number; limit?: number }
            if (typeof data.used === 'number') setChatTokenUsed(data.used)
            if (typeof data.limit === 'number') setChatTokenLimit(data.limit)
          }
        }
      } catch {
        // non-critical, ignore
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const handleStarResult = useCallback(async (starred: boolean) => {
    if (!result?.id) return
    const extractionId = result.id
    try {
      const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/star`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred }),
      })
      if (!res.ok) return
      setResult((prev) => prev ? { ...prev, isStarred: starred } : prev)
      setHistory((prev) =>
        prev.map((item) => (item.id === extractionId ? { ...item, isStarred: starred } : item))
      )
    } catch {
      // non-critical
    }
  }, [result?.id, setHistory])

  const handleStarHistoryItem = useCallback(async (item: HistoryItem, starred: boolean) => {
    const extractionId = item.id
    try {
      const res = await fetch(`/api/extractions/${encodeURIComponent(extractionId)}/star`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred }),
      })
      if (!res.ok) return
      setHistory((prev) =>
        prev.map((h) => (h.id === extractionId ? { ...h, isStarred: starred } : h))
      )
      if (result?.id === extractionId) {
        setResult((prev) => prev ? { ...prev, isStarred: starred } : prev)
      }
    } catch {
      // non-critical
    }
  }, [result?.id, setHistory])

  useKeyboardShortcuts({
    onExtract: () => void handleExtract({}),
    onModeChange: setExtractionMode,
    onDownloadPdf: () => void handleDownloadPdf(),
    onCopyMarkdown: () => void handleCopyMarkdown(),
    onShowHelp: () => setShowShortcutsHelp(true),
    isProcessing,
    hasResult: result !== null,
  })

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <nav className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/98 shadow-[0_1px_4px_0_rgb(0,0,0,0.06)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-zinc-950/97 dark:shadow-[0_1px_4px_0_rgb(0,0,0,0.35)]">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">

          {/* ── Left: Logo + divider + nav links ── */}
          <div className="flex min-w-0 items-center">

            {/* Logo + title */}
            <div className="flex items-center gap-2.5 pr-4 md:pr-5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ring-2 ring-violet-500/30 dark:ring-violet-400/25">
                <NotesAideLogo
                  variant="mark"
                  className="h-8 w-8"
                  title="Notes Aide"
                />
              </div>
              <span className="hidden font-bold tracking-tight text-zinc-900 sm:inline dark:text-zinc-100">
                <span className="text-sm md:hidden">Notes Aide</span>
                <span className="hidden text-[15px] md:inline">Notes Aide</span>
              </span>
            </div>

            {/* Vertical divider */}
            <div className="hidden h-5 w-px shrink-0 bg-zinc-200 sm:block dark:bg-white/10" />

            {/* Nav links */}
            <div className="hidden items-center gap-0.5 pl-3 sm:flex md:pl-4">
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-all duration-150 hover:bg-violet-50 hover:text-violet-700 dark:text-zinc-400 dark:hover:bg-violet-950/50 dark:hover:text-violet-300"
                title={t(lang, 'app.plansTitle')}
              >
                {t(lang, 'app.plansLabel')}
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-all duration-150 hover:bg-violet-50 hover:text-violet-700 dark:text-zinc-400 dark:hover:bg-violet-950/50 dark:hover:text-violet-300"
                title={t(lang, 'app.myRoiTitle')}
              >
                <BarChart2 size={14} />
                {t(lang, 'app.myRoiLabel')}
              </Link>
            </div>
          </div>

          {/* ── Right: controls ── */}
          <div className="flex items-center gap-1 md:gap-1.5">
            {user ? (
              <>
                {/* Rate limit badge */}
                {!hasUnlimitedExtractions && rateLimitTotal !== null && rateLimitUsed !== null && (
                  <span
                    title={`${rateLimitTotal - rateLimitUsed} ${t(lang, 'app.rateLimitTooltip')} ${rateLimitTotal} ${t(lang, 'app.rateLimitDay')}${extraCredits ? ` · +${extraCredits} ${t(lang, 'app.extraCreditsLabel')}` : ''}`}
                    className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:flex ${
                      rateLimitTotal - rateLimitUsed <= 0 && !extraCredits
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'
                        : rateLimitTotal - rateLimitUsed <= 1
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        rateLimitTotal - rateLimitUsed <= 0 && !extraCredits
                          ? 'bg-rose-500'
                          : rateLimitTotal - rateLimitUsed <= 1
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                    />
                    Extr {t(lang, 'app.rateLimitDay')} {rateLimitTotal - rateLimitUsed} / {rateLimitTotal}
                    {extraCredits ? ` +${extraCredits}` : ''}
                  </span>
                )}

                {/* Chat token progress bar */}
                {chatTokenLimit !== null && chatTokenUsed !== null && (() => {
                  const remaining = chatTokenLimit - chatTokenUsed
                  const pct = chatTokenLimit > 0 ? Math.min(1, chatTokenUsed / chatTokenLimit) : 0
                  const isExhausted = remaining <= 0
                  const isWarning = !isExhausted && pct >= 0.8
                  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
                  const barColor = isExhausted ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-violet-500'
                  const textColor = isExhausted ? 'text-rose-600 dark:text-rose-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-violet-600 dark:text-violet-400'
                  return (
                    <div
                      title={`${fmt(Math.max(0, remaining))} tokens de chat restantes hoy · límite: ${fmt(chatTokenLimit)}`}
                      className="hidden sm:flex items-center gap-1.5"
                    >
                      <span className={`text-[11px] font-semibold ${textColor}`}>Chat</span>
                      <div className="w-14 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct * 100}%` }} />
                      </div>
                      <span className={`text-[11px] font-semibold tabular-nums ${textColor}`}>
                        {fmt(chatTokenUsed)}/{fmt(chatTokenLimit)}
                      </span>
                    </div>
                  )
                })()}

                {/* Theme toggle — icon only */}
                <button
                  onClick={toggleTheme}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-200"
                  aria-label={theme === 'dark' ? t(lang, 'app.themeLight') : t(lang, 'app.themeDark')}
                  title={theme === 'dark' ? t(lang, 'app.modeLight') : t(lang, 'app.modeDark')}
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>

                {/* Settings — icon only */}
                <Link
                  href="/settings"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-200"
                  title={t(lang, 'app.settings')}
                >
                  <Settings2 size={16} />
                </Link>

                {/* Keyboard shortcuts — icon only, md+ */}
                <button
                  type="button"
                  onClick={() => setShowShortcutsHelp(true)}
                  title={t(lang, 'app.shortcuts')}
                  aria-label={t(lang, 'app.shortcutsAria')}
                  className="hidden h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-zinc-500 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-800 md:inline-flex dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-200"
                >
                  ?
                </button>

                {/* Divider */}
                <div className="mx-1 hidden h-5 w-px shrink-0 bg-zinc-200 sm:block dark:bg-white/10" />

                {/* User name/email */}
                <span className="hidden max-w-[140px] truncate text-sm text-zinc-500 lg:inline dark:text-zinc-400">
                  {user.name ?? user.email}
                </span>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="ml-0.5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition-all duration-150 hover:from-violet-500 hover:to-violet-600 hover:shadow-lg hover:shadow-violet-500/25 md:px-4 dark:shadow-violet-900/30 dark:hover:shadow-violet-800/40"
                  title={t(lang, 'app.logout')}
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">{t(lang, 'app.logout')}</span>
                </button>

                {/* Language toggle */}
                <button
                  type="button"
                  onClick={toggleLang}
                  className="inline-flex h-9 items-center justify-center rounded-lg px-2.5 text-xs font-bold text-zinc-500 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-200"
                  title={lang === 'en' ? 'Cambiar a Español' : 'Switch to English'}
                >
                  {lang === 'en' ? 'ES' : 'EN'}
                </button>
              </>
            ) : (
              <span className="text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">{t(lang, 'app.accessRequired')}</span>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {sessionLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t(lang, 'app.loadingSession')}</p>
          </div>
        ) : !user && !reauthRequired ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center">
            <div className="w-full max-w-md space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Notes Aide
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
            <div
              className={`fixed bottom-4 left-0 top-[4.65rem] z-[45] w-[min(24rem,90vw)] lg:w-1/2 transition-transform duration-300 ease-out md:top-[5.15rem] ${
                isCommunityDrawerOpen
                  ? 'pointer-events-auto translate-x-0'
                  : 'pointer-events-none -translate-x-full md:translate-x-[calc(-100%+56px)]'
              }`}
            >
              <div
                id="community-drawer-panel"
                className="h-full overflow-hidden rounded-r-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
              >
                <CommunityPanel
                  currentExtractionId={result?.id ?? null}
                  onError={setError}
                  onNotice={setNotice}
                  className="mt-0 h-full min-h-0 overflow-y-auto rounded-none border-0 bg-transparent p-3 shadow-none"
                />
              </div>

              <button
                type="button"
                onClick={toggleCommunityDrawer}
                onPointerDown={handleCommunityDrawerHandlePointerDown}
                onPointerUp={handleCommunityDrawerHandlePointerUp}
                onPointerCancel={handleCommunityDrawerHandlePointerCancel}
                className="pointer-events-auto absolute left-full top-1/2 z-10 -translate-y-1/2 rounded-r-2xl border border-l-0 border-slate-300 bg-white px-2 py-3 shadow-lg shadow-slate-900/15 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
                aria-label={isCommunityDrawerOpen ? t(lang, 'app.hideCommunity') : t(lang, 'app.showCommunity')}
                aria-expanded={isCommunityDrawerOpen}
                aria-controls="community-drawer-panel"
              >
                <span className="sr-only">{t(lang, 'app.communityPanel')}</span>
                <span className="flex h-2.5 w-4 items-center justify-between" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-300" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-300" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-300" />
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-700 [writing-mode:vertical-rl] dark:text-slate-200"
                >
                  {t(lang, 'app.communityLabel')}
                </span>
              </button>
            </div>

            {isCommunityDrawerOpen && (
              <button
                type="button"
                aria-label={t(lang, 'app.closeCommunity')}
                onClick={closeCommunityDrawer}
                className="fixed inset-0 z-[34] bg-slate-950/20 backdrop-blur-[1px]"
              />
            )}

            {historyView === 'list' && history.length > 0 && (
              <div
                className={`fixed bottom-4 right-0 top-[4.65rem] z-[44] w-[min(26rem,92vw)] transition-transform duration-300 ease-out md:top-[5.15rem] min-[1728px]:hidden ${
                  isHistoryDrawerOpen
                    ? 'pointer-events-auto translate-x-0'
                    : 'pointer-events-none translate-x-full md:translate-x-[calc(100%-56px)]'
                }`}
              >
                <div
                  id="history-drawer-panel"
                  className="h-full overflow-hidden rounded-l-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
                >
                  <div className="h-full min-h-0 overflow-y-auto p-3">
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
                      onSelectItem={handleSelectHistoryItemFromDrawer}
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
                      onStarItem={(item, starred) => void handleStarHistoryItem(item, starred)}
                      onReExtractMode={(item, mode) => {
                        const itemUrl = item.url ?? ''
                        setUrl(itemUrl)
                        setExtractionMode(mode)
                        setIsHistoryDrawerOpen(false)
                        handleScrollToExtractor()
                        void handleExtract({ url: itemUrl, mode })
                      }}
                      allTags={allTags}
                      activeTagIds={activeTagIds}
                      onToggleTagFilter={handleToggleTagFilter}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleHistoryDrawer}
                  className="pointer-events-auto absolute right-full top-1/2 z-10 -translate-y-1/2 rounded-l-2xl border border-r-0 border-slate-300 bg-white px-2 py-3 shadow-lg shadow-slate-900/15 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
                  aria-label={isHistoryDrawerOpen ? t(lang, 'app.hideHistory') : t(lang, 'app.showHistory')}
                  aria-expanded={isHistoryDrawerOpen}
                  aria-controls="history-drawer-panel"
                >
                  <span className="sr-only">{t(lang, 'app.historyPanel')}</span>
                  <span className="flex h-2.5 w-4 items-center justify-between" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-300" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-300" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-700 [writing-mode:vertical-rl] dark:text-slate-200"
                  >
                    {t(lang, 'app.historyLabel')}
                  </span>
                </button>
              </div>
            )}

            {isHistoryDrawerOpen && historyView === 'list' && (
              <button
                type="button"
                aria-label={t(lang, 'app.closeHistory')}
                onClick={closeHistoryDrawer}
                className="fixed inset-0 z-[33] bg-slate-950/20 backdrop-blur-[1px] min-[1728px]:hidden"
              />
            )}

            <section
              ref={extractorSectionRef}
              className="flex min-h-[calc(100svh-7rem)] flex-col justify-center"
            >
              <div className="mx-auto w-full max-w-4xl">
                <div>
                  <div className="mb-7 text-center md:mb-9">
                    <p className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl dark:text-zinc-100">
                      Notes Aide Action Extractor
                    </p>
                  </div>
                  <div className="mb-4 flex items-center justify-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                      <Brain size={12} />
                      {t(lang, 'app.activeHistory')}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBatchMode((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                        isBatchMode
                          ? 'border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                      }`}
                      title={t(lang, 'app.batchMultipleUrls')}
                    >
                      <Layers size={11} />
                      {isBatchMode ? t(lang, 'app.batchMode') : t(lang, 'app.batchLabel')}
                    </button>
                  </div>

                  {isBatchMode ? (
                    <BatchExtractPanel
                      extractionMode={extractionMode}
                      outputLanguage={outputLanguage}
                      folders={folders}
                      onComplete={() => {
                        void loadHistory()
                      }}
                    />
                  ) : (
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
                    setResult({
                      ...manualResult,
                      phases: normalizePlaybookPhases(manualResult.phases),
                      objective: typeof manualResult.objective === 'string' ? manualResult.objective : '',
                    })
                    setStackedResultIds([])
                    setActivePhasesByPlaybookId({})
                    setPendingStackedScrollPlaybookId(null)
                    setResultAccessRole('owner')
                    setCircleMembers([])
                    setIsResultBookClosed(false)
                    setUrl('')
                    setUploadedFile(null)
                    setError(null)
                      setNotice(t(lang, 'app.emptyCreated'))
                      setShouldScrollToResult(true)
                      void loadHistory()
                    }}
                    onManualToggle={setIsManualFormOpen}
                    onSearchToggle={setIsSearchFormOpen}
                    onOpenPublicPlaybook={openPublicPlaybookFromSearch}
                  />
                  )}
                </div>

                <WorkspaceControlsDock
                  extractionMode={extractionMode}
                  outputLanguage={outputLanguage}
                  isProcessing={isProcessing}
                  isManualOpen={isManualFormOpen}
                  isSearchOpen={isSearchFormOpen}
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
                  <div className="mx-auto mt-1 mb-4 w-full max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 dark:border-red-800 dark:bg-red-900/20">
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5 dark:text-red-400" />
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Rate limit exceeded — CTA to buy credits */}
                {rateLimitExceeded && (
                  <div className="mx-auto mb-8 w-full max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3 dark:border-amber-800 dark:bg-amber-900/20">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {rateLimitMessage ?? t(lang, 'app.rateLimitExceeded')}
                      {extraCredits ? ` ${t(lang, 'app.creditsRemaining')} ${extraCredits} ${t(lang, 'app.creditsSuffix')}` : ''}
                    </p>
                    {!hasUnlimitedExtractions && (
                      <Link
                        href="/pricing#credits"
                        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        {t(lang, 'app.buyCredits')}
                      </Link>
                    )}
                  </div>
                )}

                {isProcessing && (() => {
                  return (
                    <ExtractionStreamingPreview
                      streamPreview={streamPreview}
                      statusText={streamStatus ?? t(lang, 'app.processingAI')}
                    />
                  )
                })()}
              </div>
            </section>

            {history.length > 0 && !historyLoading && (
              <div className="mb-4 flex items-center justify-end gap-1 min-[1728px]:mx-auto min-[1728px]:w-[93%]">
                <button
                  type="button"
                  onClick={() => setHistoryView('list')}
                  title={t(lang, 'app.tabsView')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    historyView === 'list'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'border-slate-200 bg-transparent text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <LayoutList size={13} />
                  {t(lang, 'app.tabsLabel')}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryView('feed')}
                  title={t(lang, 'app.sheetsView')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    historyView === 'feed'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'border-slate-200 bg-transparent text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Newspaper size={13} />
                  {t(lang, 'app.sheetsLabel')}
                </button>
              </div>
            )}

            <section className="mb-3 min-[1728px]:mx-auto min-[1728px]:w-[93%]">
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <Search size={15} />
                  </span>
                  <input
                    type="text"
                    value={globalPlaybookQuery}
                    onChange={(event) => setGlobalPlaybookQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      if (globalPlaybookSearchHits.length === 0) return
                      openGlobalPlaybookHit(globalPlaybookSearchHits[0])
                    }}
                    placeholder={t(lang, 'app.globalSearch')}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                    aria-label="Buscar playbooks globalmente"
                  />
                  {globalPlaybookQuery.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setGlobalPlaybookQuery('')}
                      className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {t(lang, 'app.clearSearch')}
                    </button>
                  )}
                </div>

                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t(lang, 'app.scopeLabel')} {history.length} {t(lang, 'app.scopeOwned')} · {sharedWithMe.length} {t(lang, 'app.scopeShared')}
                </p>

                {globalPlaybookQuery.trim().length > 0 && (
                  <div className="mt-2.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40">
                    {globalPlaybookSearchHits.length === 0 ? (
                      <p className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                        {t(lang, 'app.globalNoResults')}
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {globalPlaybookSearchHits.map((hit) => (
                          <li key={hit.key}>
                            <button
                              type="button"
                              onClick={() => openGlobalPlaybookHit(hit)}
                              className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {hit.title}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {hit.subtitle || t(lang, 'app.noUrl')}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                                  {hit.helper}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  hit.source === 'mine'
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/25 dark:text-indigo-300'
                                    : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/25 dark:text-sky-300'
                                }`}
                              >
                                {hit.source === 'mine' ? t(lang, 'app.ownLabel') : t(lang, 'app.sharedLabel')}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="relative min-[1728px]:mx-auto min-[1728px]:w-[93%]">
              <div
                className="playbook-folder-drawer"
                id="folder-dock-drawer"
                data-open={isFolderDockOpen ? 'true' : 'false'}
              >
                <button
                  type="button"
                  className="playbook-folder-drawer-tab"
                  onClick={() => setIsFolderDockOpen((prev) => !prev)}
                  aria-expanded={isFolderDockOpen}
                  aria-controls="folder-dock-drawer-panel"
                >
                  <span aria-hidden="true" className="playbook-folder-drawer-tab-handle" />
                  <span className="playbook-folder-drawer-tab-label">Carpetas</span>
                </button>

                <div
                  className="playbook-folder-drawer-panel"
                  id="folder-dock-drawer-panel"
                >
                  <FolderDock
                    folders={allFolders}
                    activeFolderIds={activeFolderIds}
                    folderCounts={folderCounts}
                    playbooks={folderPlaybooks}
                    activePlaybookId={result?.id ?? null}
                    openDeskPlaybooks={openDeskPlaybooks}
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
                    onManageFolderShare={openFolderShareModal}
                    onSelectPlaybook={openDeskPlaybookByIdentifier}
                    onFocusOpenDeskPlaybook={scrollToDeskPlaybook}
                    onCloseOpenDeskPlaybook={closeDeskPlaybook}
                  />
                </div>
              </div>

              <div ref={resultAnchorRef} className="relative z-20 scroll-mt-24">
                {result ? (
                  <div className="space-y-10">
                    <ResultPanel
                      result={result}
                      viewerUserId={user?.id ?? null}
                      url={url}
                      extractionMode={extractionMode}
                      isProcessing={isProcessing}
                      activePhase={activePhasesByPlaybookId[resolvePlaybookPhaseKey(result.id)] ?? null}
                      onTogglePhase={(phaseId) => togglePhaseForPlaybook(result.id, phaseId)}
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
                      bookFolderLabel={getFolderLabelById(result.folderId)}
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
                      onOpenPlaybookReference={openDeskPlaybookByIdentifier}
                      onFocusItemForChat={setFocusedItemForChat}
                      onReExtractMode={(mode) => {
                        handleScrollToExtractor()
                        void handleExtract({
                          url: (result.url ?? url).trim(),
                          mode,
                        })
                      }}
                      onStarResult={(starred) => void handleStarResult(starred)}
                      allTags={allTags}
                      onAddTag={handleAddTagToResult}
                      onRemoveTag={handleRemoveTagFromResult}
                    />

                    {stackedDeskPlaybooks.map((item) => {
                      const stackedResult =
                        item.source === 'mine'
                          ? mapHistoryItemToResult(item.historyItem)
                          : mapSharedItemToResult(item.sharedItem)
                      return (
                        <div key={`stacked-playbook-${item.id}`} id={`stacked-playbook-${item.id}`}>
                          <ResultPanel
                            result={stackedResult}
                            viewerUserId={user?.id ?? null}
                            url={stackedResult.url ?? ''}
                            extractionMode={normalizeExtractionMode(stackedResult.mode)}
                            isProcessing={false}
                            activePhase={
                              activePhasesByPlaybookId[resolvePlaybookPhaseKey(stackedResult.id)] ?? null
                            }
                            onTogglePhase={(phaseId) =>
                              togglePhaseForPlaybook(stackedResult.id, phaseId)
                            }
                            isExportingPdf={isExportingPdf}
                            shareLoading={item.source === 'mine' && historyShareLoadingItemId === item.id}
                            shareCopied={item.source === 'mine' && historyShareCopiedItemId === item.id}
                            shareVisibility={normalizeShareVisibility(stackedResult.shareVisibility)}
                            shareVisibilityLoading={false}
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
                            onDownloadPdf={() => handleDownloadPdf(stackedResult)}
                            onCopyShareLink={() => {
                              if (item.source === 'mine') {
                                return handleCopyShareLinkFromHistory(item.historyItem)
                              }
                              setNotice(t(lang, 'app.openAsMainForShare'))
                            }}
                            onCopyMarkdown={() => handleCopyMarkdown(stackedResult)}
                            onShareVisibilityChange={() => {
                              setNotice(t(lang, 'app.openAsMainForVisibility'))
                            }}
                            onSavePhases={async () => false}
                            onSaveMeta={async () => false}
                            isBookClosed={false}
                            bookFolderLabel={getFolderLabelById(stackedResult.folderId)}
                            onClose={() => closeDeskPlaybook(item.id)}
                            folders={folders}
                            onAssignFolder={handleAssignFolder}
                            accessRole="viewer"
                            members={[]}
                            membersLoading={false}
                            memberMutationLoading={false}
                            onAddMember={async () => false}
                            onRemoveMember={async () => false}
                            onExportToNotion={() => handleExportToNotion(item.id)}
                            onConnectNotion={handleConnectNotion}
                            onExportToTrello={() => handleExportToTrello(item.id)}
                            onConnectTrello={handleConnectTrello}
                            onExportToTodoist={() => handleExportToTodoist(item.id)}
                            onConnectTodoist={handleConnectTodoist}
                            onExportToGoogleDocs={() => handleExportToGoogleDocs(item.id)}
                            onConnectGoogleDocs={handleConnectGoogleDocs}
                            onOpenPlaybookReference={openDeskPlaybookByIdentifier}
                      onFocusItemForChat={setFocusedItemForChat}
                            onReExtractMode={(mode) => {
                              handleScrollToExtractor()
                              void handleExtract({
                                url: (stackedResult.url ?? '').trim(),
                                mode,
                              })
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : !isProcessing ? (
                  <div className="animate-fade-slide">
                    <div
                      className="paper-playbook paper-playbook-closed min-h-screen min-h-[100dvh] bg-white rounded-sm shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 dark:shadow-none"
                    >
                      <span aria-hidden="true" className="paper-playbook-fold" />
                      <div aria-hidden="true" className="paper-playbook-cover translate-y-0 opacity-100">
                        <p className="paper-playbook-cover-kicker">Carpeta activa</p>
                        <p className="paper-playbook-cover-title">General</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {historyView === 'list' && !hasMultipleDeskPlaybooksOpen && (
                <div className="absolute left-full top-0 bottom-6 hidden w-[18rem] min-[1728px]:block">
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

            <div ref={historyAnchorRef} className="scroll-mt-24 pt-6 md:pt-10">
              {historyView === 'feed' && history.length > 0 ? (
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-slate-400 dark:text-slate-500" />
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {history.length} {history.length !== 1 ? t(lang, 'app.extractionCountPlural') : t(lang, 'app.extractionCount')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadHistory()}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {t(lang, 'app.refresh')}
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
              ) : null}
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

            <KnowledgeChat activeExtractionId={result?.id ?? null} focusedItemContext={focusedItemForChat} onClearFocusedItem={() => setFocusedItemForChat(null)} />

            {folderShareTargetId && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
                onClick={closeFolderShareModal}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="folder-share-modal-title"
                  className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 id="folder-share-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Compartir carpeta
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Carpeta:{' '}
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {folderShareTargetFolder?.name ?? 'Carpeta'}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeFolderShareModal}
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cerrar
                    </button>
                  </div>

                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleAddFolderShareMember()
                    }}
                  >
                    <input
                      type="email"
                      value={folderShareEmailDraft}
                      onChange={(event) => setFolderShareEmailDraft(event.target.value)}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="correo@usuario.com"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      disabled={folderShareMutationLoading || !isFolderShareEmailDraftValid}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                    >
                      {folderShareMutationLoading ? 'Compartiendo...' : 'Agregar acceso'}
                    </button>
                  </form>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Correo a compartir:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {normalizedFolderShareEmailDraft || '—'}
                    </span>
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/35">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Usuarios con acceso ({folderShareMembers.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadFolderShareMembers(folderShareTargetId)}
                        disabled={folderShareMembersLoading}
                        className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {folderShareMembersLoading ? 'Cargando...' : 'Recargar'}
                      </button>
                    </div>

                    {folderShareMembersLoading ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Cargando usuarios compartidos...
                      </p>
                    ) : folderShareMembers.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Esta carpeta todavía no está compartida con otros usuarios.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {folderShareMembers.map((member) => {
                          const label = member.userName?.trim() || member.userEmail || member.memberUserId
                          return (
                            <li
                              key={`${member.folderId}-${member.memberUserId}`}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {label}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {member.userEmail || member.memberUserId}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleRemoveFolderShareMember(member.memberUserId)}
                                disabled={folderShareMutationLoading}
                                className="inline-flex h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40"
                              >
                                Revocar
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
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

      <KeyboardShortcutsModal
        open={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
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
