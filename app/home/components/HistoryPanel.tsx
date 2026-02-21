import { Download, History, Search, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { formatHistoryDate } from '@/app/home/lib/utils'
import type { HistoryItem } from '@/app/home/lib/types'

interface HistoryPanelProps {
  history: HistoryItem[]
  filteredHistory: HistoryItem[]
  historyLoading: boolean
  historyQuery: string
  pdfExportLoading: boolean

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

  deletingHistoryItemId: string | null
  clearingHistory: boolean
  onHistoryQueryChange: (value: string) => void
  onRefresh: () => void
  onSelectItem: (item: HistoryItem) => void
  onDownloadPdf: (item: HistoryItem) => void
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

  deletingHistoryItemId,
  clearingHistory,
  onHistoryQueryChange,
  onRefresh,
  onSelectItem,
  onDownloadPdf,
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
  const quickButtonClass =
    'rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium leading-5 transition-colors disabled:cursor-wait disabled:opacity-60'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md shadow-slate-100 mb-10 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 text-slate-800 font-semibold dark:text-slate-100">
          <History size={16} />
          Historial de Extracciones
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

          return (
            <div
              key={item.id}
              className="w-full px-5 py-4 hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/60"
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-start gap-3">
                    {item.thumbnailUrl ? (
                      <div className="relative w-24 h-14 flex-shrink-0">
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.videoTitle ?? 'Miniatura del video'}
                          fill
                          sizes="96px"
                          className="rounded-md object-cover border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-14 rounded-md bg-slate-200 border border-slate-200 flex-shrink-0 dark:bg-slate-700 dark:border-slate-700" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 line-clamp-1 dark:text-slate-100">
                        {item.videoTitle || item.objective || 'Video de YouTube'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 truncate dark:text-slate-400">{item.url}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-slate-400">{formatHistoryDate(item.createdAt)}</p>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700">
                          {getExtractionModeLabel(normalizeExtractionMode(item.mode))}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteItem(item)}
                  disabled={isDeleting || clearingHistory}
                  className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-60 disabled:cursor-wait dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/20"
                  aria-label={`Eliminar extracción ${item.videoTitle ?? item.url}`}
                >
                  <Trash2 size={14} />
                  <span className="text-xs font-medium">{isDeleting ? 'Borrando...' : 'Borrar'}</span>
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDownloadPdf(item)}
                  disabled={pdfExportLoading}
                  className={`${quickButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
                  aria-label={`Descargar PDF para ${item.videoTitle ?? item.url}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Download size={12} />
                    {pdfExportLoading ? 'Generando PDF...' : 'PDF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => (notionConnected ? onExportToNotion(item) : onConnectNotion())}
                  disabled={notionConnected ? notionExportLoading : notionLoading || !notionConfigured}
                  className={`${quickButtonClass} border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50`}
                  aria-label={`${notionConnected ? 'Exportar a Notion' : 'Conectar Notion'} para ${item.videoTitle ?? item.url}`}
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
                  onClick={() => (trelloConnected ? onExportToTrello(item) : onConnectTrello())}
                  disabled={trelloConnected ? trelloExportLoading : trelloLoading || !trelloConfigured}
                  className={`${quickButtonClass} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50`}
                  aria-label={`${trelloConnected ? 'Exportar a Trello' : 'Conectar Trello'} para ${item.videoTitle ?? item.url}`}
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
                  onClick={() => (todoistConnected ? onExportToTodoist(item) : onConnectTodoist())}
                  disabled={todoistConnected ? todoistExportLoading : todoistLoading || !todoistConfigured}
                  className={`${quickButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50`}
                  aria-label={`${todoistConnected ? 'Exportar a Todoist' : 'Conectar Todoist'} para ${item.videoTitle ?? item.url}`}
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
                    googleDocsConnected ? onExportToGoogleDocs(item) : onConnectGoogleDocs()
                  }
                  disabled={
                    googleDocsConnected
                      ? googleDocsExportLoading
                      : googleDocsLoading || !googleDocsConfigured
                  }
                  className={`${quickButtonClass} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50`}
                  aria-label={`${googleDocsConnected ? 'Exportar a Google Docs' : 'Conectar Google Docs'} para ${item.videoTitle ?? item.url}`}
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
          )
        })}
      </div>
    </div>
  )
}
