import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  createExtractionFolderForUser,
  ensureDefaultExtractionFoldersForUser,
  findExtractionFolderByIdForUser,
  listExtractionFoldersByUser,
  type DbExtractionFolder,
} from '@/lib/db'
import {
  isProtectedExtractionFolderIdForUser,
  resolveSystemExtractionFolderKey,
  isSystemExtractionFolderId,
} from '@/lib/extraction-folders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_FOLDER_COLORS = new Set([
  'amber',
  'indigo',
  'emerald',
  'rose',
  'sky',
  'violet',
  'orange',
])

function mapFolder(folder: DbExtractionFolder) {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    parentId: folder.parent_id,
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    await ensureDefaultExtractionFoldersForUser(user.id)
    const folders = await listExtractionFoldersByUser(user.id)
    return NextResponse.json({ folders: folders.map(mapFolder) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las carpetas.'
    console.error('[ActionExtractor] folders GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar las carpetas.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }
    await ensureDefaultExtractionFoldersForUser(user.id)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const rawId = typeof (body as { id?: unknown }).id === 'string'
      ? (body as { id: string }).id.trim()
      : ''
    const id = rawId || undefined

    if (id && isSystemExtractionFolderId(id)) {
      return NextResponse.json({ error: 'Ese id está reservado por el sistema.' }, { status: 400 })
    }
    if (id && isProtectedExtractionFolderIdForUser({ userId: user.id, id })) {
      return NextResponse.json({ error: 'No se puede crear ni reemplazar una carpeta del sistema.' }, { status: 400 })
    }

    const name = typeof (body as { name?: unknown }).name === 'string'
      ? (body as { name: string }).name.trim()
      : ''
    if (!name) {
      return NextResponse.json({ error: 'Nombre de carpeta inválido.' }, { status: 400 })
    }
    if (name.length > 80) {
      return NextResponse.json({ error: 'Nombre demasiado largo (máximo 80).' }, { status: 400 })
    }

    const color = typeof (body as { color?: unknown }).color === 'string'
      ? (body as { color: string }).color.trim()
      : ''
    if (!ALLOWED_FOLDER_COLORS.has(color)) {
      return NextResponse.json({ error: 'Color de carpeta inválido.' }, { status: 400 })
    }

    const rawParentId = (body as { parentId?: unknown }).parentId
    const parentId =
      rawParentId === null
        ? null
        : typeof rawParentId === 'string' && rawParentId.trim()
          ? rawParentId.trim()
          : null

    if (id && parentId && id === parentId) {
      return NextResponse.json({ error: 'Una carpeta no puede ser su propia carpeta padre.' }, { status: 400 })
    }

    if (parentId) {
      const parentSystemKey = resolveSystemExtractionFolderKey(parentId)
      if (parentSystemKey === 'shared-with-me') {
        return NextResponse.json({ error: 'No se puede crear dentro de "Compartidos conmigo".' }, { status: 400 })
      }
      const parent = await findExtractionFolderByIdForUser({ id: parentId, userId: user.id })
      if (!parent) {
        return NextResponse.json({ error: 'La carpeta padre no existe.' }, { status: 400 })
      }
    }

    const created = await createExtractionFolderForUser({
      userId: user.id,
      id,
      name,
      color,
      parentId,
    })

    if (!created && id) {
      const existing = await findExtractionFolderByIdForUser({ id, userId: user.id })
      if (existing) {
        return NextResponse.json({ folder: mapFolder(existing) })
      }
    }

    if (!created) {
      return NextResponse.json({ error: 'No se pudo crear la carpeta.' }, { status: 400 })
    }

    return NextResponse.json({ folder: mapFolder(created) }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la carpeta.'
    console.error('[ActionExtractor] folders POST error:', message)
    return NextResponse.json({ error: 'No se pudo crear la carpeta.' }, { status: 500 })
  }
}
