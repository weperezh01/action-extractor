import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Share2,
  Zap,
} from 'lucide-react'
import Image from 'next/image'
import {
  EXTRACTION_MODE_OPTIONS,
  getExtractionModeLabel,
  normalizeExtractionMode,
  type ExtractionMode,
} from '@/lib/extraction-modes'
import type { ExtractResult, Phase } from '@/app/home/lib/types'

interface ResultPanelProps {
  result: ExtractResult
  url: string
  extractionMode: ExtractionMode
  activePhase: number | null
  onTogglePhase: (id: number) => void

  isExportingPdf: boolean
  shareLoading: boolean
  shareCopied: boolean
  isProcessing: boolean

  notionConfigured: boolean
  notionConnected: boolean
  notionWorkspaceName: string | null
  notionLoading: boolean
  notionExportLoading: boolean

  trelloConfigured: boolean
  trelloConnected: boolean
  trelloUsername: string | null
  trelloLoading: boolean
  trelloExportLoading: boolean

  todoistConfigured: boolean
  todoistConnected: boolean
  todoistUserLabel: string | null
  todoistLoading: boolean
  todoistExportLoading: boolean

  googleDocsConfigured: boolean
  googleDocsConnected: boolean
  googleDocsUserEmail: string | null
  googleDocsLoading: boolean
  googleDocsExportLoading: boolean

  onDownloadPdf: () => void
  onCopyShareLink: () => void
  onCopyMarkdown: () => void
  onReExtractMode: (mode: ExtractionMode) => void

  onExportToNotion: () => void
  onConnectNotion: () => void

  onExportToTrello: () => void
  onConnectTrello: () => void

  onExportToTodoist: () => void
  onConnectTodoist: () => void

  onExportToGoogleDocs: () => void
  onConnectGoogleDocs: () => void
}

