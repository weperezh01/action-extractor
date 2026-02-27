import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionFolderByIdForUser,
  findUserByEmail,
  listExtractionFolderMembersForOwner,
  upsertExtractionFolderMemberForOwner,
} from '@/lib/db'
import { isProtectedExtractionFolderIdForUser } from '@/lib/extraction-folders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseFolderId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function toClientMember(
  member: Awaited<ReturnType<typeof listExtractionFolderMembersForOwner>>[number]
) {
  return {
    folderId: member.folder_id,
    ownerUserId: member.owner_user_id,
    memberUserId: member.member_user_id,
    role: member.role,
    createdAt: member.created_at,
    userName: member.member_name,
    userEmail: member.member_email,
  }
}

export async function GET(
  req: NextRequest,
  context: { params: { folderId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const folderId = parseFolderId(context.params?.folderId)
    if (!folderId) {
      return NextResponse.json({ error: 'folderId inválido.' }, { status: 400 })
    }

    const folder = await findExtractionFolderByIdForUser({ id: folderId, userId: user.id })
    if (!folder) {
      return NextResponse.json({ error: 'No se encontró la carpeta.' }, { status: 404 })
    }

    const members = await listExtractionFolderMembersForOwner({
      folderId,
      ownerUserId: user.id,
    })

    return NextResponse.json({
      folderId,
      members: members.map(toClientMember),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los miembros de la carpeta.'
    console.error('[ActionExtractor] folder members GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar los miembros de la carpeta.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { folderId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const folderId = parseFolderId(context.params?.folderId)
    if (!folderId) {
      return NextResponse.json({ error: 'folderId inválido.' }, { status: 400 })
    }
    if (isProtectedExtractionFolderIdForUser({ userId: user.id, id: folderId })) {
      return NextResponse.json({ error: 'No se puede compartir una carpeta del sistema.' }, { status: 400 })
    }

    const folder = await findExtractionFolderByIdForUser({ id: folderId, userId: user.id })
    if (!folder) {
      return NextResponse.json({ error: 'No se encontró la carpeta.' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const email =
      typeof (body as { email?: unknown })?.email === 'string'
        ? (body as { email: string }).email.trim().toLowerCase()
        : ''
    if (!email) {
      return NextResponse.json({ error: 'email es requerido.' }, { status: 400 })
    }

    const targetUser = await findUserByEmail(email)
    if (!targetUser) {
      return NextResponse.json({ error: 'No existe una cuenta con ese correo.' }, { status: 404 })
    }
    if (targetUser.id === user.id) {
      return NextResponse.json({ error: 'No puedes compartirte la carpeta a ti mismo.' }, { status: 400 })
    }

    const member = await upsertExtractionFolderMemberForOwner({
      folderId,
      ownerUserId: user.id,
      memberUserId: targetUser.id,
      role: 'viewer',
    })
    if (!member) {
      return NextResponse.json({ error: 'No se pudo compartir la carpeta.' }, { status: 404 })
    }

    return NextResponse.json({
      folderId,
      member: toClientMember(member),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo compartir la carpeta.'
    console.error('[ActionExtractor] folder members POST error:', message)
    return NextResponse.json({ error: 'No se pudo compartir la carpeta.' }, { status: 500 })
  }
}
