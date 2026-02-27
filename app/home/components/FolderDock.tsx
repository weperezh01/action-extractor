'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { BookOpen, Check, ChevronDown, ChevronRight, Plus, UserPlus, X } from 'lucide-react'
import {
  isSystemExtractionFolderId,
  resolveSystemExtractionFolderKey,
} from '@/lib/extraction-folders'

export interface FolderItem {
  id: string
  name: string
  color: FolderColor
  parentId?: string | null
  isShared?: boolean
  ownerUserId?: string | null
  ownerName?: string | null
  ownerEmail?: string | null
  rootSharedFolderId?: string | null
}

export interface FolderPlaybookItem {
  id: string
  folderId: string | null
  title: string
  subtitle?: string | null
  createdAt?: string | null
  source?: 'mine' | 'shared'
  ownerName?: string | null
  ownerEmail?: string | null
}

export interface OpenDeskPlaybookItem {
  id: string
  title: string
  isMain: boolean
}

export type FolderColor =
  | 'amber'
  | 'indigo'
  | 'emerald'
  | 'rose'
  | 'sky'
  | 'violet'
  | 'orange'

export const FOLDER_COLORS: { value: FolderColor; dot: string; icon: string; active: string }[] = [
  { value: 'amber',   dot: 'bg-amber-400',   icon: 'text-amber-500',   active: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' },
  { value: 'indigo',  dot: 'bg-indigo-500',  icon: 'text-indigo-500',  active: 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30' },
  { value: 'emerald', dot: 'bg-emerald-500', icon: 'text-emerald-500', active: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' },
  { value: 'rose',    dot: 'bg-rose-500',    icon: 'text-rose-500',    active: 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30' },
  { value: 'sky',     dot: 'bg-sky-500',     icon: 'text-sky-500',     active: 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30' },
  { value: 'violet',  dot: 'bg-violet-500',  icon: 'text-violet-500',  active: 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30' },
  { value: 'orange',  dot: 'bg-orange-400',  icon: 'text-orange-500',  active: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30' },
]

function getColorMeta(color: FolderColor) {
  return FOLDER_COLORS.find((c) => c.value === color) ?? FOLDER_COLORS[0]
}

const ROOT_FOLDER_TAB_SELECTED_CLASS =
  'z-10 border-[#cfb07f] bg-[linear-gradient(180deg,#fff7e7_0%,#f1ddb7_58%,#e5c995_100%)] text-[#4f3b20] shadow-[0_18px_26px_-20px_rgba(74,52,26,0.85),inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-[#7a5f36] dark:bg-[linear-gradient(180deg,#3d3224_0%,#493a28_58%,#5a462f_100%)] dark:text-[#f2e4c6]'
const ROOT_FOLDER_TAB_IDLE_CLASS =
  'translate-y-1 border-[#d7c7ab] bg-[linear-gradient(180deg,#fffefb_0%,#f4ecdd_100%)] text-[#7b6546] opacity-95 hover:translate-y-0.5 hover:border-[#c9b28f] hover:bg-[linear-gradient(180deg,#fffdf7_0%,#f1e4cd_100%)] hover:text-[#5f4a2c] dark:border-[#4f4538] dark:bg-[linear-gradient(180deg,#26221d_0%,#2d271f_100%)] dark:text-[#b9a68c] dark:hover:border-[#6b5c46] dark:hover:bg-[linear-gradient(180deg,#332b22_0%,#3b3025_100%)] dark:hover:text-[#e2d2b4]'
const ROOT_FOLDER_LIP_SELECTED_CLASS =
  'border-[#cfb07f] bg-[linear-gradient(180deg,#fff4dc_0%,#edd19d_100%)] dark:border-[#7a5f36] dark:bg-[linear-gradient(180deg,#4b3c29_0%,#604b31_100%)]'
const ROOT_FOLDER_LIP_IDLE_CLASS =
  'border-[#d9c7a8] bg-[linear-gradient(180deg,#fffdf6_0%,#f4e6cd_100%)] dark:border-[#5a4b38] dark:bg-[linear-gradient(180deg,#2d251d_0%,#3a2f24_100%)]'

const SUB_FOLDER_TAB_SELECTED_CLASS =
  'z-10 border-[#ceb182] bg-[linear-gradient(180deg,#fff6e4_0%,#f2e1bb_62%,#e8cf9f_100%)] text-[#5a4325] shadow-[0_14px_22px_-18px_rgba(74,52,26,0.76),inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-[#806740] dark:bg-[linear-gradient(180deg,#3b3125_0%,#473927_62%,#594630_100%)] dark:text-[#eddcbf]'
const SUB_FOLDER_TAB_IDLE_CLASS =
  'translate-y-1 border-[#d7c9af] bg-[linear-gradient(180deg,#fffdf9_0%,#f6efe1_100%)] text-[#846c4c] opacity-90 hover:translate-y-0.5 hover:border-[#c8b390] hover:bg-[linear-gradient(180deg,#fffdf7_0%,#f1e5d1_100%)] hover:text-[#634d30] dark:border-[#4e4539] dark:bg-[linear-gradient(180deg,#26221d_0%,#2e2821_100%)] dark:text-[#bba98f] dark:hover:border-[#6a5c48] dark:hover:bg-[linear-gradient(180deg,#322b22_0%,#3a3025_100%)] dark:hover:text-[#dfcfb4]'
const SUB_FOLDER_LIP_SELECTED_CLASS =
  'border-[#ceb182] bg-[linear-gradient(180deg,#fff5df_0%,#edd8ac_100%)] dark:border-[#806740] dark:bg-[linear-gradient(180deg,#4a3d2b_0%,#5b4a32_100%)]'
const SUB_FOLDER_LIP_IDLE_CLASS =
  'border-[#dccbad] bg-[linear-gradient(180deg,#fffef8_0%,#f5ead5_100%)] dark:border-[#5b4f3c] dark:bg-[linear-gradient(180deg,#2e261e_0%,#3b3024_100%)]'

interface FolderDockProps {
  folders: FolderItem[]
  activeFolderIds: string[]
  folderCounts: Record<string, number>
  playbooks: FolderPlaybookItem[]
  activePlaybookId?: string | null
  openDeskPlaybooks?: OpenDeskPlaybookItem[]
  onFolderToggle: (id: string) => void
  onCreateFolder: (name: string, color: FolderColor, parentId?: string | null) => void
  onDeleteFolder: (id: string) => void
  onManageFolderShare?: (folderId: string) => void
  onSelectPlaybook?: (playbookId: string, source?: 'mine' | 'shared') => void
  onFocusOpenDeskPlaybook?: (playbookId: string) => void
  onCloseOpenDeskPlaybook?: (playbookId: string) => void
}

interface CreateFormProps {
  inputRef: RefObject<HTMLInputElement>
  newName: string
  newColor: FolderColor
  onNameChange: (v: string) => void
  onColorChange: (c: FolderColor) => void
  onCreate: () => void
  onCancel: () => void
  placeholder?: string
}

function CreateForm({
  inputRef,
  newName,
  newColor,
  onNameChange,
  onColorChange,
  onCreate,
  onCancel,
  placeholder = 'Nombre de la carpeta',
}: CreateFormProps) {
  return (
    <div className="relative w-full max-w-[280px] rounded-t-xl border border-b-0 border-[#cdb084] bg-[linear-gradient(180deg,#fff8ea_0%,#f2e1bf_100%)] px-2.5 py-2 shadow-[0_16px_24px_-18px_rgba(74,52,26,0.62)] dark:border-[#7b623d] dark:bg-[linear-gradient(180deg,#3d3224_0%,#4c3c29_100%)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 -top-[10px] h-[10px] w-[44px] rounded-t-md border border-b-0 border-[#cdb084] bg-[linear-gradient(180deg,#fff2d7_0%,#ead09e_100%)] dark:border-[#7b623d] dark:bg-[linear-gradient(180deg,#4c3c2a_0%,#5f4a32_100%)]"
      />
      <input
        ref={inputRef}
        type="text"
        value={newName}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCreate()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        maxLength={30}
        className="mb-2 h-8 w-full rounded-md border border-[#cfbe9f] bg-[#fffdf7] px-2.5 text-xs text-[#5b4630] outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 dark:border-[#6a5840] dark:bg-[#2f271f] dark:text-[#f0e3ca] dark:placeholder:text-[#b9a58a]"
      />
      <div className="mb-2.5 flex items-center gap-1.5">
        {FOLDER_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onColorChange(c.value)}
            aria-label={c.value}
            className={`h-4 w-4 rounded-full ring-1 ring-black/10 transition-transform ${c.dot} ${
              newColor === c.value
                ? 'scale-125 ring-2 ring-offset-1 ring-indigo-400 dark:ring-offset-zinc-900'
                : 'opacity-70 hover:opacity-100'
            }`}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onCreate}
          disabled={!newName.trim()}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-indigo-600 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <Check size={10} />
          Crear
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[#cfbe9f] px-2.5 py-1.5 text-[10px] text-[#6d553b] transition-colors hover:bg-[#f7edda] dark:border-[#6a5840] dark:text-[#cdbb9e] dark:hover:bg-[#3a3025]"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  )
}

const TREE_INDENT_PX = 18
const MAX_INDENT_LEVEL = 9

function getIndentPx(depth: number) {
  return Math.min(depth, MAX_INDENT_LEVEL) * TREE_INDENT_PX
}

function buildFolderPathLabel(folderId: string, folderById: Map<string, FolderItem>) {
  const names: string[] = []
  const visited = new Set<string>()
  let cursorId: string | null = folderId

  while (cursorId && !visited.has(cursorId)) {
    visited.add(cursorId)
    const folder = folderById.get(cursorId)
    if (!folder) break
    names.push(folder.name)
    cursorId = folder.parentId ?? null
  }

  return names.reverse().join(' / ')
}

function formatPaperDate(isoDate: string | null | undefined) {
  if (!isoDate) return ''
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function normalizeSearchText(value: string | null | undefined) {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function FolderStateIcon({
  isOpen,
  accentDotClass,
}: {
  isOpen: boolean
  accentDotClass: string
}) {
  return (
    <span
      className={`relative inline-flex h-6 w-7 shrink-0 items-center justify-center transition-transform duration-200 ease-out ${
        isOpen ? '-translate-y-0.5 scale-[1.05]' : 'scale-100'
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 20" className="h-[19px] w-[24px] overflow-visible">
        <path
          d="M2.4 8.9c0-1.2.9-2.1 2.1-2.1h14.9c1.1 0 2 .9 2 2v1.1H2.4V8.9Z"
          className="fill-[#f5d8aa] stroke-[#b88041] dark:fill-[#4f3f2d] dark:stroke-[#cd9d65]"
          strokeWidth="1"
        />
        <path
          d="M2.4 9.8h19v6.7c0 1.1-.9 2-2 2H4.4c-1.1 0-2-.9-2-2V9.8Z"
          className="fill-[#edbe72] stroke-[#a16f37] dark:fill-[#755831] dark:stroke-[#cc9b61]"
          strokeWidth="1"
        />
        {isOpen && (
          <path
            d="M3.2 11.1h17.4"
            className="stroke-[#f9ddb2] dark:stroke-[#bb9463]"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        )}
        <g
          className="transition-transform duration-200 ease-out"
          style={{
            transformOrigin: '7px 8px',
            transform: isOpen ? 'translateY(-1.8px) rotate(-17deg)' : 'translateY(0px) rotate(0deg)',
          }}
        >
          <path
            d="M2.5 7.3c0-1.1.9-2 2-2H9l1.5 1.8h8.9c1.1 0 2 .9 2 2v.8H2.5v-2.6Z"
            className="fill-[#f7dfb8] stroke-[#b98549] dark:fill-[#544331] dark:stroke-[#cd9d67]"
            strokeWidth="1"
          />
          <path
            d="M3.8 8.2h15.7"
            className="stroke-[#ffe8c4] dark:stroke-[#d0ab7a]"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-1 ring-white/90 dark:ring-zinc-900 ${accentDotClass}`} />
    </span>
  )
}

export function FolderDock({
  folders,
  activeFolderIds,
  folderCounts,
  playbooks,
  activePlaybookId = null,
  openDeskPlaybooks = [],
  onFolderToggle,
  onCreateFolder,
  onDeleteFolder,
  onManageFolderShare,
  onSelectPlaybook,
  onFocusOpenDeskPlaybook,
  onCloseOpenDeskPlaybook,
}: FolderDockProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<FolderColor>('indigo')
  const [deskSearch, setDeskSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const folderById = useMemo(() => {
    const map = new Map<string, FolderItem>()
    folders.forEach((folder) => map.set(folder.id, folder))
    return map
  }, [folders])

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, FolderItem[]>()
    const pushChild = (parentId: string | null, folder: FolderItem) => {
      const existing = map.get(parentId)
      if (existing) {
        existing.push(folder)
        return
      }
      map.set(parentId, [folder])
    }

    folders.forEach((folder) => {
      const parentId = folder.parentId && folderById.has(folder.parentId) ? folder.parentId : null
      pushChild(parentId, folder)
    })

    return map
  }, [folderById, folders])

  const rootFolders = childrenByParent.get(null) ?? []

  const cancelCreate = () => {
    setIsCreating(false)
    setCreatingParentId(null)
    setNewName('')
    setNewColor('indigo')
  }

  useEffect(() => {
    if (isCreating) {
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isCreating])

  useEffect(() => {
    if (rootFolders.length === 0) return
    setExpandedIds((previous) => {
      const next = new Set(previous)
      let changed = false
      rootFolders.forEach((folder) => {
        if (!next.has(folder.id)) {
          next.add(folder.id)
          changed = true
        }
      })
      return changed ? next : previous
    })
  }, [rootFolders])

  useEffect(() => {
    const sharedWithMeRoot = folders.find(
      (folder) => resolveSystemExtractionFolderKey(folder.id) === 'shared-with-me'
    )
    if (!sharedWithMeRoot) return

    const hasSharedFolders = folders.some((folder) => folder.isShared === true)
    if (!hasSharedFolders) return

    setExpandedIds((previous) => {
      if (previous.has(sharedWithMeRoot.id)) return previous
      const next = new Set(previous)
      next.add(sharedWithMeRoot.id)
      return next
    })
  }, [folders])

  useEffect(() => {
    if (activeFolderIds.length === 0) return
    setExpandedIds((previous) => {
      const next = new Set(previous)
      let changed = false

      activeFolderIds.forEach((id) => {
        const visited = new Set<string>()
        let cursor = folderById.get(id)?.parentId ?? null

        while (cursor && !visited.has(cursor)) {
          visited.add(cursor)
          if (!next.has(cursor)) {
            next.add(cursor)
            changed = true
          }
          cursor = folderById.get(cursor)?.parentId ?? null
        }
      })

      return changed ? next : previous
    })
  }, [activeFolderIds, folderById])

  useEffect(() => {
    if (!isCreating || !creatingParentId) return
    if (!folderById.has(creatingParentId)) {
      cancelCreate()
    }
  }, [creatingParentId, folderById, isCreating])

  const openCreate = (parentId: string | null) => {
    if (parentId) {
      setExpandedIds((previous) => {
        if (previous.has(parentId)) return previous
        const next = new Set(previous)
        next.add(parentId)
        return next
      })
    }
    setCreatingParentId(parentId)
    setNewName('')
    setNewColor('indigo')
    setIsCreating(true)
  }

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) { cancelCreate(); return }
    onCreateFolder(name, newColor, creatingParentId)
    cancelCreate()
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const requestDeleteFolder = (folder: FolderItem) => {
    if (isSystemExtractionFolderId(folder.id) || folder.isShared) return

    const childFolders = childrenByParent.get(folder.id) ?? []
    const hasChildFolders = childFolders.length > 0
    const ownPlaybookCount = folderCounts[folder.id] ?? 0

    const messageLines = [`¿Eliminar la carpeta "${folder.name}"?`]
    if (hasChildFolders) {
      messageLines.push('También se eliminarán sus subcarpetas.')
    }
    if (ownPlaybookCount > 0) {
      messageLines.push(
        `Contiene ${ownPlaybookCount} playbook${ownPlaybookCount === 1 ? '' : 's'}.`
      )
    }
    messageLines.push('Esta acción no se puede deshacer.')

    const shouldDelete =
      typeof window === 'undefined' ? true : window.confirm(messageLines.join('\n'))
    if (!shouldDelete) return

    onDeleteFolder(folder.id)
  }

  const selectedFolderIds = useMemo(
    () => activeFolderIds.filter((id) => folderById.has(id)),
    [activeFolderIds, folderById]
  )
  const selectedFolderId = selectedFolderIds.length > 0
    ? selectedFolderIds[selectedFolderIds.length - 1] ?? null
    : null
  const selectedFolder = selectedFolderId ? folderById.get(selectedFolderId) ?? null : null
  const selectedFolderSystemKey = resolveSystemExtractionFolderKey(selectedFolder?.id)
  const canCreateInSelectedFolder = Boolean(
    selectedFolder &&
      !selectedFolder.isShared &&
      selectedFolderSystemKey !== 'shared-with-me'
  )
  const selectedFolderIdSet = useMemo(() => new Set(selectedFolderIds), [selectedFolderIds])
  const isSharedWithMeSelected = useMemo(
    () => selectedFolderIds.some((id) => resolveSystemExtractionFolderKey(id) === 'shared-with-me'),
    [selectedFolderIds]
  )
  const hasDeskSelection = selectedFolderIds.length > 0
  const playbooksInDeskSelection = useMemo(
    () =>
      hasDeskSelection
        ? playbooks.filter((playbook) => {
            if (playbook.folderId != null && selectedFolderIdSet.has(playbook.folderId)) {
              return true
            }
            if (isSharedWithMeSelected && playbook.source === 'shared') {
              return true
            }
            return false
          })
        : [],
    [hasDeskSelection, isSharedWithMeSelected, playbooks, selectedFolderIdSet]
  )
  const createTargetId = canCreateInSelectedFolder && selectedFolder ? selectedFolder.id : null
  const createButtonLabel =
    canCreateInSelectedFolder && selectedFolder ? `Nueva en ${selectedFolder.name}` : 'Nueva raíz'
  const normalizedDeskSearch = useMemo(() => normalizeSearchText(deskSearch).trim(), [deskSearch])
  const filteredPlaybooksInDeskSelection = useMemo(() => {
    if (normalizedDeskSearch.length === 0) return playbooksInDeskSelection

    return playbooksInDeskSelection.filter((playbook) => {
      const searchable = [
        playbook.id,
        playbook.folderId ?? '',
        playbook.title,
        playbook.subtitle ?? '',
        playbook.createdAt ?? '',
        formatPaperDate(playbook.createdAt),
      ].join(' ')

      return normalizeSearchText(searchable).includes(normalizedDeskSearch)
    })
  }, [normalizedDeskSearch, playbooksInDeskSelection])
  const visiblePaperCount = hasDeskSelection ? filteredPlaybooksInDeskSelection.length : 0
  const totalPaperCount = hasDeskSelection ? playbooksInDeskSelection.length : 0
  const deskPaperCountLabel =
    normalizedDeskSearch.length > 0
      ? `${visiblePaperCount} de ${totalPaperCount} papeles`
      : `${totalPaperCount} papeles`
  const deskSelectionKey = useMemo(() => selectedFolderIds.join('|'), [selectedFolderIds])

  useEffect(() => {
    setDeskSearch('')
  }, [deskSelectionKey])

  const activeFolderPaths = selectedFolderIds
    .map((id) => (folderById.has(id) ? buildFolderPathLabel(id, folderById) : null))
    .filter((path): path is string => Boolean(path))
  const activeFoldersSummary = activeFolderPaths.join(' · ')
  const deskFolderPathLabel =
    activeFolderPaths.length === 0
      ? null
      : activeFolderPaths.length === 1
        ? activeFolderPaths[0] ?? null
        : `${activeFolderPaths.length} carpetas seleccionadas`
  const openDeskPlaybookIds = useMemo(() => {
    const ids = new Set<string>()
    openDeskPlaybooks.forEach((playbook) => {
      const id = playbook.id.trim()
      if (id.length > 0) ids.add(id)
    })
    return ids
  }, [openDeskPlaybooks])
  const activeBranchIds = useMemo(() => {
    const branchIds = new Set<string>()

    selectedFolderIds.forEach((id) => {
      const visited = new Set<string>()
      let cursorId: string | null = id

      while (cursorId && !visited.has(cursorId)) {
        visited.add(cursorId)
        branchIds.add(cursorId)
        cursorId = folderById.get(cursorId)?.parentId ?? null
      }
    })

    return branchIds
  }, [folderById, selectedFolderIds])

  const renderFolderNode = (folder: FolderItem, depth: number): ReactNode => {
    const children = childrenByParent.get(folder.id) ?? []
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(folder.id)
    const isSelected = activeFolderIds.includes(folder.id)
    const isOnActiveBranch = activeBranchIds.has(folder.id)
    const isSharedFolder = folder.isShared === true
    const meta = getColorMeta(folder.color)
    const count = folderCounts[folder.id] ?? 0
    const isRoot = depth === 0

    const tabClasses = isRoot
      ? isSelected
        ? ROOT_FOLDER_TAB_SELECTED_CLASS
        : ROOT_FOLDER_TAB_IDLE_CLASS
      : isSelected
        ? SUB_FOLDER_TAB_SELECTED_CLASS
        : SUB_FOLDER_TAB_IDLE_CLASS
    const lipClasses = isRoot
      ? isSelected
        ? ROOT_FOLDER_LIP_SELECTED_CLASS
        : ROOT_FOLDER_LIP_IDLE_CLASS
      : isSelected
        ? SUB_FOLDER_LIP_SELECTED_CLASS
        : SUB_FOLDER_LIP_IDLE_CLASS
    const buttonSize = isRoot
      ? 'h-10 min-w-[124px] max-w-[260px] px-3 text-xs'
      : 'h-8 min-w-[104px] max-w-[240px] px-2.5 text-[11px]'
    const lipSize = isRoot
      ? 'left-4 -top-[10px] h-[10px] w-[46px]'
      : 'left-3 -top-[8px] h-[8px] w-[34px]'
    const topDotSize = isRoot
      ? 'left-[1.7rem] -top-[6px] h-1.5 w-3.5'
      : 'left-[1.2rem] -top-[4px] h-1 w-3'
    const countBadgeSize = isRoot ? 'h-5 min-w-[20px] text-[10px]' : 'h-4 min-w-[16px] text-[9px]'
    const connectorGuideClass = isOnActiveBranch
      ? 'bg-[#b89362] dark:bg-[#a2835e]'
      : 'bg-[#d7c4a6] dark:bg-[#61503d]'
    const isFolderOpenVisual = isSelected
    const canManageShare = !isSharedFolder && !isSystemExtractionFolderId(folder.id) && Boolean(onManageFolderShare)
    const canDelete = !isSharedFolder && !isSystemExtractionFolderId(folder.id)
    const sharedByLabel = folder.ownerName?.trim() || folder.ownerEmail || 'otro usuario'

    return (
      <div key={folder.id} className="mt-1.5">
        <div className="relative flex items-end gap-1.5" style={{ marginLeft: getIndentPx(depth) }}>
          {depth > 0 && (
            <>
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -left-3.5 top-1/2 h-px w-3.5 -translate-y-1/2 rounded-full ${connectorGuideClass}`}
              />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -left-3.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${connectorGuideClass}`}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (hasChildren) toggleExpanded(folder.id)
            }}
            disabled={!hasChildren}
            aria-label={
              hasChildren
                ? isExpanded
                  ? `Contraer carpeta ${folder.name}`
                  : `Expandir carpeta ${folder.name}`
                : `Carpeta ${folder.name} sin subcarpetas`
            }
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[#7b6546] transition-colors dark:text-[#c3ae90] ${
              hasChildren
                ? isOnActiveBranch
                  ? 'border-[#bf9a68] bg-[#f5e6c9] hover:border-[#b08b58] hover:bg-[#efd8ae] dark:border-[#7f6545] dark:bg-[#3c3125] dark:hover:border-[#917252] dark:hover:bg-[#4b3a2a]'
                  : 'border-[#d8c7aa] bg-[#fbf2e2] hover:border-[#c2aa84] hover:bg-[#f3e1c2] dark:border-[#655640] dark:bg-[#332a21] dark:hover:border-[#7d6a4c] dark:hover:bg-[#443628]'
                : 'cursor-default border-transparent bg-transparent'
            }`}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-[#d8bf98] dark:bg-[#6f5d45]" />
            )}
          </button>

          <div className="group relative flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                onFolderToggle(folder.id)
                if (hasChildren) {
                  setExpandedIds((previous) => {
                    if (previous.has(folder.id)) return previous
                    const next = new Set(previous)
                    next.add(folder.id)
                    return next
                  })
                }
              }}
              className={`relative -mb-px inline-flex items-center gap-1.5 rounded-t-xl border border-b-0 font-semibold transition-all duration-200 ${buttonSize} ${tabClasses}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute rounded-t-md border border-b-0 ${lipSize} ${lipClasses}`}
              />
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/70 dark:bg-white/10" />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute rounded-full ${topDotSize} ${meta.dot} ${isSelected ? 'opacity-95' : 'opacity-80'}`}
              />
              <FolderStateIcon isOpen={isFolderOpenVisual} accentDotClass={meta.dot} />
              {isSelected && (
                <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Check size={8} />
                </span>
              )}
              <span className="truncate">{folder.name}</span>
              {isSharedFolder && (
                <span
                  title={`Compartida por ${sharedByLabel}`}
                  className="inline-flex h-4 items-center rounded-full border border-sky-200 bg-sky-50 px-1.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:border-sky-700 dark:bg-sky-900/25 dark:text-sky-300"
                >
                  Compartida
                </span>
              )}
              {hasChildren && (
                <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#eee0c6] px-1 text-[9px] font-bold text-[#7a5c37] dark:bg-[#5e4a32] dark:text-[#f0ddba]">
                  {children.length}
                </span>
              )}
              {count > 0 && (
                <span className={`ml-auto inline-flex items-center justify-center rounded-full px-1 font-bold ${countBadgeSize} ${
                  isSelected
                    ? 'bg-[#7d6040] text-[#fff7e8] dark:bg-[#d4bf98] dark:text-[#3f3120]'
                    : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                }`}>
                  {count}
                </span>
              )}
            </button>

            {(canManageShare || canDelete) && (
              <div className="absolute -right-1 -top-1 z-20 hidden items-center gap-1 group-hover:flex">
                {canManageShare && (
                  <button
                    type="button"
                    onClick={() => onManageFolderShare?.(folder.id)}
                    aria-label={`Compartir carpeta ${folder.name}`}
                    title={`Compartir carpeta ${folder.name}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-500 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 dark:border-sky-800 dark:bg-zinc-900 dark:text-sky-400 dark:hover:border-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
                  >
                    <UserPlus size={9} />
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => requestDeleteFolder(folder)}
                    aria-label={`Eliminar carpeta ${folder.name}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                  >
                    <X size={9} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isCreating && creatingParentId === folder.id && (
          <div className="mt-1" style={{ marginLeft: getIndentPx(depth + 1) }}>
            <CreateForm
              inputRef={inputRef}
              newName={newName}
              newColor={newColor}
              onNameChange={setNewName}
              onColorChange={setNewColor}
              onCreate={handleCreate}
              onCancel={cancelCreate}
              placeholder={`Nombre dentro de ${folder.name}`}
            />
          </div>
        )}

        {hasChildren && isExpanded && (
          <div
            className={`mt-1.5 rounded-lg border px-1.5 py-1 dark:bg-[#2e261f]/45 ${
              isOnActiveBranch
                ? 'border-[#d2b689]/85 bg-[#fff6e4]/85 dark:border-[#7f6545]/80'
                : 'border-[#e8dbc5]/70 bg-[#fffaf0]/70 dark:border-[#554735]/70'
            }`}
          >
            <p className="px-1 text-[9px] font-semibold uppercase tracking-wide text-[#8b6f4a] dark:text-[#bea483]">
              Subcarpetas
            </p>
            <div className="relative mt-0.5">
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute bottom-0 left-[10px] top-0 w-px ${
                  isOnActiveBranch ? 'bg-[#bf9a68] dark:bg-[#8d6f4e]' : 'bg-[#dcccad] dark:bg-[#5f4e3c]'
                }`}
              />
              <div className="space-y-1">
                {children.map((child) => renderFolderNode(child, depth + 1))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="-mb-px mx-auto w-full max-w-5xl px-1 pb-0 pt-2">
      {activeFolderPaths.length > 0 && (
        <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
          Activas: {activeFoldersSummary}
        </p>
      )}
      <div className="rounded-xl border border-[#d7c6a7]/70 bg-[linear-gradient(180deg,#fffdfa_0%,#f7efdf_100%)] p-2 shadow-[0_10px_22px_-20px_rgba(74,52,26,0.65)] dark:border-[#5d4f3f]/80 dark:bg-[linear-gradient(180deg,#26211c_0%,#2f271f_100%)]">
        <div className="grid gap-2 lg:grid-cols-[minmax(14.5rem,max-content)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 px-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d714e] dark:text-[#c8b292]">
                Carpetas
              </p>
              {!isCreating ? (
                <button
                  type="button"
                  onClick={() => openCreate(createTargetId)}
                  title={createButtonLabel}
                  className="inline-flex items-center gap-1 rounded-md border border-[#ccb085] bg-[linear-gradient(180deg,#fff7e8_0%,#efdbb3_100%)] px-2 py-1 text-[10px] font-semibold text-[#5e4728] transition-colors hover:border-[#b49361] hover:bg-[linear-gradient(180deg,#fff4e1_0%,#e8cd98_100%)] dark:border-[#705c3f] dark:bg-[linear-gradient(180deg,#3b2f24_0%,#4c3a2a_100%)] dark:text-[#e0ceaf] dark:hover:border-[#8d734f] dark:hover:bg-[linear-gradient(180deg,#4a392a_0%,#5b4733_100%)]"
                >
                  <Plus size={11} />
                  <span className="truncate">Nueva carpeta</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelCreate}
                  className="inline-flex items-center rounded-md border border-[#ccb085] px-2 py-1 text-[10px] font-semibold text-[#6c5436] transition-colors hover:bg-[#f8ecd6] dark:border-[#6f5d43] dark:text-[#cdbb9d] dark:hover:bg-[#3b3025]"
                >
                  Cancelar
                </button>
              )}
            </div>

            {hasDeskSelection && !isCreating && (
              <p className="mb-2 px-1 text-[10px] text-[#886d4b] dark:text-[#bda789]">
                {selectedFolderIds.length > 1 ? 'Destinos activos:' : 'Destino actual:'}{' '}
                <span className="font-semibold">{deskFolderPathLabel}</span>
              </p>
            )}

            {isCreating && creatingParentId === null && (
              <div className="mb-2 px-1">
                <CreateForm
                  inputRef={inputRef}
                  newName={newName}
                  newColor={newColor}
                  onNameChange={setNewName}
                  onColorChange={setNewColor}
                  onCreate={handleCreate}
                  onCancel={cancelCreate}
                  placeholder={selectedFolder ? `Nombre dentro de ${selectedFolder.name}` : 'Nombre de la carpeta'}
                />
              </div>
            )}

            <div className="max-h-[330px] overflow-y-auto overflow-x-hidden pr-1">
              {rootFolders.length === 0 && !isCreating ? (
                <p className="px-1 py-4 text-xs text-[#8c7352] dark:text-[#b9a487]">
                  Crea tu primera carpeta para comenzar a organizar tus playbooks.
                </p>
              ) : (
                <div className="space-y-1">{rootFolders.map((folder) => renderFolderNode(folder, 0))}</div>
              )}
            </div>
          </div>

          <aside className="folder-playbooks-desk min-w-0 rounded-lg p-2">
            <span aria-hidden="true" className="folder-playbooks-desk-stamp">
              Escritorio
            </span>
            <div
              className="folder-playbooks-desk-layout"
              data-has-open={openDeskPlaybooks.length > 0 ? 'true' : 'false'}
            >
              {openDeskPlaybooks.length > 0 && (
                <div className="folder-playbooks-openbar">
                  <p className="folder-playbooks-openbar-label">
                    Abiertos ({openDeskPlaybooks.length})
                  </p>
                  <div className="folder-playbooks-openbar-scroll">
                    {openDeskPlaybooks.map((playbook) => (
                      <div
                        key={`open-desk-chip-${playbook.id}`}
                        className={`folder-playbooks-openbar-chip ${
                          playbook.isMain
                            ? 'folder-playbooks-openbar-chip-main'
                            : 'folder-playbooks-openbar-chip-secondary'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onFocusOpenDeskPlaybook?.(playbook.id)}
                          className="folder-playbooks-openbar-chip-focus"
                          title={`Ir a ${playbook.title}`}
                        >
                          <span className="folder-playbooks-openbar-chip-icon">
                            <BookOpen size={11} />
                          </span>
                          <span className="folder-playbooks-openbar-chip-title">{playbook.title}</span>
                        </button>
                        {onCloseOpenDeskPlaybook && (
                          <button
                            type="button"
                            onClick={() => onCloseOpenDeskPlaybook(playbook.id)}
                            className="folder-playbooks-openbar-chip-close"
                            aria-label={`Cerrar ${playbook.title}`}
                            title={`Cerrar ${playbook.title}`}
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="folder-playbooks-desk-surface">
                <div className="folder-playbooks-desk-header">
                  <p className="folder-playbooks-desk-path truncate text-[11px] font-semibold">
                    {deskFolderPathLabel ?? 'Selecciona una carpeta'}
                  </p>
                  <span className="folder-playbooks-desk-accessories" aria-hidden="true">
                    <span className="folder-playbooks-desk-calculator">
                      <span className="folder-playbooks-desk-calculator-screen" />
                      <span className="folder-playbooks-desk-calculator-keys">
                        <span className="folder-playbooks-desk-calculator-key" />
                        <span className="folder-playbooks-desk-calculator-key" />
                        <span className="folder-playbooks-desk-calculator-key" />
                        <span className="folder-playbooks-desk-calculator-key" />
                        <span className="folder-playbooks-desk-calculator-key" />
                        <span className="folder-playbooks-desk-calculator-key" />
                        <span className="folder-playbooks-desk-calculator-key" />
                        <span className="folder-playbooks-desk-calculator-key" />
                        <span className="folder-playbooks-desk-calculator-key" />
                      </span>
                    </span>
                    <span className="folder-playbooks-desk-pen" />
                    <span className="folder-playbooks-desk-sticky">nota</span>
                  </span>
                </div>

                {hasDeskSelection && (
                  <>
                    <div className="folder-playbooks-desk-search mt-1.5">
                      <input
                        type="text"
                        value={deskSearch}
                        onChange={(e) => setDeskSearch(e.target.value)}
                        placeholder="Buscar por titulo, ID o fecha"
                        className="folder-playbooks-desk-search-input"
                        aria-label="Buscar playbooks en la carpeta"
                      />
                      {deskSearch.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDeskSearch('')}
                          className="folder-playbooks-desk-search-clear"
                          aria-label="Limpiar busqueda"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <p className="folder-playbooks-desk-count mt-1">
                      {deskPaperCountLabel}
                    </p>

                    <div className="folder-playbooks-desk-scroll mt-1.5 max-h-[50vh] overflow-y-auto pr-1">
                      {playbooksInDeskSelection.length === 0 ? (
                        <p className="folder-playbooks-desk-empty rounded-md px-2.5 py-2 text-xs">
                          Las carpetas seleccionadas aún no tienen playbooks.
                        </p>
                      ) : filteredPlaybooksInDeskSelection.length === 0 ? (
                        <p className="folder-playbooks-desk-empty rounded-md px-2.5 py-2 text-xs">
                          No hay playbooks que coincidan con tu búsqueda.
                        </p>
                      ) : (
                        <div className="relative pt-1">
                          {filteredPlaybooksInDeskSelection.map((playbook, index) => {
                            const isActive = activePlaybookId != null && activePlaybookId === playbook.id
                            const isOpenInDesk = openDeskPlaybookIds.has(playbook.id)
                            const paperAngleClass = index % 2 === 0 ? '-rotate-[0.35deg]' : 'rotate-[0.35deg]'
                            const paperDate = formatPaperDate(playbook.createdAt)
                            const playbookFolderLabel = playbook.folderId
                              ? buildFolderPathLabel(playbook.folderId, folderById)
                              : 'General'
                            const stackZIndex = isActive
                              ? filteredPlaybooksInDeskSelection.length + 20
                              : index + 1
                            const ownerSignature = (() => {
                              const ownerName = playbook.ownerName?.trim()
                              if (ownerName) return ownerName
                              const ownerEmail = playbook.ownerEmail?.trim()
                              if (ownerEmail) return ownerEmail
                              return playbook.source === 'mine' ? 'Propietario' : 'Sin firma'
                            })()
                            return (
                              <div
                                key={playbook.id}
                                className={`relative ${index === 0 ? '' : '-mt-3'}`}
                                style={{ zIndex: stackZIndex }}
                              >
                                <button
                                  type="button"
                                  onClick={() => onSelectPlaybook?.(playbook.id, playbook.source)}
                                  disabled={!onSelectPlaybook}
                                  title={playbook.title}
                                  className={`folder-playbooks-desk-card group relative w-full rounded-sm border text-left transition-all duration-200 ${
                                    isActive
                                      ? 'rotate-0 border-[#c69d64] bg-[linear-gradient(180deg,#fff7e6_0%,#f5e2bd_100%)] px-3 pt-2.5 pb-4 shadow-[0_14px_22px_-18px_rgba(92,63,29,0.95)]'
                                      : isOpenInDesk
                                        ? `${paperAngleClass} border-[#cda66f] bg-[linear-gradient(180deg,#fff8e8_0%,#f4e4c5_100%)] px-2.5 pt-2 pb-3.5 shadow-[0_10px_18px_-14px_rgba(92,63,29,0.9)] ring-1 ring-[#efd3a7]/80 hover:rotate-0 hover:border-[#bc9156] hover:bg-[linear-gradient(180deg,#fff7e1_0%,#efdbb4_100%)]`
                                      : `${paperAngleClass} border-[#d8c5a5] bg-[linear-gradient(180deg,#fffefb_0%,#f6ead3_100%)] px-2.5 pt-2 pb-3.5 shadow-[0_8px_16px_-16px_rgba(92,63,29,0.95)] hover:rotate-0 hover:border-[#c7aa7d] hover:bg-[linear-gradient(180deg,#fffdf7_0%,#f1dfbe_100%)]`
                                  } disabled:cursor-default dark:border-[#6b5740] dark:bg-[linear-gradient(180deg,#3c3024_0%,#34291f_100%)] dark:hover:border-[#82684a] dark:hover:bg-[linear-gradient(180deg,#443629_0%,#3b2d22_100%)]`}
                                >
                                  <span className="pointer-events-none absolute inset-x-1 top-1 h-px bg-[#fff9ef] dark:bg-[#ead8bc]/25" />
                                  <span className="pointer-events-none absolute left-1.5 top-0.5 h-[2px] w-12 rounded-full bg-[#f3dfbb] dark:bg-[#9d7d53]/45" />
                                  <p className="line-clamp-2 text-[12px] font-semibold text-[#533c21] dark:text-[#ead7b9]">
                                    {playbook.title}
                                  </p>
                                  {playbook.subtitle && (
                                    <p className="mt-0.5 line-clamp-1 text-[10px] text-[#7a6140] dark:text-[#bda587]">
                                      {playbook.subtitle}
                                    </p>
                                  )}
                                  <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-[#8a6b46] dark:text-[#b9a182]">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <span className={`rounded-full border px-1.5 py-[1px] uppercase tracking-wide ${
                                        isOpenInDesk
                                          ? 'border-[#c7a06a] bg-[#f4dfbc] text-[#684423] dark:border-[#9e7a4f] dark:bg-[#5a442e] dark:text-[#f0ddbf]'
                                          : 'border-[#ddc9a8] bg-[#f9f0df] dark:border-[#6b5841] dark:bg-[#463729]'
                                      }`}>
                                        {isOpenInDesk ? 'Abierto' : 'Papel'}
                                      </span>
                                      <span
                                        title={`Carpeta: ${playbookFolderLabel}`}
                                        className="max-w-[9.8rem] truncate rounded-full border border-[#d6c3a1] bg-[#f8ecd6] px-1.5 py-[1px] text-[9px] font-semibold text-[#6d5233] dark:border-[#6b5841] dark:bg-[#4a3a2c] dark:text-[#e1ccad]"
                                      >
                                        {playbookFolderLabel}
                                      </span>
                                    </div>
                                    {paperDate && <span className="shrink-0">{paperDate}</span>}
                                  </div>
                                  <p
                                    title={`Dueño: ${ownerSignature}`}
                                    className="folder-playbooks-desk-owner-signature"
                                  >
                                    {ownerSignature}
                                  </p>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

              </div>

            </div>
            <span className="folder-playbooks-desk-bottom-accessories" aria-hidden="true">
              <span className="folder-playbooks-desk-keyboard" />
              <span className="folder-playbooks-desk-mouse" />
            </span>
          </aside>
        </div>
      </div>
    </div>
  )
}
