import { useEffect, useRef, useState } from 'react'
import { AlignLeft, ChevronDown, Copy, Download, FileText, Folder, Globe, History, PenLine, Play, Search, Share2, Trash2 } from 'lucide-react'
import type { FolderItem } from '@/app/home/components/FolderDock'
import { FOLDER_COLORS } from '@/app/home/components/FolderDock'
import Image from 'next/image'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { formatHistoryDate } from '@/app/home/lib/utils'
import type { HistoryItem, SourceType } from '@/app/home/lib/types'

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
}: HistoryPanelProps) {
  const hasHistory = history.length > 0
  const activeFolder = activeFolderIds.length === 1
    ? folders.find((f) => f.id === activeFolderIds[0]) ?? null
    : null
  const panelTitle = activeFolderIds.length === 0
    ? 'Playbooks sueltos'
    : activeFolderIds.length === 1
      ? (activeFolder?.name ?? 'Playbooks sueltos')
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

  const quickButtonClass =
    'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60'
  const [expandedActionsItemId, setExpandedActionsItemId] = useState<string | null>(null)
  const [folderPickerItemId, setFolderPickerItemId] = useState<string | null>(null)
  const folderPickerRef = useRef<HTMLDivElement>(null)

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
            {historyLoading ? 'Actualizando...' : 'Actualizar'}
          </button>
          <button
            onClick={onClearHistory}
            disabled={!hasHistory || historyLoading || clearingHistory}
            className="inline-flex items-center gap-1.5 text-sm text-rose-600 hover:text-rose-700 font-medium disabled:text-slate-400"
            aria-label="Limpiar historial"
          >
            <Trash2 size={14} />
            {clearingHistory ? 'Limpiando...' : 'Limpiar'}
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 dark:bg-slate-800/40 dark:border-slate-800">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={historyQuery}
            onChange={(event) => onHistoryQueryChange(event.target.value)}
            placeholder="Buscar por título, objetivo, URL o fecha..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {history.length === 0 && !historyLoading && (
        <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
          Aún no tienes extracciones guardadas.
        </p>
      )}

      {history.length > 0 && filteredHistory.length === 0 && !historyLoading && (
        <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
          No hay resultados para tu búsqueda.
        </p>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {filteredHistory.map((item) => {
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
                        alt={item.videoTitle ?? 'Miniatura del video'}
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
                    {item.videoTitle || item.sourceLabel || item.objective || 'Sin fuente'}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{item.url ?? item.sourceLabel ?? ''}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-slate-400">{formatHistoryDate(item.createdAt)}</p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700">
                      {getExtractionModeLabel(normalizeExtractionMode(item.mode))}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        item.shareVisibility === 'public'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {item.shareVisibility === 'public' ? 'Público' : 'Privado'}
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
                        title="Mover a carpeta"
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
                            Mover a carpeta
                          </p>
                          <button
                            type="button"
                            onClick={() => { onAssignFolder(item.id, null); setFolderPickerItemId(null) }}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${!item.folderId ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300'}`}
                          >
                            <span className="h-3 w-3 rounded-full border border-slate-300 dark:border-slate-600" />
                            Sin carpeta
                          </button>
                          {folders.map(f => {
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

                  {/* Actions button */}
                  <button
                    type="button"
                    onClick={() => toggleItemActions(item.id)}
                    aria-expanded={isActionsExpanded}
                    aria-label={`Mostrar acciones para ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"}`}
                    data-history-actions-root="true"
                    data-item-id={item.id}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Acciones
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
                        Exportaciones
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => triggerItemAction(item.id, () => onDownloadPdf(item))}
                          disabled={pdfExportLoading}
                          className={`${quickButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
                          aria-label={`Descargar PDF para ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"}`}
                        >
                          <Download size={12} />
                          {pdfExportLoading ? 'Generando PDF...' : 'PDF'}
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerItemAction(item.id, () => onCopyShareLink(item))}
                          disabled={historyShareLoadingItemId === item.id || item.shareVisibility !== 'public'}
                          className={`${quickButtonClass} border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50`}
                          aria-label={`Compartir extracción ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"}`}
                        >
                          <Share2 size={12} />
                          {historyShareLoadingItemId === item.id
                            ? 'Compartiendo...'
                            : item.shareVisibility !== 'public'
                              ? 'Solo público'
                            : historyShareCopiedItemId === item.id
                              ? 'Enlace copiado'
                              : 'Compartir'}
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerItemAction(item.id, () => onCopyMarkdown(item))}
                          className={`${quickButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
                          aria-label={`Copiar extracción ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"} en Markdown`}
                        >
                          <Copy size={12} />
                          Copiar Markdown
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
                          aria-label={`${notionConnected ? 'Exportar a Notion' : 'Conectar Notion'} para ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"}`}
                        >
                          {notionConnected
                            ? notionExportLoading
                              ? 'Notion...'
                              : 'Notion'
                            : notionLoading
                              ? 'Conectando Notion...'
                              : notionConfigured
                                ? 'Conectar Notion'
                                : 'Notion no configurado'}
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
                          aria-label={`${trelloConnected ? 'Exportar a Trello' : 'Conectar Trello'} para ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"}`}
                        >
                          {trelloConnected
                            ? trelloExportLoading
                              ? 'Trello...'
                              : 'Trello'
                            : trelloLoading
                              ? 'Conectando Trello...'
                              : trelloConfigured
                                ? 'Conectar Trello'
                                : 'Trello no configurado'}
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
                          aria-label={`${todoistConnected ? 'Exportar a Todoist' : 'Conectar Todoist'} para ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"}`}
                        >
                          {todoistConnected
                            ? todoistExportLoading
                              ? 'Todoist...'
                              : 'Todoist'
                            : todoistLoading
                              ? 'Conectando Todoist...'
                              : todoistConfigured
                                ? 'Conectar Todoist'
                                : 'Todoist no configurado'}
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
                          aria-label={`${googleDocsConnected ? 'Exportar a Google Docs' : 'Conectar Google Docs'} para ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"}`}
                        >
                          {googleDocsConnected
                            ? googleDocsExportLoading
                              ? 'Google Docs...'
                              : 'Google Docs'
                            : googleDocsLoading
                              ? 'Conectando Google Docs...'
                              : googleDocsConfigured
                                ? 'Conectar Google Docs'
                                : 'Google Docs no configurado'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                        Gestión
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:w-56">
                        <button
                          type="button"
                          onClick={() => triggerItemAction(item.id, () => onDeleteItem(item))}
                          disabled={isDeleting || clearingHistory}
                          className={`${quickButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/25 dark:text-rose-300 dark:hover:bg-rose-900/40`}
                          aria-label={`Eliminar extracción ${item.videoTitle ?? item.sourceLabel ?? item.url ?? "extracción"}`}
                        >
                          <Trash2 size={12} />
                          {isDeleting ? 'Borrando...' : 'Borrar extracción'}
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
