import { useEffect, useRef, useState } from 'react'
import { AlignLeft, ArrowUpRight, Building2, ChevronDown, Copy, Download, FileText, Folder, Globe, History, PenLine, Play, RotateCcw, Search, Share2, Star, Tag, Trash2 } from 'lucide-react'
import type { FolderItem } from '@/app/home/components/FolderDock'
import type { ExtractionTag } from '@/app/home/lib/types'
import { FOLDER_COLORS } from '@/app/home/components/FolderDock'
import Image from 'next/image'
import { getExtractionModeLabel, getExtractionModeOptions, normalizeExtractionMode, type ExtractionMode } from '@/lib/extraction-modes'
import { getShareVisibilityLabel, isShareVisibilityShareable } from '@/app/home/lib/share-visibility'
import { formatHistoryDate } from '@/app/home/lib/utils'
import { resolveSystemExtractionFolderKey } from '@/lib/extraction-folders'
import type { HistoryItem, SourceType } from '@/app/home/lib/types'
import { type Lang, t } from '@/app/home/lib/i18n'

function SourceIcon({ sourceType, size = 20 }: { sourceType: SourceType; size?: number }) {
  switch (sourceType) {
    case 'youtube': return <Play size={size} />
    case 'web_url': return <Globe size={size} />
    case 'pdf':
    case 'docx': return <FileText size={size} />
    case 'manual': return <PenLine size={size} />
    default: return <AlignLeft size={size} />
  }
}

interface HistoryPanelProps {
  history: HistoryItem[]
  filteredHistory: HistoryItem[]
  historyLoading: boolean
  historyQuery: string
  pdfExportLoading: boolean
  historyShareLoadingItemId: string | null
  historyShareCopiedItemId: string | null

  notionConfigured: boolean
  notionConnected: boolean
  notionLoading: boolean
  notionExportLoading: boolean

  trelloConfigured: boolean
  trelloConnected: boolean
  trelloLoading: boolean
  trelloExportLoading: boolean

  todoistConfigured: boolean
  todoistConnected: boolean
  todoistLoading: boolean
  todoistExportLoading: boolean

  googleDocsConfigured: boolean
  googleDocsConnected: boolean
  googleDocsLoading: boolean
  googleDocsExportLoading: boolean

  folders?: FolderItem[]
  activeFolderIds?: string[]
  onAssignFolder?: (itemId: string, folderId: string | null) => void
  deletingHistoryItemId: string | null
  clearingHistory: boolean
  onHistoryQueryChange: (value: string) => void
  onRefresh: () => void
  onSelectItem: (item: HistoryItem) => void
  onDownloadPdf: (item: HistoryItem) => void
  onCopyShareLink: (item: HistoryItem) => void
  onCopyMarkdown: (item: HistoryItem) => void
  onExportToNotion: (item: HistoryItem) => void
  onConnectNotion: () => void
  onExportToTrello: (item: HistoryItem) => void
  onConnectTrello: () => void
  onExportToTodoist: (item: HistoryItem) => void
  onConnectTodoist: () => void
  onExportToGoogleDocs: (item: HistoryItem) => void
  onConnectGoogleDocs: () => void
  onDeleteItem: (item: HistoryItem) => void
  onClearHistory: () => void
  onStarItem?: (item: HistoryItem, starred: boolean) => void
  onReExtractMode?: (item: HistoryItem, mode: ExtractionMode) => void
  allTags?: ExtractionTag[]
  activeTagIds?: string[]
  onToggleTagFilter?: (tagId: string) => void
  onMoveToWorkspace?: (itemId: string, workspaceId: string | null) => Promise<void>
  lang?: Lang
}

