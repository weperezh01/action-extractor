import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  consumeExtractionRateLimitByUser: vi.fn(),
  getExtractionRateLimitUsageByUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  consumeExtractionRateLimitByUser: dbMocks.consumeExtractionRateLimitByUser,
  getExtractionRateLimitUsageByUser: dbMocks.getExtractionRateLimitUsageByUser,
}))

import {
  buildExtractionRateLimitMessage,
  consumeUserExtractionRateLimit,
  getUserExtractionRateLimitSnapshot,
  resolveExtractionRateLimitPerHour,
} from '@/lib/rate-limit'

const ORIGINAL_LIMIT_ENV = process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR

describe('lib/rate-limit', () => {
  beforeEach(() => {
    dbMocks.consumeExtractionRateLimitByUser.mockReset()
    dbMocks.getExtractionRateLimitUsageByUser.mockReset()
    delete process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR
  })

  afterEach(() => {
    if (ORIGINAL_LIMIT_ENV === undefined) {
      delete process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR
      return
    }

    process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR = ORIGINAL_LIMIT_ENV
  })

  it('usa el límite por defecto cuando env no está definida o es inválida', () => {
    expect(resolveExtractionRateLimitPerHour()).toBe(12)

    process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR = 'abc'
    expect(resolveExtractionRateLimitPerHour()).toBe(12)

    process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR = '0'
    expect(resolveExtractionRateLimitPerHour()).toBe(12)
  })

  it('limita el valor máximo a 500 por hora', () => {
    process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR = '9999'
    expect(resolveExtractionRateLimitPerHour()).toBe(500)
  })

  it('consume rate limit y calcula retryAfterSeconds', async () => {
    process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR = '20'

    const now = new Date('2026-02-21T12:00:00.000Z').getTime()
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)

    dbMocks.consumeExtractionRateLimitByUser.mockResolvedValue({
      allowed: false,
      limit: 20,
      used: 20,
      remaining: 0,
      reset_at: new Date(now + 4_500).toISOString(),
    })

    const result = await consumeUserExtractionRateLimit('user-123')

    expect(dbMocks.consumeExtractionRateLimitByUser).toHaveBeenCalledWith({ userId: 'user-123', limit: 20 })
    expect(result).toMatchObject({
      allowed: false,
      limit: 20,
      used: 20,
      remaining: 0,
      retryAfterSeconds: 5,
    })

    dateNowSpy.mockRestore()
  })

  it('retorna fallback de retryAfterSeconds cuando reset_at es inválido', async () => {
    dbMocks.getExtractionRateLimitUsageByUser.mockResolvedValue({
      allowed: true,
      limit: 12,
      used: 3,
      remaining: 9,
      reset_at: 'not-a-date',
    })

    const result = await getUserExtractionRateLimitSnapshot('user-abc')

    expect(dbMocks.getExtractionRateLimitUsageByUser).toHaveBeenCalledWith({ userId: 'user-abc', limit: 12 })
    expect(result.retryAfterSeconds).toBe(60)
  })

  it('construye el mensaje de rate limit para UX', () => {
    expect(buildExtractionRateLimitMessage(12)).toBe(
      'Has alcanzado el límite de 12 extracciones por hora. Intenta de nuevo en unos minutos.'
    )
  })
})
