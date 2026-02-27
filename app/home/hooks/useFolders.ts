'use client'

import { useCallback, useState } from 'react'
import type { FolderColor, FolderItem } from '@/app/home/components/FolderDock'
import { isSystemExtractionFolderId } from '@/lib/extraction-folders'

const STORAGE_KEY = 'ae_folders'
const FOLDER_REQUEST_TIMEOUT_MS = 10000
const FOLDER_COLORS = new Set<FolderColor>([
  'amber',
  'indigo',
  'emerald',
  'rose',
  'sky',
  'violet',
  'orange',
])

function normalizeFolder(raw: unknown): FolderItem | null {
  if (!raw || typeof raw !== 'object') return null

  const id = typeof (raw as { id?: unknown }).id === 'string'
    ? (raw as { id: string }).id.trim()
    : ''
  const name = typeof (raw as { name?: unknown }).name === 'string'
    ? (raw as { name: string }).name.trim()
    : ''
  const colorRaw = typeof (raw as { color?: unknown }).color === 'string'
    ? (raw as { color: string }).color
    : ''
  const color = FOLDER_COLORS.has(colorRaw as FolderColor) ? (colorRaw as FolderColor) : null
  const parentIdRaw = (raw as { parentId?: unknown }).parentId
  const parentId =
    parentIdRaw === null
      ? null
      : typeof parentIdRaw === 'string' && parentIdRaw.trim()
        ? parentIdRaw.trim()
        : null

  if (!id || !name || !color) return null
  return { id, name, color, parentId }
}

export function useFolders() {
  const [folders, setFolders] = useState<FolderItem[]>([])

  const migrateLocalFoldersToDb = useCallback(async (): Promise<FolderItem[]> => {
    if (typeof window === 'undefined') return []

    let rawLocal: string | null = null
    try {
      rawLocal = localStorage.getItem(STORAGE_KEY)
    } catch {
      rawLocal = null
    }
    if (!rawLocal) return []

    let parsed: unknown
    try {
      parsed = JSON.parse(rawLocal)
    } catch {
      return []
    }

    const localFolders = Array.isArray(parsed)
      ? parsed.map(normalizeFolder).filter((item): item is FolderItem => Boolean(item))
      : []
    if (localFolders.length === 0) return []

    const rootFolders = localFolders.filter((folder) => !folder.parentId)
    const childFolders = localFolders.filter((folder) => Boolean(folder.parentId))
    const orderedFolders = [...rootFolders, ...childFolders]

    const migratedIds = new Set<string>()
    const migratedFolders: FolderItem[] = []

    for (const folder of orderedFolders) {
      const parentId = folder.parentId && migratedIds.has(folder.parentId) ? folder.parentId : null
      try {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: folder.id,
            name: folder.name,
            color: folder.color,
            parentId,
          }),
        })
        const data = (await res.json().catch(() => null)) as { folder?: unknown } | null
        if (!res.ok) continue
        const normalized = normalizeFolder(data?.folder)
        if (!normalized) continue
        migratedIds.add(normalized.id)
        migratedFolders.push(normalized)
      } catch {
        // continue best effort
      }
    }

    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // noop
    }

    return migratedFolders
  }, [])

  const loadFolders = useCallback(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FOLDER_REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch('/api/folders', {
        cache: 'no-store',
        signal: controller.signal,
      })

      if (res.status === 401) {
        setFolders([])
        return
      }

      const data = (await res.json().catch(() => null)) as { folders?: unknown[] } | null
      if (!res.ok) {
        setFolders([])
        return
      }

      const serverFolders = Array.isArray(data?.folders)
        ? data.folders.map(normalizeFolder).filter((item): item is FolderItem => Boolean(item))
        : []

      const migratedFolders = await migrateLocalFoldersToDb()
      if (migratedFolders.length === 0) {
        setFolders(serverFolders)
        return
      }

      const mergedById = new Map<string, FolderItem>()
      for (const folder of serverFolders) {
        mergedById.set(folder.id, folder)
      }
      for (const folder of migratedFolders) {
        mergedById.set(folder.id, folder)
      }
      setFolders(Array.from(mergedById.values()))
    } catch {
      setFolders([])
    } finally {
      clearTimeout(timeoutId)
    }
  }, [migrateLocalFoldersToDb])

  const createFolder = useCallback(
    (name: string, color: FolderColor, parentId?: string | null): FolderItem => {
      const folder: FolderItem = {
        id: crypto.randomUUID(),
        name: name.trim() || 'Nueva carpeta',
        color,
        parentId: parentId ?? null,
      }

      setFolders((prev) => [...prev, folder])

      void (async () => {
        try {
          const res = await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(folder),
          })
          const data = (await res.json().catch(() => null)) as { folder?: unknown } | null
          if (!res.ok) {
            setFolders((prev) => prev.filter((item) => item.id !== folder.id))
            return
          }
          const persisted = normalizeFolder(data?.folder)
          if (!persisted) {
            void loadFolders()
            return
          }
          setFolders((prev) => prev.map((item) => (item.id === folder.id ? persisted : item)))
        } catch {
          setFolders((prev) => prev.filter((item) => item.id !== folder.id))
        }
      })()

      return folder
    },
    [loadFolders]
  )

  const deleteFolder = useCallback(
    (id: string) => {
      if (!id || isSystemExtractionFolderId(id)) return

      setFolders((prev) => {
        const toDelete = new Set<string>()
        const addWithChildren = (folderId: string) => {
          toDelete.add(folderId)
          prev.filter((folder) => folder.parentId === folderId).forEach((child) => addWithChildren(child.id))
        }
        addWithChildren(id)
        return prev.filter((folder) => !toDelete.has(folder.id))
      })

      void (async () => {
        try {
          const res = await fetch(`/api/folders/${encodeURIComponent(id)}`, { method: 'DELETE' })
          if (!res.ok) {
            void loadFolders()
          }
        } catch {
          void loadFolders()
        }
      })()
    },
    [loadFolders]
  )

  const resetFolders = useCallback(() => {
    setFolders([])
  }, [])

  return { folders, loadFolders, resetFolders, createFolder, deleteFolder }
}