export function ResultPanel({
  result,
  url,
  extractionMode,
  activePhase,
  onTogglePhase,
  isExportingPdf,
  shareLoading,
  shareCopied,
  isProcessing,

  notionConfigured,
  notionConnected,
  notionWorkspaceName,
  notionLoading,
  notionExportLoading,

  trelloConfigured,
  trelloConnected,
  trelloUsername,
  trelloLoading,
  trelloExportLoading,

  todoistConfigured,
  todoistConnected,
  todoistUserLabel,
  todoistLoading,
  todoistExportLoading,

  googleDocsConfigured,
  googleDocsConnected,
  googleDocsUserEmail,
  googleDocsLoading,
  googleDocsExportLoading,

  onDownloadPdf,
  onCopyShareLink,
  onCopyMarkdown,
  onReExtractMode,

  onExportToNotion,
  onConnectNotion,

  onExportToTrello,
  onConnectTrello,

  onExportToTodoist,
  onConnectTodoist,

  onExportToGoogleDocs,
  onConnectGoogleDocs,
}: ResultPanelProps) {
  const resolvedMode = normalizeExtractionMode(result.mode ?? extractionMode)
  const sourceUrl = (result.url ?? url).trim()

  return (
    <div className="animate-fade-slide">
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
          <Clock size={16} /> Tiempo Ahorrado: {result.metadata.savedTime}
        </div>
        <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800">
          <Brain size={16} /> Dificultad: {result.metadata.difficulty}
        </div>
        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">
          <Zap size={16} /> Modo: {getExtractionModeLabel(resolvedMode)}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 dark:shadow-none">
        <div className="p-6 border-b border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Video Fuente
          </h2>
          <div className="flex flex-col md:flex-row gap-4">
            {result.thumbnailUrl ? (
              <div className="relative w-full md:w-56 h-32">
                <Image
                  src={result.thumbnailUrl}
                  alt={result.videoTitle ?? 'Miniatura del video'}
                  fill
                  sizes="(min-width: 768px) 224px, 100vw"
                  className="rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                />
              </div>
            ) : (
              <div className="w-full md:w-56 h-32 rounded-xl bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 text-base line-clamp-2 dark:text-slate-100">
                {result.videoTitle || 'Video de YouTube'}
              </p>
              {sourceUrl && (
                <p className="text-xs text-slate-500 mt-2 break-all dark:text-slate-400">
                  {sourceUrl}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 border-b border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Objetivo del Resultado
          </h2>
          <p className="text-lg font-medium text-slate-800 leading-relaxed dark:text-slate-100">
            {result.objective}
          </p>
        </div>

        {sourceUrl && (
          <div className="px-6 pt-6">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Re-extraer en otro modo
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Usa este mismo video sin copiar la URL para descubrir los otros modos.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EXTRACTION_MODE_OPTIONS.map((option) => {
                  const isActive = option.value === resolvedMode
                  const isDisabled = isProcessing || isActive

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onReExtractMode(option.value)}
                      disabled={isDisabled}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        isActive
                          ? 'border-indigo-300 bg-white text-indigo-700 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300'
                          : isProcessing
                            ? 'cursor-wait border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
                            : 'border-indigo-100 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-100/60 dark:border-indigo-900/60 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40'
                      }`}
                    >
                      <p className="text-sm font-semibold">
                        {option.label}
                        {isActive ? ' (actual)' : ''}
                      </p>
                      <p className="mt-0.5 text-xs opacity-80">{option.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="p-6 space-y-4">
          {result.phases.map((phase: Phase) => (
            <div
              key={phase.id}
              className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:border-indigo-200 hover:shadow-sm group dark:border-slate-700 dark:hover:border-indigo-700"
            >
              <button
                onClick={() => onTogglePhase(phase.id)}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      activePhase === phase.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-700 dark:text-slate-300 dark:group-hover:bg-indigo-900/40 dark:group-hover:text-indigo-300'
                    }`}
                  >
                    {phase.id}
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{phase.title}</span>
                </div>
                {activePhase === phase.id ? (
                  <ChevronUp size={20} className="text-slate-400" />
                ) : (
                  <ChevronDown size={20} className="text-slate-400" />
                )}
              </button>

              {activePhase === phase.id && (
                <div className="p-4 pt-0 bg-slate-50/50 border-t border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
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
                        <span className="text-slate-600 group-hover/item:text-slate-900 transition-colors leading-relaxed text-sm dark:text-slate-300 dark:group-hover/item:text-slate-100">
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

        <div className="mx-6 mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-4 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="text-amber-500 flex-shrink-0 mt-1 dark:text-amber-300">
            <Zap size={24} fill="currentColor" className="opacity-20" />
          </div>
          <div>
            <h4 className="font-bold text-amber-800 mb-1 text-sm dark:text-amber-200">
              Consejo Pro (Gold Nugget)
            </h4>
            <p className="text-sm text-amber-700 leading-relaxed italic dark:text-amber-300">
              &ldquo;{result.proTip}&rdquo;
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap gap-3 justify-between items-center dark:bg-slate-800/30 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onDownloadPdf}
              disabled={isExportingPdf}
              className="text-slate-500 hover:text-indigo-600 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all disabled:text-slate-400 disabled:cursor-wait dark:text-slate-300 dark:hover:text-indigo-300 dark:hover:bg-slate-800"
            >
              <Download size={16} /> {isExportingPdf ? 'Generando PDF...' : 'Guardar PDF'}
            </button>
            <button
              onClick={onCopyShareLink}
              disabled={!result.id || shareLoading}
              className="text-slate-500 hover:text-indigo-600 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all disabled:text-slate-400 disabled:cursor-wait dark:text-slate-300 dark:hover:text-indigo-300 dark:hover:bg-slate-800"
            >
              <Share2 size={16} />
              {shareLoading ? 'Generando link...' : shareCopied ? 'Link copiado' : 'Compartir'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {notionConnected && notionWorkspaceName && (
              <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                Notion: {notionWorkspaceName}
              </span>
            )}
            {trelloConnected && trelloUsername && (
              <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                Trello: @{trelloUsername}
              </span>
            )}
            {todoistConnected && todoistUserLabel && (
              <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                Todoist: {todoistUserLabel}
              </span>
            )}
            {googleDocsConnected && googleDocsUserEmail && (
              <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                Google: {googleDocsUserEmail}
              </span>
            )}

            {notionConnected ? (
              <button
                onClick={onExportToNotion}
                disabled={!result.id || notionExportLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md shadow-indigo-200 transition-all transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-wait disabled:shadow-none"
              >
                <Zap size={16} />
                {notionExportLoading ? 'Exportando...' : 'Exportar a Notion'}
              </button>
            ) : (
              <button
                onClick={onConnectNotion}
                disabled={notionLoading || !notionConfigured}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-wait"
              >
                <Zap size={16} />
                {notionLoading
                  ? 'Conectando...'
                  : notionConfigured
                    ? 'Conectar Notion'
                    : 'Notion no configurado'}
              </button>
            )}

            {trelloConnected ? (
              <button
                onClick={onExportToTrello}
                disabled={!result.id || trelloExportLoading}
                className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md shadow-sky-200 transition-all transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-wait disabled:shadow-none"
              >
                <Zap size={16} />
                {trelloExportLoading ? 'Exportando...' : 'Exportar a Trello'}
              </button>
            ) : (
              <button
                onClick={onConnectTrello}
                disabled={trelloLoading || !trelloConfigured}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-wait"
              >
                <Zap size={16} />
                {trelloLoading
                  ? 'Conectando...'
                  : trelloConfigured
                    ? 'Conectar Trello'
                    : 'Trello no configurado'}
              </button>
            )}

            {todoistConnected ? (
              <button
                onClick={onExportToTodoist}
                disabled={!result.id || todoistExportLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md shadow-rose-200 transition-all transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-wait disabled:shadow-none"
              >
                <Zap size={16} />
                {todoistExportLoading ? 'Exportando...' : 'Exportar a Todoist'}
              </button>
            ) : (
              <button
                onClick={onConnectTodoist}
                disabled={todoistLoading || !todoistConfigured}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-wait"
              >
                <Zap size={16} />
                {todoistLoading
                  ? 'Conectando...'
                  : todoistConfigured
                    ? 'Conectar Todoist'
                    : 'Todoist no configurado'}
              </button>
            )}

            {googleDocsConnected ? (
              <button
                onClick={onExportToGoogleDocs}
                disabled={!result.id || googleDocsExportLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md shadow-emerald-200 transition-all transform hover:-translate-y-0.5 disabled:bg-slate-400 disabled:cursor-wait disabled:shadow-none"
              >
                <Zap size={16} />
                {googleDocsExportLoading ? 'Exportando...' : 'Exportar a Google Docs'}
              </button>
            ) : (
              <button
                onClick={onConnectGoogleDocs}
                disabled={googleDocsLoading || !googleDocsConfigured}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:bg-slate-400 disabled:cursor-wait"
              >
                <Zap size={16} />
                {googleDocsLoading
                  ? 'Conectando...'
                  : googleDocsConfigured
                    ? 'Conectar Google Docs'
                    : 'Google Docs no configurado'}
              </button>
            )}

            <button
              onClick={onCopyMarkdown}
              className="text-slate-600 hover:text-indigo-600 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all dark:text-slate-300 dark:hover:text-indigo-300 dark:hover:bg-slate-800"
            >
              <Copy size={16} /> Copiar Markdown
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
