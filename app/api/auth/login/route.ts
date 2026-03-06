import { NextRequest, NextResponse } from 'next/server'
import {
  createSessionExpirationDate,
  createSessionToken,
  hashSessionToken,
  normalizeEmail,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth'
import { createSession, findUserByEmail, mapUserForClient, consumeLoginRateLimit } from '@/lib/db'

const LOGIN_RATE_LIMIT = 10
const LOGIN_RATE_WINDOW_MINUTES = 15

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const emailInput = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const email = normalizeEmail(emailInput)

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos.' }, { status: 400 })
    }

    // Brute-force protection: 10 attempts per 15 min per email+IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rlKey = `login:${email}:${ip}`
    const rl = await consumeLoginRateLimit(rlKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MINUTES)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.' },
        { status: 429, headers: { 'Retry-After': String(LOGIN_RATE_WINDOW_MINUTES * 60) } }
      )
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 })
    }

    if (user.blocked_at) {
      return NextResponse.json(
        { error: 'Tu cuenta está bloqueada temporalmente. Contacta al administrador.' },
        { status: 403 }
      )
    }

    if (!user.email_verified_at) {
      return NextResponse.json(
        {
          error:
            'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada y confirma el enlace.',
        },
        { status: 403 }
      )
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
