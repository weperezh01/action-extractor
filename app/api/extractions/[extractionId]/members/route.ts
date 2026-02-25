import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionByIdForUser,
  findUserByEmail,
  listExtractionMembersForOwner,
  upsertExtractionMemberForOwner,
  type ExtractionMemberRole,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseRole(raw: unknown): ExtractionMemberRole | null {
  if (raw === 'editor' || raw === 'viewer') return raw
  return null
}

function toClientMember(member: Awaited<ReturnType<typeof listExtractionMembersForOwner>>[number]) {
  return {
    extractionId: member.extraction_id,
    userId: member.user_id,
    role: member.role,
    createdAt: member.created_at,
    userName: member.user_name,
    userEmail: member.user_email,
  }
}

export async function GET(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseExtractionId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    const extraction = await findExtractionByIdForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    const members = await listExtractionMembersForOwner({
      extractionId,
      ownerUserId: user.id,
    })

    return NextResponse.json({
      extractionId,
      members: members.map(toClientMember),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los miembros.'
    console.error('[ActionExtractor] extraction members GET error:', message)
    return NextResponse.json({ error: 'No se pudieron cargar los miembros.' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseExtractionId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    const extraction = await findExtractionByIdForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
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

    const role = parseRole((body as { role?: unknown })?.role)
    if (!role) {
      return NextResponse.json({ error: 'role inválido. Usa editor o viewer.' }, { status: 400 })
    }

    const targetUser = await findUserByEmail(email)
    if (!targetUser) {
      return NextResponse.json({ error: 'No existe una cuenta con ese correo.' }, { status: 404 })
    }

    if (targetUser.id === user.id) {
      return NextResponse.json({ error: 'No puedes agregarte como miembro de tu propio playbook.' }, { status: 400 })
    }

    const member = await upsertExtractionMemberForOwner({
      extractionId,
      ownerUserId: user.id,
      memberUserId: targetUser.id,
      role,
    })
    if (!member) {
      return NextResponse.json({ error: 'No se pudo agregar el miembro.' }, { status: 404 })
    }

    return NextResponse.json({
      extractionId,
      member: toClientMember(member),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo agregar el miembro.'
    console.error('[ActionExtractor] extraction members POST error:', message)
    return NextResponse.json({ error: 'No se pudo agregar el miembro.' }, { status: 500 })
  }
}
