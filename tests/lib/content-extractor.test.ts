import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dnsMocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: dnsMocks.lookup,
  },
}))

import { assertSafeWebFetchUrl, extractWebContent } from '@/lib/content-extractor'

describe('lib/content-extractor hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dnsMocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rechaza localhost e IPs privadas literales', async () => {
    await expect(assertSafeWebFetchUrl('http://localhost:3000/private')).rejects.toThrow(/destino interno/i)
    await expect(assertSafeWebFetchUrl('http://127.0.0.1/secret')).rejects.toThrow(/ip privada|no permitida/i)
    await expect(assertSafeWebFetchUrl('http://[::1]/secret')).rejects.toThrow(/ip privada|no permitida/i)
  })

  it('rechaza hosts públicos que resuelven a IP privada', async () => {
    dnsMocks.lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])

    await expect(assertSafeWebFetchUrl('https://internal.example.com')).rejects.toThrow(/destino interno/i)
  })

  it('acepta URLs públicas válidas', async () => {
    await expect(assertSafeWebFetchUrl('https://example.com/article')).resolves.toBeInstanceOf(URL)
  })

  it('bloquea redirecciones hacia destinos privados', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }))

    vi.stubGlobal('fetch', fetchMock)

    await expect(extractWebContent('https://example.com/redirect')).rejects.toThrow(/ip privada|destino interno/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
