export type SystemExtractionFolderKey = 'general' | 'shared-with-me'

export const SYSTEM_EXTRACTION_FOLDER_ID_PREFIX = 'ae-system-folder'

export const DEFAULT_SYSTEM_EXTRACTION_FOLDERS: ReadonlyArray<{
  key: SystemExtractionFolderKey
  name: string
  color: 'amber' | 'indigo' | 'emerald' | 'rose' | 'sky' | 'violet' | 'orange'
}> = [
  {
    key: 'general',
    name: 'General',
    color: 'indigo',
  },
  {
    key: 'shared-with-me',
    name: 'Playbooks compartidos conmigo',
    color: 'sky',
  },
]

export function buildSystemExtractionFolderIdForUser(input: {
  userId: string
  key: SystemExtractionFolderKey
}) {
  return `${SYSTEM_EXTRACTION_FOLDER_ID_PREFIX}:${input.key}:${input.userId}`
}

export function listSystemExtractionFoldersForUser(userId: string) {
  return DEFAULT_SYSTEM_EXTRACTION_FOLDERS.map((folder) => ({
    ...folder,
    id: buildSystemExtractionFolderIdForUser({ userId, key: folder.key }),
    parentId: null as null,
  }))
}

export function isSystemExtractionFolderId(id: string | null | undefined) {
  const normalizedId = typeof id === 'string' ? id.trim() : ''
  return normalizedId.startsWith(`${SYSTEM_EXTRACTION_FOLDER_ID_PREFIX}:`)
}

export function resolveSystemExtractionFolderKey(
  id: string | null | undefined
): SystemExtractionFolderKey | null {
  const normalizedId = typeof id === 'string' ? id.trim() : ''
  if (!normalizedId.startsWith(`${SYSTEM_EXTRACTION_FOLDER_ID_PREFIX}:`)) return null

  const [, key] = normalizedId.split(':')
  if (key === 'general' || key === 'shared-with-me') {
    return key
  }
  return null
}

export function isProtectedExtractionFolderIdForUser(input: {
  userId: string
  id: string | null | undefined
}) {
  const normalizedId = typeof input.id === 'string' ? input.id.trim() : ''
  if (!normalizedId) return false
  return listSystemExtractionFoldersForUser(input.userId).some((folder) => folder.id === normalizedId)
}
