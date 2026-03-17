import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  listPlans: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  listPlans: dbMocks.listPlans,
}))

vi.mock('@/lib/stripe', () => ({
  CREDIT_PACK_PRICE_IDS: {
    pack_s: '',
    pack_m: 'price_pack_m',
    pack_l: '',
  },
}))

import { GET } from '@/app/api/plans/route'

describe('GET /api/plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna planes activos y disponibilidad de packs de créditos', async () => {
    dbMocks.listPlans.mockResolvedValue([
      { id: 'free', name: 'free', is_active: true },
      { id: 'legacy', name: 'legacy', is_active: false },
      { id: 'pro', name: 'pro', is_active: true },
    ])

    const response = await GET()
    const payload = (await response.json()) as {
      plans: Array<{ id: string; name: string }>
      creditPacks: Record<string, boolean>
    }

    expect(response.status).toBe(200)
    expect(payload.plans).toEqual([
      { id: 'free', name: 'free', is_active: true },
      { id: 'pro', name: 'pro', is_active: true },
    ])
    expect(payload.creditPacks).toEqual({
      pack_s: false,
      pack_m: true,
      pack_l: false,
    })
  })
})
