import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
  findExtractionAccessForUser: vi.fn(),
  listCommunityPostsByExtractionForUser: vi.fn(),
  recordCommunityPostViewsForUser: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
}))

vi.mock('@/lib/db', () => ({
  findExtractionAccessForUser: dbMocks.findExtractionAccessForUser,
  listCommunityPostsByExtractionForUser: dbMocks.listCommunityPostsByExtractionForUser,
  recordCommunityPostViewsForUser: dbMocks.recordCommunityPostViewsForUser,
}))

import { GET } from '@/app/api/community/feed/extractions/[extractionId]/route'

function makeRequest(url = 'http://localhost/api/community/feed/extractions/ext-1') {
  return new NextRequest(url, { method: 'GET' })
}

describe('GET /api/community/feed/extractions/[extractionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 cuando no hay sesión', async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null)

    const response = await GET(makeRequest(), { params: { extractionId: 'ext-1' } })
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(401)
    expect(payload.error).toContain('Debes iniciar sesión')
  })

  it('retorna 400 cuando extractionId es inválido', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1' })

    const response = await GET(makeRequest(), { params: { extractionId: '   ' } })
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(payload.error).toContain('extractionId inválido')
    expect(dbMocks.findExtractionAccessForUser).not.toHaveBeenCalled()
  })

  it('retorna 403 cuando no hay rol y la extracción no es pública', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1' })
    dbMocks.findExtractionAccessForUser.mockResolvedValue({
      extraction: { id: 'ext-1', share_visibility: 'private' },
      role: null,
    })

    const response = await GET(makeRequest(), { params: { extractionId: 'ext-1' } })
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(403)
    expect(payload.error).toContain('No tienes acceso')
    expect(dbMocks.listCommunityPostsByExtractionForUser).not.toHaveBeenCalled()
  })

  it('permite acceso sin rol cuando la extracción es public/unlisted', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1' })
    dbMocks.findExtractionAccessForUser.mockResolvedValue({
      extraction: { id: 'ext-1', share_visibility: 'public' },
      role: null,
    })
    dbMocks.listCommunityPostsByExtractionForUser.mockResolvedValue([])

    const response = await GET(
      makeRequest('http://localhost/api/community/feed/extractions/ext-1?limit=12'),
      { params: { extractionId: 'ext-1' } }
    )
    const payload = (await response.json()) as { extractionId: string; items: unknown[] }

    expect(response.status).toBe(200)
    expect(payload.extractionId).toBe('ext-1')
    expect(payload.items).toEqual([])
    expect(dbMocks.listCommunityPostsByExtractionForUser).toHaveBeenCalledWith({
      userId: 'u1',
      extractionId: 'ext-1',
      limit: 12,
    })
    expect(dbMocks.recordCommunityPostViewsForUser).not.toHaveBeenCalled()
  })

  it('retorna items, normaliza limit y registra vistas', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'u1' })
    dbMocks.findExtractionAccessForUser.mockResolvedValue({
      extraction: { id: 'ext-1', share_visibility: 'circle' },
      role: 'viewer',
    })
    dbMocks.listCommunityPostsByExtractionForUser.mockResolvedValue([
      {
        id: 'post-1',
        user_id: 'owner-1',
        user_name: 'Owner',
        user_email: 'owner@example.com',
        content: 'Primer post',
        visibility: 'circle',
        metadata_json: '{}',
        source_extraction_id: 'ext-1',
        source_task_id: null,
        source_label: 'Playbook X',
        reactions_count: 2,
        comments_count: 1,
        views_count: 5,
        reacted_by_me: true,
        following_author: false,
        created_at: '2026-02-24T00:00:00.000Z',
        updated_at: '2026-02-24T00:00:00.000Z',
      },
    ])

    const response = await GET(
      makeRequest('http://localhost/api/community/feed/extractions/ext-1?limit=999'),
      { params: { extractionId: 'ext-1' } }
    )
    const payload = (await response.json()) as {
      extractionId: string
      items: Array<{ id: string; author: { userId: string }; metrics: { reactionsCount: number } }>
    }

    expect(response.status).toBe(200)
    expect(dbMocks.listCommunityPostsByExtractionForUser).toHaveBeenCalledWith({
      userId: 'u1',
      extractionId: 'ext-1',
      limit: 100,
    })
    expect(dbMocks.recordCommunityPostViewsForUser).toHaveBeenCalledWith({
      userId: 'u1',
      postIds: ['post-1'],
    })
    expect(payload.extractionId).toBe('ext-1')
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0]).toMatchObject({
      id: 'post-1',
      author: { userId: 'owner-1' },
      metrics: { reactionsCount: 2 },
    })
  })
})
