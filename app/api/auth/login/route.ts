import { NextResponse } from 'next/server'
import {
  createSessionExpirationDate,
  createSessionToken,
  hashSessionToken,
  normalizeEmail,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth'
import { createSession, findUserByEmail, mapUserForClient } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const emailInput = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const email = normalizeEmail(emailInput)

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos.' }, { status: 400 })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 })
    }

    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 })
    }

    const sessionToken = createSessionToken()
    const sessionTokenHash = hashSessionToken(sessionToken)
    const expiresAt = createSessionExpirationDate()
    await createSession({ userId: user.id, tokenHash: sessionTokenHash, expiresAt })

    const response = NextResponse.json({ user: mapUserForClient(user) })
    setSessionCookie(response, sessionToken, expiresAt)
    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
