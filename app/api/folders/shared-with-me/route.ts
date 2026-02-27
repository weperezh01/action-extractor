import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  ensureDefaultExtractionFoldersForUser,
  listSharedExtractionFoldersForMember,
} from '@/lib/db'
import { buildSystemExtractionFolderIdForUser } from '@/lib/extraction-folders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    await ensureDefaultExtractionFoldersForUser(user.id)
    const sharedWithMeRootId = buildSystemExtractionFolderIdForUser({
      userId: user.id,
      key: 'shared-with-me',
    })

    const sharedFolders = await listSharedExtractionFoldersForMember(user.id)
    const knownIds = new Set(sharedFolders.map((folder) => folder.id))

    return NextResponse.json({
      folders: sharedFolders.map((folder) => {
        const hasKnownParent =
          typeof folder.parent_id === 'string' &&
          folder.parent_id.trim().length > 0 &&
          knownIds.has(folder.parent_id)
        const isRootSharedFolder = folder.id === folder.root_folder_id

        return {
          id: folder.id,
          name: folder.name,
          color: folder.color,
          parentId: isRootSharedFolder || !hasKnownParent ? sharedWithMeRootId : folder.parent_id,
          ownerUserId: folder.owner_user_id,
          ownerName: folder.owner_name,
          ownerEmail: folder.owner_email,
          rootSharedFolderId: folder.root_folder_id,
        }
      }),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las carpetas compartidas.'
    console.error('[ActionExtractor] shared folders GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar las carpetas compartidas.' }, { status: 500 })
  }
}
