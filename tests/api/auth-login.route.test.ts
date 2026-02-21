import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  createSessionExpirationDate: vi.fn(() => new Date('2030-01-01T00:00:00.000Z')),
  createSessionToken: vi.fn(() => 'plain-session-token'),
  hashSessionToken: vi.fn(() => 'hashed-session-token'),
  normalizeEmail: vi.fn((email: string) => email.trim().toLowerCase()),
  setSessionCookie: vi.fn(),
  verifyPassword: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  findUserByEmail: vi.fn(),
  mapUserForClient: vi.fn((user: { id: string; name: string; email: string }) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  })),
}))

vi.mock('@/lib/auth', () => ({
  createSessionExpirationDate: authMocks.createSessionExpirationDate,
  createSessionToken: authMocks.createSessionToken,
  hashSessionToken: authMocks.hashSessionToken,
  normalizeEmail: authMocks.normalizeEmail,
  setSessionCookie: authMocks.setSessionCookie,
  verifyPassword: authMocks.verifyPassword,
}))

vi.mock('@/lib/db', () => ({
  createSession: dbMocks.createSession,
  findUserByEmail: dbMocks.findUserByEmail,
  mapUserForClient: dbMocks.mapUserForClient,
}))

import { POST } from '@/app/api/auth/login/route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 400 si faltan credenciales', async () => {
    const response = await POST(makeRequest({ email: '', password: '' }))
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(payload.error).toContain('Correo y contraseña son requeridos')
    expect(dbMocks.findUserByEmail).not.toHaveBeenCalled()
  })

  it('retorna 401 cuando usuario no existe', async () => {
    dbMocks.findUserByEmail.mockResolvedValue(null)

    const response = await POST(makeRequest({ email: 'user@example.com', password: 'secret123' }))
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(401)
    expect(payload.error).toContain('Credenciales inválidas')
    expect(dbMocks.findUserByEmail).toHaveBeenCalledWith('user@example.com')
  })

  it('retorna 403 cuando el email no está verificado', async () => {
    dbMocks.findUserByEmail.mockResolvedValue({
      id: 'u1',
      name: 'Usuario',
      email: 'user@example.com',
      password_hash: 'hash',
      email_verified_at: null,
      blocked_at: null,
    })

    const response = await POST(makeRequest({ email: 'user@example.com', password: 'secret123' }))

    expect(response.status).toBe(403)
    expect(authMocks.verifyPassword).not.toHaveBeenCalled()
  })

  it('retorna 403 cuando el usuario está bloqueado', async () => {
    dbMocks.findUserByEmail.mockResolvedValue({
      id: 'u1',
      name: 'Usuario',
      email: 'user@example.com',
      password_hash: 'hash',
      email_verified_at: '2026-02-20T00:00:00.000Z',
      blocked_at: '2026-02-21T02:00:00.000Z',
    })

    const response = await POST(makeRequest({ email: 'user@example.com', password: 'secret123' }))
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(403)
    expect(payload.error).toContain('bloqueada')
    expect(authMocks.verifyPassword).not.toHaveBeenCalled()
  })

  it('retorna 401 cuando la contraseña es incorrecta', async () => {
    dbMocks.findUserByEmail.mockResolvedValue({
      id: 'u1',
      name: 'Usuario',
      email: 'user@example.com',
      password_hash: 'stored-hash',
      email_verified_at: '2026-02-20T00:00:00.000Z',
      blocked_at: null,
    })
    authMocks.verifyPassword.mockResolvedValue(false)

    const response = await POST(makeRequest({ email: 'user@example.com', password: 'bad-pass' }))

    expect(response.status).toBe(401)
    expect(authMocks.verifyPassword).toHaveBeenCalledWith('bad-pass', 'stored-hash')
    expect(dbMocks.createSession).not.toHaveBeenCalled()
  })

  it('retorna 200 y crea sesión cuando las credenciales son válidas', async () => {
    dbMocks.findUserByEmail.mockResolvedValue({
      id: 'u1',
      name: 'Usuario',
      email: 'user@example.com',
      password_hash: 'stored-hash',
      email_verified_at: '2026-02-20T00:00:00.000Z',
      blocked_at: null,
    })
    authMocks.verifyPassword.mockResolvedValue(true)
    dbMocks.createSession.mockResolvedValue(undefined)

    const response = await POST(makeRequest({ email: 'user@example.com', password: 'secret123' }))
    const payload = (await response.json()) as { user: { id: string; email: string } }

    expect(response.status).toBe(200)
    expect(dbMocks.createSession).toHaveBeenCalledWith({
      userId: 'u1',
      tokenHash: 'hashed-session-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    })
    expect(authMocks.setSessionCookie).toHaveBeenCalledTimes(1)
    expect(payload.user).toEqual({
      id: 'u1',
      name: 'Usuario',
      email: 'user@example.com',
    })
  })
})
