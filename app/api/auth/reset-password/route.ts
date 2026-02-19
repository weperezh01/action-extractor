import { NextResponse } from 'next/server'
import { hashPassword, hashResetToken, isValidPassword } from '@/lib/auth'
import {
  deletePasswordResetTokenByHash,
  findPasswordResetTokenByHash,
  updateUserPassword,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!token) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres.' },
        { status: 400 }
      )
    }

    const tokenHash = hashResetToken(token)
    const resetToken = await findPasswordResetTokenByHash(tokenHash)

    if (!resetToken) {
      return NextResponse.json({ error: 'El enlace es inválido o ya fue utilizado.' }, { status: 400 })
    }

    if (new Date(resetToken.expires_at).getTime() <= Date.now()) {
      await deletePasswordResetTokenByHash(tokenHash)
      return NextResponse.json(
        { error: 'El enlace expiró. Solicita uno nuevo desde el formulario de login.' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)
    await updateUserPassword(resetToken.user_id, passwordHash)
    await deletePasswordResetTokenByHash(tokenHash)

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo restablecer la contraseña.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
