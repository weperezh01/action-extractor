import { NextRequest, NextResponse } from 'next/server'
import {
  clearSessionCookie,
  deleteSessionForRequest,
  getUserFromRequest,
  normalizeEmail,
  verifyPassword,
} from '@/lib/auth'
import { deleteUserById, findUserById, mapUserForClient, updateUserName } from '@/lib/db'
import { getUserExtractionRateLimitSnapshot } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DELETE_CONFIRMATION_TEXT = 'ELIMINAR'

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const user = await findUserById(sessionUser.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const rateLimit = await getUserExtractionRateLimitSnapshot(user.id)

    return NextResponse.json({
      user: mapUserForClient(user),
      rateLimit,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar la cuenta.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as { name?: unknown } | null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''

    if (name.length < 2) {
      return NextResponse.json({ error: 'Nombre inválido (mínimo 2 caracteres).' }, { status: 400 })
    }

    if (name.length > 80) {
      return NextResponse.json({ error: 'Nombre demasiado largo (máximo 80 caracteres).' }, { status: 400 })
    }

    const updated = await updateUserName(sessionUser.id, name)
    if (!updated) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      user: mapUserForClient(updated),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el perfil.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const user = await findUserById(sessionUser.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const body = (await req.json().catch(() => null)) as
      | {
          confirmationText?: unknown
          email?: unknown
          password?: unknown
        }
      | null

    const confirmationText =
      typeof body?.confirmationText === 'string' ? body.confirmationText.trim() : ''
    const confirmationEmail =
      typeof body?.email === 'string' ? normalizeEmail(body.email) : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (confirmationText !== DELETE_CONFIRMATION_TEXT) {
      return NextResponse.json(
        { error: `Escribe "${DELETE_CONFIRMATION_TEXT}" para confirmar la eliminación.` },
        { status: 400 }
      )
    }

    if (!confirmationEmail || confirmationEmail !== normalizeEmail(user.email)) {
      return NextResponse.json(
        { error: 'Debes confirmar con el correo exacto de la cuenta.' },
        { status: 400 }
      )
    }

    if (password.trim()) {
      const validPassword = await verifyPassword(password, user.password_hash)
      if (!validPassword) {
        return NextResponse.json({ error: 'La contraseña actual no es válida.' }, { status: 401 })
      }
    }

    await deleteSessionForRequest(req)
    const deleted = await deleteUserById(user.id)
    if (deleted === 0) {
      return NextResponse.json({ error: 'No se pudo eliminar la cuenta.' }, { status: 404 })
    }

    const response = NextResponse.json({ ok: true })
    clearSessionCookie(response)
    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar la cuenta.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
