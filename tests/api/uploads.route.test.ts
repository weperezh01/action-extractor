import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
}))

const extractionDbMocks = vi.hoisted(() => ({
  findReadableUploadFileByUrl: vi.fn(),
}))

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
}))

vi.mock('@/lib/db/extractions', () => ({
  findReadableUploadFileByUrl: extractionDbMocks.findReadableUploadFileByUrl,
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
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockReturnValue(Buffer.from('file-body'))
  })

  it('permite acceso anónimo cuando el archivo pertenece a una extracción pública', async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null)
    extractionDbMocks.findReadableUploadFileByUrl.mockResolvedValue({
      sourceFileMimeType: 'application/pdf',
      sourceFileName: 'public-file.pdf',
      shareVisibility: 'public',
    })

    const response = await GET(makeRequest(), { params: { filename: 'public-file.pdf' } })

    expect(response.status).toBe(200)
    expect(extractionDbMocks.findReadableUploadFileByUrl).toHaveBeenCalledWith({
      fileUrl: '/api/uploads/public-file.pdf',
      requestingUserId: null,
    })
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
  })

  it('no expone archivos privados a usuarios anónimos', async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null)
    extractionDbMocks.findReadableUploadFileByUrl.mockResolvedValue(null)

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
    expect(extractionDbMocks.findReadableUploadFileByUrl).not.toHaveBeenCalled()
  })

  it('mantiene caché privada para archivos autorizados sin visibilidad pública', async () => {
    authMocks.getUserFromRequest.mockResolvedValue({ id: 'viewer-1' })
    extractionDbMocks.findReadableUploadFileByUrl.mockResolvedValue({
      sourceFileMimeType: 'application/pdf',
      sourceFileName: 'shared-file.pdf',
      shareVisibility: 'private',
    })

    const response = await GET(makeRequest('http://localhost/api/uploads/shared-file.pdf'), {
      params: { filename: 'shared-file.pdf' },
    })

    expect(response.status).toBe(200)
    expect(extractionDbMocks.findReadableUploadFileByUrl).toHaveBeenCalledWith({
      fileUrl: '/api/uploads/shared-file.pdf',
      requestingUserId: 'viewer-1',
    })
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600')
  })
})
