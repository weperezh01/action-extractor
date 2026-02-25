import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
  createCommunityPostForUser: vi.fn(),
  findExtractionAccessForUser: vi.fn(),
  findExtractionTaskByIdForUser: vi.fn(),
}))

const rateLimitMocks = vi.hoisted(() => ({
  buildCommunityActionRateLimitMessage: vi.fn(),
  consumeUserCommunityActionRateLimit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
}))

vi.mock('@/lib/db', () => ({
  createCommunityPostForUser: dbMocks.createCommunityPostForUser,
  findExtractionAccessForUser: dbMocks.findExtractionAccessForUser,
  findExtractionTaskByIdForUser: dbMocks.findExtractionTaskByIdForUser,
}))

vi.mock('@/lib/rate-limit', () => ({
  buildCommunityActionRateLimitMessage: rateLimitMocks.buildCommunityActionRateLimitMessage,
  consumeUserCommunityActionRateLimit: rateLimitMocks.consumeUserCommunityActionRateLimit,
}))

import { POST } from '@/app/api/community/posts/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/community/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/community/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMocks.consumeUserCommunityActionRateLimit.mockResolvedValue({
      allowed: true,
      limit: 30,
      used: 1,
      remaining: 29,
      resetAt: '2026-02-24T00:00:00.000Z',
      retryAfterSeconds: 60,
    })
    rateLimitMocks.buildCommunityActionRateLimitMessage.mockImplementation(
      (_action: string, limit: number) => `Rate limit ${limit}`
    )
  })

  it('retorna 401 cuando no hay sesión', async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null)

    const response = await POST(makeRequest({ content: 'hola' }))
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(401)
    expect(payload.error).toContain('Debes iniciar sesión')
    expect(rateLimitMocks.consumeUserCommunityActionRateLimit).not.toHaveBeenCalled()
  })

  it('retorna 429 y headers cuando se supera el rate limit', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1' })
    rateLimitMocks.consumeUserCommunityActionRateLimit.mockResolvedValue({
      allowed: false,
      limit: 30,
      used: 30,
      remaining: 0,
      resetAt: '2026-02-24T12:00:00.000Z',
      retryAfterSeconds: 34,
    })
    rateLimitMocks.buildCommunityActionRateLimitMessage.mockReturnValue('Límite alcanzado')

    const response = await POST(makeRequest({ content: 'hola' }))
    const payload = (await response.json()) as { error: string; rateLimit: { remaining: number } }

    expect(response.status).toBe(429)
    expect(payload.error).toBe('Límite alcanzado')
    expect(payload.rateLimit.remaining).toBe(0)
    expect(response.headers.get('Retry-After')).toBe('34')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBe('2026-02-24T12:00:00.000Z')
    expect(dbMocks.createCommunityPostForUser).not.toHaveBeenCalled()
  })

  it('retorna 400 cuando visibility=circle no incluye extractionId', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1' })

    const response = await POST(makeRequest({ content: 'hola', visibility: 'circle' }))
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(payload.error).toContain('visibility=circle requiere extractionId')
    expect(dbMocks.findExtractionAccessForUser).not.toHaveBeenCalled()
  })

  it('retorna 403 cuando intenta enlazar una extracción sin acceso', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1' })
    dbMocks.findExtractionAccessForUser.mockResolvedValue({
      extraction: { id: 'ext-1', share_visibility: 'circle' },
      role: null,
    })

    const response = await POST(
      makeRequest({
        content: 'hola',
        extractionId: 'ext-1',
        visibility: 'followers',
      })
    )
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(403)
    expect(payload.error).toContain('No tienes acceso')
    expect(dbMocks.createCommunityPostForUser).not.toHaveBeenCalled()
  })

  it('retorna 201 y crea el post con defaults esperados', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1' })
    dbMocks.createCommunityPostForUser.mockResolvedValue({
      id: 'post-1',
      user_id: 'u1',
      user_name: 'Usuario',
      user_email: 'user@example.com',
      content: 'hola',
      visibility: 'followers',
      metadata_json: '{}',
      source_extraction_id: null,
      source_task_id: null,
      source_label: null,
      reactions_count: 0,
      comments_count: 0,
      views_count: 0,
      reacted_by_me: false,
      following_author: false,
      created_at: '2026-02-24T00:00:00.000Z',
      updated_at: '2026-02-24T00:00:00.000Z',
    })

    const response = await POST(makeRequest({ content: 'hola' }))
    const payload = (await response.json()) as {
      post: { id: string; visibility: string; metrics: { commentsCount: number } }
    }

    expect(response.status).toBe(201)
    expect(dbMocks.createCommunityPostForUser).toHaveBeenCalledWith({
      userId: 'u1',
      content: 'hola',
      visibility: 'followers',
      metadataJson: '{}',
      source: null,
      attachments: [],
    })
    expect(payload.post).toMatchObject({
      id: 'post-1',
      visibility: 'followers',
      metrics: { commentsCount: 0 },
    })
  })
})
