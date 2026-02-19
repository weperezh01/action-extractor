import { NextResponse } from 'next/server'
import {
  createSessionExpirationDate,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  setSessionCookie,
} from '@/lib/auth'
import { createSession, createUser, findUserByEmail, mapUserForClient } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const emailInput = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const email = normalizeEmail(emailInput)

    if (name.length < 2) {
      return NextResponse.json({ error: 'Nombre inválido (mínimo 2 caracteres).' }, { status: 400 })
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Correo electrónico inválido.' }, { status: 400 })
    }

    if (!isValidPassword(password)) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: 'Este correo ya está registrado.' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const user = await createUser({ name, email, passwordHash })

    const sessionToken = createSessionToken()
    const sessionTokenHash = hashSessionToken(sessionToken)
    const expiresAt = createSessionExpirationDate()
    await createSession({ userId: user.id, tokenHash: sessionTokenHash, expiresAt })

    const response = NextResponse.json({ user: mapUserForClient(user) }, { status: 201 })
    setSessionCookie(response, sessionToken, expiresAt)
    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar el usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
