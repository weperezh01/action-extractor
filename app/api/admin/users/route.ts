import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { listAdminUsers, updateUserBlockedState } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function parseLimit(raw: string | null) {
  if (!raw) return DEFAULT_LIMIT
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, parsed))
}

function parseOffset(raw: string | null) {
  if (!raw) return 0
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, parsed)
}

function parseVerification(raw: string | null) {
  if (raw === 'verified' || raw === 'unverified') return raw
  return 'all'
}

function parseBlocked(raw: string | null) {
  if (raw === 'blocked' || raw === 'active') return raw
  return 'all'
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Acceso restringido a administradores.' }, { status: 403 })
    }

    const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    const verification = parseVerification(req.nextUrl.searchParams.get('verification'))
    const blocked = parseBlocked(req.nextUrl.searchParams.get('blocked'))
    const limit = parseLimit(req.nextUrl.searchParams.get('limit'))
    const offset = parseOffset(req.nextUrl.searchParams.get('offset'))

    const result = await listAdminUsers({
      query,
      verification,
      blocked,
      limit,
      offset,
    })

    return NextResponse.json({
      users: result.users,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
      filters: {
        query,
        verification,
        blocked,
      },
      generated_at: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar la lista de usuarios.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Acceso restringido a administradores.' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as
      | {
          userId?: unknown
          blocked?: unknown
        }
      | null

    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
    const blocked = body?.blocked === true

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 })
    }

    if (typeof body?.blocked !== 'boolean') {
      return NextResponse.json({ error: 'blocked debe ser boolean.' }, { status: 400 })
    }

    if (userId === user.id && blocked) {
      return NextResponse.json(
        { error: 'No puedes bloquear tu propia cuenta de administrador.' },
        { status: 400 }
      )
    }

    const updated = await updateUserBlockedState({ userId, blocked })
    if (!updated) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        created_at: updated.created_at,
        email_verified_at: updated.email_verified_at,
        blocked_at: updated.blocked_at,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el estado del usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
