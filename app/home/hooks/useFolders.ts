'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FolderColor, FolderItem } from '@/app/home/components/FolderDock'

const STORAGE_KEY = 'ae_folders'

const DEFAULT_FOLDERS: FolderItem[] = [
  { id: 'general', name: 'General', color: 'amber', parentId: null },
]

export function useFolders() {
  const [folders, setFolders] = useState<FolderItem[]>(DEFAULT_FOLDERS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as FolderItem[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFolders(parsed)
        }
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
    } catch {}
  }, [folders, hydrated])

  const createFolder = useCallback(
    (name: string, color: FolderColor, parentId?: string | null): FolderItem => {
      const folder: FolderItem = {
        id: crypto.randomUUID(),
        name,
        color,
        parentId: parentId ?? null,
      }
      setFolders((prev) => [...prev, folder])
      return folder
    },
    []
  )

  const deleteFolder = useCallback((id: string) => {
    if (id === 'general') return
    setFolders((prev) => {
      // Collect IDs to delete: the folder itself + all its children (1 level deep)
      const toDelete = new Set<string>()
      const addWithChildren = (folderId: string) => {
        toDelete.add(folderId)
        prev.filter((f) => f.parentId === folderId).forEach((child) => addWithChildren(child.id))
      }
      addWithChildren(id)
      return prev.filter((f) => !toDelete.has(f.id))
    })
  }, [])

  return { folders, createFolder, deleteFolder }
}
