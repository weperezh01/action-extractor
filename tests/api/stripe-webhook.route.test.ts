import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stripeMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSubscription: vi.fn(),
}))

const dbMocks = vi.hoisted(() => ({
  claimStripeEventProcessing: vi.fn(),
  markStripeEventProcessed: vi.fn(),
  releaseStripeEventProcessing: vi.fn(),
  getUserByStripeCustomerId: vi.fn(),
  setUserStripeCustomerId: vi.fn(),
  upsertUserActivePlan: vi.fn(),
  deactivateUserPlan: vi.fn(),
  addUserCredits: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: stripeMocks.constructEvent,
    },
    subscriptions: {
      retrieve: stripeMocks.retrieveSubscription,
    },
  },
  planFromPriceId: vi.fn((priceId: string) => (priceId === 'price_pro' ? 'pro' : null)),
  PLAN_LIMITS: {
    pro: 40,
  },
  CREDIT_PACK_AMOUNTS: {
    pack_small: 25,
  },
}))

vi.mock('@/lib/db/billing', () => ({
  claimStripeEventProcessing: dbMocks.claimStripeEventProcessing,
  markStripeEventProcessed: dbMocks.markStripeEventProcessed,
  releaseStripeEventProcessing: dbMocks.releaseStripeEventProcessing,
  getUserByStripeCustomerId: dbMocks.getUserByStripeCustomerId,
  setUserStripeCustomerId: dbMocks.setUserStripeCustomerId,
  upsertUserActivePlan: dbMocks.upsertUserActivePlan,
  deactivateUserPlan: dbMocks.deactivateUserPlan,
  addUserCredits: dbMocks.addUserCredits,
}))

import { POST } from '@/app/api/stripe/webhook/route'

function makeRequest(body = '{}') {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': 'sig_123',
      'content-type': 'application/json',
    },
    body,
  }) as unknown as NextRequest
}

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.claimStripeEventProcessing.mockResolvedValue(true)
    dbMocks.markStripeEventProcessed.mockResolvedValue(undefined)
    dbMocks.releaseStripeEventProcessing.mockResolvedValue(undefined)
    dbMocks.addUserCredits.mockResolvedValue({ applied: true })
  })

  it('omite procesamiento cuando el evento ya fue reclamado o procesado', async () => {
    stripeMocks.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: {} },
    })
    dbMocks.claimStripeEventProcessing.mockResolvedValue(false)

    const response = await POST(makeRequest('{"id":"evt_1"}'))

    expect(response.status).toBe(200)
    expect(dbMocks.addUserCredits).not.toHaveBeenCalled()
    expect(dbMocks.markStripeEventProcessed).not.toHaveBeenCalled()
  })

  it('marca como procesado un checkout de créditos exitoso', async () => {
    stripeMocks.constructEvent.mockReturnValue({
      id: 'evt_credits',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          metadata: {
            userId: 'user-1',
            type: 'credits',
            packId: 'pack_small',
          },
        },
      },
    })

    const response = await POST(makeRequest('{"id":"evt_credits"}'))

    expect(response.status).toBe(200)
    expect(dbMocks.addUserCredits).toHaveBeenCalledWith('user-1', 25, 'purchase', 'cs_123')
    expect(dbMocks.markStripeEventProcessed).toHaveBeenCalledWith('evt_credits')
  })

  it('libera el claim cuando ocurre un error durante el procesamiento', async () => {
    stripeMocks.constructEvent.mockReturnValue({
      id: 'evt_fail',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_fail',
          metadata: {
            userId: 'user-1',
            type: 'credits',
            packId: 'pack_small',
          },
        },
      },
    })
    dbMocks.addUserCredits.mockRejectedValue(new Error('ledger failed'))

    const response = await POST(makeRequest('{"id":"evt_fail"}'))
    const payload = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(payload.error).toContain('Webhook handler error')
    expect(dbMocks.releaseStripeEventProcessing).toHaveBeenCalledWith('evt_fail', 'ledger failed')
  })
})
