import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
  ensureDbReady: vi.fn(),
  query: vi.fn(),
}))

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
}))

vi.mock('@/lib/db', () => ({
  ensureDbReady: dbMocks.ensureDbReady,
  pool: {
    query: dbMocks.query,
  },
}))

vi.mock('fs', () => ({
  default: {
    existsSync: fsMocks.existsSync,
    readFileSync: fsMocks.readFileSync,
  },
}))

import { GET } from '@/app/api/uploads/[filename]/route'

function makeRequest(url = 'http://localhost/api/uploads/public-file.pdf') {
  return new NextRequest(url, { method: 'GET' })
}

describe('GET /api/uploads/[filename]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.ensureDbReady.mockResolvedValue(undefined)
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockReturnValue(Buffer.from('file-body'))
  })

  it('permite acceso anónimo cuando el archivo pertenece a una extracción pública', async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null)
    dbMocks.query.mockResolvedValue({
      rows: [
        {
          source_file_mime_type: 'application/pdf',
          source_file_name: 'public-file.pdf',
          share_visibility: 'public',
        },
      ],
    })

    const response = await GET(makeRequest(), { params: { filename: 'public-file.pdf' } })

    expect(response.status).toBe(200)
    expect(dbMocks.query).toHaveBeenCalledWith(expect.any(String), [null, '/api/uploads/public-file.pdf'])
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
  })

  it('no expone archivos privados a usuarios anónimos', async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null)
    dbMocks.query.mockResolvedValue({ rows: [] })

    const response = await GET(makeRequest('http://localhost/api/uploads/private-file.pdf'), {
      params: { filename: 'private-file.pdf' },
    })
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(404)
    expect(payload.error).toContain('Archivo no encontrado')
  })

  it('rechaza nombres de archivo inválidos', async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null)

    const response = await GET(makeRequest('http://localhost/api/uploads/../secret.txt'), {
      params: { filename: '../secret.txt' },
    })

    expect(response.status).toBe(400)
    expect(dbMocks.query).not.toHaveBeenCalled()
  })
})
