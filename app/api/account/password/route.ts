import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, hashPassword, isValidPassword, verifyPassword } from '@/lib/auth'
import { findUserById, updateUserPassword } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getUserFromRequest(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as
      | { currentPassword?: unknown; newPassword?: unknown }
      | null

    const currentPassword =
      typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!isValidPassword(newPassword)) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      )
    }

    const user = await findUserById(sessionUser.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    if (currentPassword.trim()) {
      const isCurrentValid = await verifyPassword(currentPassword, user.password_hash)
      if (!isCurrentValid) {
        return NextResponse.json({ error: 'La contraseña actual no es válida.' }, { status: 401 })
      }
    }

    const isSamePassword = await verifyPassword(newPassword, user.password_hash)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe ser diferente a la actual.' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(newPassword)
    await updateUserPassword(user.id, passwordHash)

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
