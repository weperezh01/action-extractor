'use client'

import Image from 'next/image'
import { AlignLeft, FileText, Folder, Globe, PenLine, Play } from 'lucide-react'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { getShareVisibilityLabel } from '@/app/home/lib/share-visibility'
import { formatHistoryDate } from '@/app/home/lib/utils'
import type { HistoryItem, SourceType } from '@/app/home/lib/types'
import type { FolderItem } from '@/app/home/components/FolderDock'
import { FOLDER_COLORS } from '@/app/home/components/FolderDock'

function SourceIcon({ sourceType, size = 16 }: { sourceType: SourceType; size?: number }) {
  switch (sourceType) {
    case 'youtube': return <Play size={size} />
    case 'web_url': return <Globe size={size} />
    case 'pdf':
    case 'docx': return <FileText size={size} />
    case 'manual': return <PenLine size={size} />
    default: return <AlignLeft size={size} />
  }
}

interface PlaybookSideTabsProps {
  items: HistoryItem[]
  folders: FolderItem[]
  loading: boolean
  activeItemId?: string | null
  onSelectItem: (item: HistoryItem) => void
  onRefresh: () => void
}

export function PlaybookSideTabs({
  items,
  folders,
  loading,
  activeItemId = null,
  onSelectItem,
  onRefresh,
}: PlaybookSideTabsProps) {
  return (
    <aside className="playbook-side-tabs-shell flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Playbooks
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <div className="playbook-side-tabs-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <div className="mx-2 rounded-r-xl border border-l-0 border-slate-200 bg-white/90 px-3 py-4 text-xs text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No hay playbooks para mostrar.
          </div>
        ) : (
          items.map((item) => {
            const isActive = activeItemId != null && item.id === activeItemId
            const title = item.videoTitle || item.sourceLabel || item.objective || 'Sin fuente'
            const subtitle = item.url ?? item.sourceLabel ?? ''
            const assignedFolder = item.folderId ? folders.find((folder) => folder.id === item.folderId) : null
            const folderMeta = assignedFolder
              ? FOLDER_COLORS.find((entry) => entry.value === assignedFolder.color)
              : null
            const thumbHeightClass = isActive ? 'h-[62px]' : 'h-[46px]'

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectItem(item)}
                className={`group relative mb-2.5 w-full origin-left transform-gpu overflow-hidden rounded-r-2xl border border-l-0 text-left transition-all duration-300 ${
                  isActive
                    ? 'z-10 scale-100 border-[#caa66a] bg-[#fff7e4] px-3.5 py-3 ring-2 ring-[#e4c98f]/65 shadow-[0_20px_30px_-16px_rgba(91,64,33,0.65)]'
                    : 'scale-[0.94] border-[#dfcfac] bg-[#fffdf7] px-2.5 py-2 opacity-92 hover:scale-[0.97] hover:border-[#cfb884] hover:bg-[#fff7e8] hover:opacity-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -left-5 top-1/2 w-5 -translate-y-1/2 rounded-l-[13px] border border-r-0 ${
                    isActive
                      ? 'h-[80%] border-[#ac7f45] bg-gradient-to-r from-[#8f6534] to-[#dfc08a]'
                      : 'h-[74%] border-[#c8ad7b] bg-gradient-to-r from-[#b18854] to-[#e0c799]'
                  }`}
                />
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -left-9 top-1/2 w-6 -translate-y-1/2 rounded-l-[14px] ${
                    isActive ? 'h-[70%] bg-[#9d7747]/55' : 'h-[64%] bg-[#9b7850]/30'
                  } blur-[1px]`}
                />

                <div className="relative z-10 flex flex-col">
                  <div className="border-b border-[#e5d3b2] pb-2">
                    {item.thumbnailUrl ? (
                      <div className={`relative w-full overflow-hidden rounded-md border border-[#d8c7a3] ${thumbHeightClass}`}>
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.videoTitle ?? 'Miniatura'}
                          fill
                          sizes="260px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className={`flex w-full items-center justify-center rounded-md border border-[#d8c7a3] bg-[#efe2c9] text-[#8a6f46] ${thumbHeightClass}`}>
                        <SourceIcon sourceType={item.sourceType ?? 'youtube'} size={18} />
                      </div>
                    )}
                  </div>

                  <div className={`min-w-0 ${isActive ? 'pt-2.5' : 'pt-1.5'}`}>
                    <p className={`line-clamp-1 font-semibold text-[#493925] ${isActive ? 'text-[13.5px]' : 'text-[13px]'}`}>
                      {title}
                    </p>
                    <p className={`mt-1 line-clamp-1 text-[#745b3d] ${isActive ? 'text-[11px]' : 'text-[10px]'}`}>
                      {subtitle}
                    </p>

                    <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 leading-tight ${isActive ? 'text-[10px]' : 'text-[9px]'}`}>
                      <span className="rounded-full border border-[#dbcaa8] bg-[#f8efdf] px-2 py-0.5 text-[#6c5438]">
                        {formatHistoryDate(item.createdAt)}
                      </span>
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">
                        {getExtractionModeLabel(normalizeExtractionMode(item.mode))}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-semibold ${
                          item.shareVisibility === 'public'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : item.shareVisibility === 'unlisted'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : item.shareVisibility === 'circle'
                                ? 'border-sky-200 bg-sky-50 text-sky-700'
                                : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {getShareVisibilityLabel(item.shareVisibility)}
                      </span>
                      {assignedFolder && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${folderMeta?.active ?? ''}`}>
                          <Folder size={9} />
                          {assignedFolder.name}
                        </span>
                      )}
                      {item.orderNumber > 0 && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          #{item.orderNumber}
                        </span>
                      )}
                      <span
                        title={item.id}
                        className="max-w-[11rem] truncate rounded-full border border-[#d5c4a3] bg-[#f5ead5] px-2 py-0.5 font-mono text-[#6a5338]"
                      >
                        ID: {item.id}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