export function HistoryPanel({
  history,
  filteredHistory,
  historyLoading,
  historyQuery,
  pdfExportLoading,
  historyShareLoadingItemId,
  historyShareCopiedItemId,

  notionConfigured,
  notionConnected,
  notionLoading,
  notionExportLoading,

  trelloConfigured,
  trelloConnected,
  trelloLoading,
  trelloExportLoading,

  todoistConfigured,
  todoistConnected,
  todoistLoading,
  todoistExportLoading,

  googleDocsConfigured,
  googleDocsConnected,
  googleDocsLoading,
  googleDocsExportLoading,

  folders = [],
  activeFolderIds = [],
  onAssignFolder,
  deletingHistoryItemId,
  clearingHistory,
  onHistoryQueryChange,
  onRefresh,
  onSelectItem,
  onDownloadPdf,
  onCopyShareLink,
  onCopyMarkdown,
  onExportToNotion,
  onConnectNotion,
  onExportToTrello,
  onConnectTrello,
  onExportToTodoist,
  onConnectTodoist,
  onExportToGoogleDocs,
  onConnectGoogleDocs,
  onDeleteItem,
  onClearHistory,
  onStarItem,
  onReExtractMode,
  allTags = [],
  activeTagIds = [],
  onToggleTagFilter,
  onMoveToWorkspace,
  lang = 'en',
}: HistoryPanelProps) {
  const localizedModeOptions = getExtractionModeOptions(lang)
  const generalFolderId = folders.find((folder) => resolveSystemExtractionFolderKey(folder.id) === 'general')?.id ?? null
  const hasHistory = history.length > 0
  const activeFolder = activeFolderIds.length === 1
    ? folders.find((f) => f.id === activeFolderIds[0]) ?? null
    : null
  const panelTitle = activeFolderIds.length === 0
    ? t(lang, 'hist.title')
    : activeFolderIds.length === 1
      ? (activeFolder?.name ?? t(lang, 'app.generalFolder'))
      : activeFolderIds
          .map((id) => folders.find((f) => f.id === id)?.name)
          .filter(Boolean)
          .join(' · ')

  const [titleVisible, setTitleVisible] = useState(true)
  const prevTitleRef = useRef(panelTitle)
  useEffect(() => {
    if (prevTitleRef.current === panelTitle) return
    prevTitleRef.current = panelTitle
    setTitleVisible(false)
    const t = setTimeout(() => setTitleVisible(true), 200)
    return () => clearTimeout(t)
  }, [panelTitle])

  const [starredOnly, setStarredOnly] = useState(false)
  const quickButtonClass =
    'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60'
  const [expandedActionsItemId, setExpandedActionsItemId] = useState<string | null>(null)
  const [folderPickerItemId, setFolderPickerItemId] = useState<string | null>(null)
  const folderPickerRef = useRef<HTMLDivElement>(null)

  // Workspace picker
  interface WsOption { id: string; name: string; avatar_color: string; role: string }
  const [workspaceOptions, setWorkspaceOptions] = useState<WsOption[]>([])
  const [wsPickerItemId, setWsPickerItemId] = useState<string | null>(null)
  const [movingToWs, setMovingToWs] = useState(false)
  const wsPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!onMoveToWorkspace) return
    fetch('/api/workspaces', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.workspaces) {
          setWorkspaceOptions(
            (data.workspaces as WsOption[]).filter((w) => w.role !== 'viewer')
          )
        }
      })
      .catch(() => undefined)
  }, [onMoveToWorkspace])

  useEffect(() => {
    if (!wsPickerItemId) return
    const handler = (e: MouseEvent) => {
      if (wsPickerRef.current && !wsPickerRef.current.contains(e.target as Node)) {
        setWsPickerItemId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [wsPickerItemId])

  useEffect(() => {
    if (!folderPickerItemId) return
    const handleClick = (e: MouseEvent) => {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setFolderPickerItemId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [folderPickerItemId])

  const toggleItemActions = (itemId: string) => {
    setExpandedActionsItemId((current) => (current === itemId ? null : itemId))
  }

  const triggerItemAction = (itemId: string, action: () => void | Promise<void>) => {
    const maybePromise = action()
    if (maybePromise && typeof (maybePromise as PromiseLike<void>).then === 'function') {
      void Promise.resolve(maybePromise).finally(() => {
        setExpandedActionsItemId((current) => (current === itemId ? null : current))
      })
      return
    }

    setExpandedActionsItemId((current) => (current === itemId ? null : current))
  }

  useEffect(() => {
    if (!expandedActionsItemId) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const actionsRoot = target.closest<HTMLElement>('[data-history-actions-root]')
      if (actionsRoot?.dataset.itemId === expandedActionsItemId) return

      setExpandedActionsItemId(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [expandedActionsItemId])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md shadow-slate-100 mb-10 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div
          className="flex items-center gap-2 font-semibold"
          style={{
            transition: 'opacity 0.22s ease, transform 0.22s ease, color 0.22s ease',
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateX(0)' : 'translateX(-10px)',
            color: titleVisible
              ? activeFolder ? 'var(--title-folder-color, #4f46e5)' : undefined
              : undefined,
          }}
        >
          {activeFolder ? (
            <Folder size={16} style={{ color: activeFolder ? '#4f46e5' : undefined }} />
          ) : (
            <History size={16} />
          )}
          <span className={activeFolder ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}>
            {panelTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={historyLoading || clearingHistory}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:text-slate-400"
          >
            {historyLoading ? t(lang, 'hist.refreshing') : t(lang, 'hist.refresh')}
          </button>
          <button
            onClick={onClearHistory}
            disabled={!hasHistory || historyLoading || clearingHistory}
            className="inline-flex items-center gap-1.5 text-sm text-rose-600 hover:text-rose-700 font-medium disabled:text-slate-400"
            aria-label={t(lang, 'hist.clearAria')}
          >
            <Trash2 size={14} />
            {clearingHistory ? t(lang, 'hist.clearing') : t(lang, 'hist.clear')}
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 dark:bg-slate-800/40 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={15} />
            </div>
            <input
              type="text"
              value={historyQuery}
              onChange={(event) => onHistoryQueryChange(event.target.value)}
              placeholder={t(lang, 'hist.search')}
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setStarredOnly((v) => !v)}
            title={starredOnly ? t(lang, 'hist.starred.show') : t(lang, 'hist.starred.only')}
            className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border transition-colors ${
              starredOnly
                ? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:border-amber-600 dark:hover:text-amber-400'
            }`}
          >
            <Star size={15} fill={starredOnly ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && onToggleTagFilter && (
        <div className="flex flex-wrap gap-1.5 px-5 py-2 border-b border-slate-100 bg-slate-50/40 dark:bg-slate-800/25 dark:border-slate-800">
          <Tag size={12} className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
          {allTags.map((tag) => {
            const active = activeTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTagFilter(tag.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-600 dark:hover:text-indigo-300'
                }`}
              >
                #{tag.name}
              </button>
            )
          })}
        </div>
      )}

      {history.length === 0 && !historyLoading && (
        <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
          {t(lang, 'hist.noHistory')}
        </p>
      )}

      {history.length > 0 && filteredHistory.length === 0 && !historyLoading && (
        <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
          {t(lang, 'hist.noResults')}
        </p>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {filteredHistory.filter((item) => !starredOnly || item.isStarred).map((item) => {
          const isDeleting = deletingHistoryItemId === item.id
          const isActionsExpanded = expandedActionsItemId === item.id

          return (
            <div
              key={item.id}
              className="w-full px-5 py-4 hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/60"
            >
              {/* Responsive flex: wraps on mobile (thumbnail+buttons row 1, text row 2),
                  single row on sm+ */}
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">

                {/* 1 — Thumbnail (order-1: always row 1 on mobile) */}
                <div
                  className="order-1 flex-shrink-0 cursor-pointer"
                  onClick={() => onSelectItem(item)}
                >
                  {item.thumbnailUrl ? (
                    <div className="relative h-14 w-24">
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.videoTitle ?? t(lang, 'hist.thumbnail')}
                        fill
                        sizes="96px"
                        className="rounded-md object-cover border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-24 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-200 text-slate-400 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-500">
                      <SourceIcon sourceType={item.sourceType ?? 'youtube'} size={20} />
                    </div>
                  )}
                </div>

                {/* 2 — Text (order-3 mobile → row 2 full width; order-2 sm+ → flex-1 middle) */}
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="order-3 w-full min-w-0 text-left sm:order-2 sm:w-auto sm:flex-1"
                >
                  <p className="font-semibold text-slate-800 line-clamp-1 dark:text-slate-100">
                    {item.videoTitle || item.sourceLabel || item.objective || t(lang, 'hist.noSource')}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{item.url ?? item.sourceLabel ?? ''}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-slate-400">{formatHistoryDate(item.createdAt)}</p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700">
                      {getExtractionModeLabel(normalizeExtractionMode(item.mode), lang)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        item.shareVisibility === 'public'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300'
                          : item.shareVisibility === 'unlisted'
                            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/25 dark:text-amber-300'
                            : item.shareVisibility === 'circle'
                              ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-900/25 dark:text-sky-300'
                              : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {getShareVisibilityLabel(item.shareVisibility)}
                    </span>
                    {item.folderId && folders.length > 0 && (() => {
                      const f = folders.find(x => x.id === item.folderId)
                      if (!f) return null
                      const meta = FOLDER_COLORS.find(c => c.value === f.color)
                      return (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta?.active ?? ''}`}>
                          <Folder size={9} />
                          {f.name}
                        </span>
                      )
                    })()}
                    {item.orderNumber > 0 && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">
                        #{item.orderNumber}
                      </span>
                    )}
                    {(item.tags ?? []).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-0.5 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
                      >
                        #{tag.name}
                      </span>
                    ))}
                    <span
                      title={item.id}
                      className="max-w-[14rem] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 md:max-w-[18rem]"
                    >
                      ID: {item.id}
                    </span>
                  </div>
                </button>

                {/* 3 — Buttons (order-2 mobile → row 1 right-aligned; order-3 sm+) */}
                <div className="order-2 ml-auto flex flex-shrink-0 flex-col items-end gap-1 sm:order-3 sm:ml-0">
                  {/* Folder button */}
                  {folders.length > 0 && onAssignFolder && (
                    <div className="relative" ref={folderPickerItemId === item.id ? folderPickerRef : undefined}>
                      <button
                        type="button"
                        onClick={() => setFolderPickerItemId(prev => prev === item.id ? null : item.id)}
                        title={t(lang, 'hist.moveToFolder')}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                          item.folderId
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                            : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                        }`}
                      >
                        <Folder size={14} />
                      </button>
                      {folderPickerItemId === item.id && (
                        <div className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {t(lang, 'hist.moveToFolder')}
                          </p>
                          <button
                            type="button"
                            onClick={() => { onAssignFolder(item.id, generalFolderId); setFolderPickerItemId(null) }}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                              item.folderId === generalFolderId ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <span className="h-3 w-3 rounded-full border border-slate-300 dark:border-slate-600" />
                            {t(lang, 'app.generalFolder')}
                          </button>
                          {folders.filter((f) => f.id !== generalFolderId).map(f => {
                            const meta = FOLDER_COLORS.find(c => c.value === f.color)
                            const isSelected = item.folderId === f.id
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => { onAssignFolder(item.id, f.id); setFolderPickerItemId(null) }}
                                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isSelected ? 'font-semibold text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300'}`}
                              >
                                <Folder size={11} className={meta?.icon ?? 'text-amber-500'} />
                                {f.name}
                                {isSelected && <span className="ml-auto text-[10px] text-indigo-400">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Star button */}
                  {onStarItem && (
                    <button
                      type="button"
                      onClick={() => onStarItem(item, !item.isStarred)}
                      title={item.isStarred ? t(lang, 'hist.unstar') : t(lang, 'hist.star')}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                        item.isStarred
                          ? 'border-amber-300 bg-amber-50 text-amber-500 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
                          : 'border-slate-200 bg-white text-slate-300 hover:border-amber-200 hover:text-amber-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-600 dark:hover:border-amber-600 dark:hover:text-amber-400'
                      }`}
                    >
                      <Star size={13} fill={item.isStarred ? 'currentColor' : 'none'} />
                    </button>
                  )}

                  {/* Actions button */}
                  <button
                    type="button"
                    onClick={() => toggleItemActions(item.id)}
                    aria-expanded={isActionsExpanded}
                    aria-label={`${t(lang, 'hist.showActions')} ${item.videoTitle ?? item.sourceLabel ?? item.url ?? t(lang, 'hist.deleteExtraction')}`}
                    data-history-actions-root="true"
                    data-item-id={item.id}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t(lang, 'hist.actions')}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-300 ease-out ${isActionsExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              <div
                aria-hidden={!isActionsExpanded}
                data-history-actions-root="true"
                data-item-id={item.id}
                className={`grid transition-[grid-template-rows,opacity,margin-top] duration-500 ease-out ${
                  isActionsExpanded
                    ? 'visible mt-3 grid-rows-[1fr] opacity-100'
                    : 'invisible mt-0 grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/45">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                        {t(lang, 'hist.exports')}
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => triggerItemAction(item.id, () => onDownloadPdf(item))}
                          disabled={pdfExportLoading}
                          className={`${quickButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
                          aria-label={`PDF ${item.videoTitle ?? item.sourceLabel ?? item.url ?? ''}`}
                        >
                          <Download size={12} />
                          {pdfExportLoading ? t(lang, 'hist.pdfGenerating') : 'PDF'}
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerItemAction(item.id, () => onCopyShareLink(item))}
                          disabled={historyShareLoadingItemId === item.id || !isShareVisibilityShareable(item.shareVisibility)}
                          className={`${quickButtonClass} border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50`}
                          aria-label={`${t(lang, 'hist.share')} ${item.videoTitle ?? item.sourceLabel ?? item.url ?? ''}`}
                        >
                          <Share2 size={12} />
                          {historyShareLoadingItemId === item.id
                            ? t(lang, 'hist.sharing')
                            : !isShareVisibilityShareable(item.shareVisibility)
                              ? t(lang, 'hist.shareMustBePublic')
                            : historyShareCopiedItemId === item.id
                              ? t(lang, 'hist.linkCopied')
                              : t(lang, 'hist.share')}
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerItemAction(item.id, () => onCopyMarkdown(item))}
                          className={`${quickButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
                          aria-label={`${t(lang, 'hist.copyMarkdown')} ${item.videoTitle ?? item.sourceLabel ?? item.url ?? ''}`}
                        >
                          <Copy size={12} />
                          {t(lang, 'hist.copyMarkdown')}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            triggerItemAction(item.id, () =>
                              notionConnected ? onExportToNotion(item) : onConnectNotion()
                            )
                          }
                          disabled={notionConnected ? notionExportLoading : notionLoading || !notionConfigured}
                          className={`${quickButtonClass} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50`}
                          aria-label={`${notionConnected ? 'Notion' : t(lang, 'hist.notionConnect')} ${item.videoTitle ?? item.sourceLabel ?? item.url ?? ''}`}
                        >
                          {notionConnected
                            ? notionExportLoading
                              ? 'Notion...'
                              : 'Notion'
                            : notionLoading
                              ? t(lang, 'hist.notionConnecting')
                              : notionConfigured
                                ? t(lang, 'hist.notionConnect')
                                : t(lang, 'hist.notionNotConfigured')}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            triggerItemAction(item.id, () =>
                              trelloConnected ? onExportToTrello(item) : onConnectTrello()
                            )
                          }
                          disabled={trelloConnected ? trelloExportLoading : trelloLoading || !trelloConfigured}
                          className={`${quickButtonClass} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50`}
                          aria-label={`${trelloConnected ? 'Trello' : t(lang, 'hist.trelloConnect')} ${item.videoTitle ?? item.sourceLabel ?? item.url ?? ''}`}
                        >
                          {trelloConnected
                            ? trelloExportLoading
                              ? 'Trello...'
                              : 'Trello'
                            : trelloLoading
                              ? t(lang, 'hist.trelloConnecting')
                              : trelloConfigured
                                ? t(lang, 'hist.trelloConnect')
                                : t(lang, 'hist.trelloNotConfigured')}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            triggerItemAction(item.id, () =>
                              todoistConnected ? onExportToTodoist(item) : onConnectTodoist()
                            )
                          }
                          disabled={todoistConnected ? todoistExportLoading : todoistLoading || !todoistConfigured}
                          className={`${quickButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50`}
                          aria-label={`${todoistConnected ? 'Todoist' : t(lang, 'hist.todoistConnect')} ${item.videoTitle ?? item.sourceLabel ?? item.url ?? ''}`}
                        >
                          {todoistConnected
                            ? todoistExportLoading
                              ? 'Todoist...'
                              : 'Todoist'
                            : todoistLoading
                              ? t(lang, 'hist.todoistConnecting')
                              : todoistConfigured
                                ? t(lang, 'hist.todoistConnect')
                                : t(lang, 'hist.todoistNotConfigured')}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            triggerItemAction(item.id, () =>
                              googleDocsConnected ? onExportToGoogleDocs(item) : onConnectGoogleDocs()
                            )
                          }
                          disabled={
                            googleDocsConnected
                              ? googleDocsExportLoading
                              : googleDocsLoading || !googleDocsConfigured
                          }
                          className={`${quickButtonClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50`}
                          aria-label={`${googleDocsConnected ? 'Google Docs' : t(lang, 'hist.googleDocsConnect')} ${item.videoTitle ?? item.sourceLabel ?? item.url ?? ''}`}
                        >
                          {googleDocsConnected
                            ? googleDocsExportLoading
                              ? 'Google Docs...'
                              : 'Google Docs'
                            : googleDocsLoading
                              ? t(lang, 'hist.googleDocsConnecting')
                              : googleDocsConfigured
                                ? t(lang, 'hist.googleDocsConnect')
                                : t(lang, 'hist.googleDocsNotConfigured')}
                        </button>
                      </div>
                    </div>

                    {onReExtractMode && (
                      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                          {t(lang, 'hist.reExtract')}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {localizedModeOptions.filter((opt) => opt.value !== normalizeExtractionMode(item.mode)).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => triggerItemAction(item.id, () => onReExtractMode(item, opt.value))}
                              className={`${quickButtonClass} border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50`}
                              title={opt.description}
                            >
                              <RotateCcw size={11} />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                        {t(lang, 'hist.management')}
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:w-56">
                        {onMoveToWorkspace && workspaceOptions.length > 0 && (
                          <div className="relative" ref={wsPickerItemId === item.id ? wsPickerRef : undefined}>
                            <button
                              type="button"
                              onClick={() => setWsPickerItemId((prev) => prev === item.id ? null : item.id)}
                              disabled={movingToWs}
                              className={`${quickButtonClass} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50`}
                            >
                              <Building2 size={12} />
                              {t(lang, 'hist.moveToWorkspace')}
                            </button>
                            {wsPickerItemId === item.id && (
                              <div className="absolute left-0 bottom-full mb-1 z-30 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {t(lang, 'hist.selectWorkspace')}
                                </p>
                                {workspaceOptions.map((ws) => (
                                  <button
                                    key={ws.id}
                                    type="button"
                                    onClick={async () => {
                                      setWsPickerItemId(null)
                                      setMovingToWs(true)
                                      try { await onMoveToWorkspace(item.id, ws.id) } finally { setMovingToWs(false) }
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <Building2 size={11} className="text-indigo-500" />
                                    {ws.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => triggerItemAction(item.id, () => onDeleteItem(item))}
                          disabled={isDeleting || clearingHistory}
                          className={`${quickButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40`}
                          aria-label={`${t(lang, 'hist.deleteAria')} ${item.videoTitle ?? item.sourceLabel ?? item.url ?? ''}`}
                        >
                          <Trash2 size={12} />
                          {isDeleting ? t(lang, 'hist.deleting') : t(lang, 'hist.deleteExtraction')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
