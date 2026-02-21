import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const authMocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  isAdminEmail: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
  listAdminUsers: vi.fn(),
  updateUserBlockedState: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
  isAdminEmail: authMocks.isAdminEmail,
}))

vi.mock('@/lib/db', () => ({
  listAdminUsers: dbMocks.listAdminUsers,
  updateUserBlockedState: dbMocks.updateUserBlockedState,
}))

import { GET, PATCH } from '@/app/api/admin/users/route'

function makeGetRequest(url = 'http://localhost/api/admin/users') {
  return new NextRequest(url, { method: 'GET' })
}

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/users', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('admin users route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 cuando no hay sesión', async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null)

    const response = await GET(makeGetRequest())
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(401)
    expect(payload.error).toContain('Debes iniciar sesión')
  })

  it('retorna 403 cuando el usuario no es admin', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1', email: 'user@example.com' })
    authMocks.isAdminEmail.mockReturnValue(false)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(403)
    expect(dbMocks.listAdminUsers).not.toHaveBeenCalled()
  })

  it('lista usuarios y aplica filtros/sanitización', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'a1', email: 'admin@example.com' })
    authMocks.isAdminEmail.mockReturnValue(true)
    dbMocks.listAdminUsers.mockResolvedValue({
      total: 1,
      users: [
        {
          id: 'u1',
          name: 'Usuario 1',
          email: 'u1@example.com',
          created_at: '2026-02-21T00:00:00.000Z',
          email_verified_at: null,
          blocked_at: null,
          total_extractions: 0,
          last_extraction_at: null,
        },
      ],
    })

    const response = await GET(
      makeGetRequest(
        'http://localhost/api/admin/users?q=ana&verification=unverified&blocked=active&limit=999&offset=10'
      )
    )
    const payload = (await response.json()) as {
      users: Array<{ id: string }>
      pagination: { total: number; limit: number; offset: number }
    }

    expect(response.status).toBe(200)
    expect(dbMocks.listAdminUsers).toHaveBeenCalledWith({
      query: 'ana',
      verification: 'unverified',
      blocked: 'active',
      limit: 200,
      offset: 10,
    })
    expect(payload.users).toHaveLength(1)
    expect(payload.pagination.total).toBe(1)
  })

  it('evita que un admin se bloquee a sí mismo', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'a1', email: 'admin@example.com' })
    authMocks.isAdminEmail.mockReturnValue(true)

    const response = await PATCH(makePatchRequest({ userId: 'a1', blocked: true }))

    expect(response.status).toBe(400)
    expect(dbMocks.updateUserBlockedState).not.toHaveBeenCalled()
  })

  it('actualiza estado de bloqueo de usuario', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'a1', email: 'admin@example.com' })
    authMocks.isAdminEmail.mockReturnValue(true)
    dbMocks.updateUserBlockedState.mockResolvedValue({
      id: 'u1',
      name: 'Usuario 1',
      email: 'u1@example.com',
      created_at: '2026-02-21T00:00:00.000Z',
      email_verified_at: '2026-02-21T00:00:00.000Z',
      blocked_at: '2026-02-21T02:00:00.000Z',
    })

    const response = await PATCH(makePatchRequest({ userId: 'u1', blocked: true }))
    const payload = (await response.json()) as { ok: boolean; user: { id: string } }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.user.id).toBe('u1')
    expect(dbMocks.updateUserBlockedState).toHaveBeenCalledWith({ userId: 'u1', blocked: true })
  })
})
