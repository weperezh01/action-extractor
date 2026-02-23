'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Folder, FolderOpen, Plus, X } from 'lucide-react'

export interface FolderItem {
  id: string
  name: string
  color: FolderColor
  parentId?: string | null
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

interface FolderDockProps {
  folders: FolderItem[]
  activeFolderIds: string[]
  folderCounts: Record<string, number>
  onFolderToggle: (id: string) => void
  onCreateFolder: (name: string, color: FolderColor, parentId?: string | null) => void
  onDeleteFolder: (id: string) => void
}

interface CreateFormProps {
  inputRef: React.RefObject<HTMLInputElement>
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
    <div className="flex-shrink-0 min-w-[168px] rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3 shadow-sm dark:border-indigo-800/60 dark:bg-indigo-950/30">
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
        className="mb-2 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      <div className="mb-2.5 flex items-center gap-1.5">
        {FOLDER_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onColorChange(c.value)}
            aria-label={c.value}
            className={`h-4 w-4 rounded-full transition-transform ${c.dot} ${
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
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <Check size={10} />
          Crear
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:hover:bg-white/5"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  )
}

export function FolderDock({
  folders,
  activeFolderIds,
  folderCounts,
  onFolderToggle,
  onCreateFolder,
  onDeleteFolder,
}: FolderDockProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<FolderColor>('indigo')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isCreating) {
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isCreating])

  const openCreate = (parentId: string | null) => {
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

  const cancelCreate = () => {
    setIsCreating(false)
    setCreatingParentId(null)
    setNewName('')
    setNewColor('indigo')
  }

  const rootFolders = folders.filter((f) => !f.parentId)
  // All selected root folders
  const selectedRootIds = activeFolderIds.filter((id) => rootFolders.some((f) => f.id === id))
  // Sub-folders of ALL selected roots combined
  const subFolders = folders.filter((f) => f.parentId != null && selectedRootIds.includes(f.parentId))
  const showSubRow = selectedRootIds.length > 0
  // Allow creating sub-folder only when exactly 1 root is selected
  const singleSelectedRoot = selectedRootIds.length === 1 ? selectedRootIds[0] : null
  const singleSelectedRootName = singleSelectedRoot
    ? folders.find((f) => f.id === singleSelectedRoot)?.name ?? ''
    : ''
  const multiRootLabel = selectedRootIds
    .map((id) => folders.find((f) => f.id === id)?.name)
    .filter(Boolean)
    .join(' y ')

  return (
    <div className="mx-auto w-full max-w-5xl px-1 py-6">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Mis carpetas
      </p>

      {/* ── Row 1: Root folders ── */}
      <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {rootFolders.map((folder) => {
          const isSelected = activeFolderIds.includes(folder.id)
          const isHighlighted = isSelected
          const meta = getColorMeta(folder.color)
          const count = folderCounts[folder.id] ?? 0

          return (
            <div
              key={folder.id}
              className="group relative flex-shrink-0"
              style={{
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: isSelected ? 1 : 0,
              }}
            >
              <button
                type="button"
                onClick={() => onFolderToggle(folder.id)}
                className={`relative flex w-[92px] flex-col items-center gap-1.5 rounded-2xl border px-3 pb-2.5 pt-3.5 transition-all duration-200 ${
                  isHighlighted
                    ? `${meta.active} shadow-md`
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/20 dark:hover:bg-white/5'
                }`}
              >
                {isHighlighted ? (
                  <FolderOpen size={40} strokeWidth={1.5} className={meta.icon} />
                ) : (
                  <Folder size={40} strokeWidth={1.5} className={meta.icon} />
                )}
                <span className={`w-full truncate text-center text-[11px] font-semibold leading-tight ${
                  isHighlighted ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
                }`}>
                  {folder.name}
                </span>
                {count > 0 && (
                  <span className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    isHighlighted
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}>
                    {count}
                  </span>
                )}
              </button>

              {folder.id !== 'general' && (
                <button
                  type="button"
                  onClick={() => onDeleteFolder(folder.id)}
                  aria-label={`Eliminar carpeta ${folder.name}`}
                  className="absolute -left-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 group-hover:flex dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )
        })}

        {/* New root folder button / form */}
        {!isCreating ? (
          <button
            type="button"
            onClick={() => openCreate(null)}
            className="flex w-[92px] flex-shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 px-3 pb-2.5 pt-3.5 text-zinc-400 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-500 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/5 dark:hover:text-zinc-300"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-zinc-300 dark:border-white/15">
              <Plus size={20} />
            </div>
            <span className="text-[11px] font-semibold">Nueva</span>
          </button>
        ) : creatingParentId === null ? (
          <CreateForm
            inputRef={inputRef}
            newName={newName}
            newColor={newColor}
            onNameChange={setNewName}
            onColorChange={setNewColor}
            onCreate={handleCreate}
            onCancel={cancelCreate}
          />
        ) : null}
      </div>

      {/* ── Row 2: Sub-folders (animated slide-in) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: showSubRow ? '1fr' : '0fr',
          opacity: showSubRow ? 1 : 0,
          transition: 'grid-template-rows 0.35s ease, opacity 0.3s ease',
          marginTop: showSubRow ? '10px' : '0',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="pt-1 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {singleSelectedRoot ? `Dentro de ${singleSelectedRootName}` : `Subcarpetas · ${multiRootLabel}`}
              </p>
              <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
            </div>

            <div className="flex items-end gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {subFolders.map((folder) => {
                const isSelected = activeFolderIds.includes(folder.id)
                const meta = getColorMeta(folder.color)
                const count = folderCounts[folder.id] ?? 0

                return (
                  <div
                    key={folder.id}
                    className="group relative flex-shrink-0"
                    style={{
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      zIndex: isSelected ? 1 : 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onFolderToggle(folder.id)}
                      className={`relative flex w-[80px] flex-col items-center gap-1 rounded-xl border px-2 pb-2 pt-3 transition-all duration-200 ${
                        isSelected
                          ? `${meta.active} shadow-sm`
                          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/20 dark:hover:bg-white/5'
                      }`}
                    >
                      {isSelected ? (
                        <FolderOpen size={30} strokeWidth={1.5} className={meta.icon} />
                      ) : (
                        <Folder size={30} strokeWidth={1.5} className={meta.icon} />
                      )}
                      <span className={`w-full truncate text-center text-[10px] font-semibold leading-tight ${
                        isSelected ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {folder.name}
                      </span>
                      {count > 0 && (
                        <span className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteFolder(folder.id)}
                      aria-label={`Eliminar subcarpeta ${folder.name}`}
                      className="absolute -left-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 group-hover:flex dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:border-rose-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )
              })}

              {/* New sub-folder button only when 1 root is selected */}
              {singleSelectedRoot && (
                !isCreating ? (
                  <button
                    type="button"
                    onClick={() => openCreate(singleSelectedRoot)}
                    className="flex w-[80px] flex-shrink-0 flex-col items-center gap-1 rounded-xl border border-dashed border-zinc-300 px-2 pb-2 pt-3 text-zinc-400 transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-500 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/5 dark:hover:text-zinc-300"
                  >
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-dashed border-zinc-300 dark:border-white/15">
                      <Plus size={14} />
                    </div>
                    <span className="text-[10px] font-semibold">Nueva</span>
                  </button>
                ) : creatingParentId === singleSelectedRoot ? (
                  <CreateForm
                    inputRef={inputRef}
                    newName={newName}
                    newColor={newColor}
                    onNameChange={setNewName}
                    onColorChange={setNewColor}
                    onCreate={handleCreate}
                    onCancel={cancelCreate}
                    placeholder="Nombre de la subcarpeta"
                  />
                ) : null
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
