import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  consumeDailyExtraction: vi.fn(),
  getDailyExtractionSnapshot: vi.fn(),
  consumeCommunityActionRateLimitByUser: vi.fn(),
  getCommunityActionRateLimitUsageByUser: vi.fn(),
  consumeGuestExtractionRateLimit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  consumeDailyExtraction: dbMocks.consumeDailyExtraction,
  getDailyExtractionSnapshot: dbMocks.getDailyExtractionSnapshot,
  consumeCommunityActionRateLimitByUser: dbMocks.consumeCommunityActionRateLimitByUser,
  getCommunityActionRateLimitUsageByUser: dbMocks.getCommunityActionRateLimitUsageByUser,
  consumeGuestExtractionRateLimit: dbMocks.consumeGuestExtractionRateLimit,
}))

import {
  buildCommunityActionRateLimitMessage,
  buildExtractionRateLimitMessage,
  consumeUserCommunityActionRateLimit,
  consumeUserExtractionRateLimit,
  getUserCommunityActionRateLimitSnapshot,
  getUserExtractionRateLimitSnapshot,
  resolveCommunityActionRateLimitPerHour,
} from '@/lib/rate-limit'

const ORIGINAL_COMMUNITY_POSTS_LIMIT_ENV = process.env.ACTION_EXTRACTOR_COMMUNITY_POSTS_PER_HOUR
const ORIGINAL_COMMUNITY_COMMENTS_LIMIT_ENV = process.env.ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR
const ORIGINAL_COMMUNITY_FOLLOWS_LIMIT_ENV = process.env.ACTION_EXTRACTOR_COMMUNITY_FOLLOWS_PER_HOUR

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

describe('lib/rate-limit', () => {
  beforeEach(() => {
    dbMocks.consumeDailyExtraction.mockReset()
    dbMocks.getDailyExtractionSnapshot.mockReset()
    dbMocks.consumeCommunityActionRateLimitByUser.mockReset()
    dbMocks.getCommunityActionRateLimitUsageByUser.mockReset()
    delete process.env.ACTION_EXTRACTOR_COMMUNITY_POSTS_PER_HOUR
    delete process.env.ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR
    delete process.env.ACTION_EXTRACTOR_COMMUNITY_FOLLOWS_PER_HOUR
  })

  afterEach(() => {
    restoreEnv('ACTION_EXTRACTOR_COMMUNITY_POSTS_PER_HOUR', ORIGINAL_COMMUNITY_POSTS_LIMIT_ENV)
    restoreEnv('ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR', ORIGINAL_COMMUNITY_COMMENTS_LIMIT_ENV)
    restoreEnv('ACTION_EXTRACTOR_COMMUNITY_FOLLOWS_PER_HOUR', ORIGINAL_COMMUNITY_FOLLOWS_LIMIT_ENV)
  })

  it('consume daily extraction and returns correct result', async () => {
    const now = new Date('2026-03-02T12:00:00.000Z').getTime()
    const resetAt = new Date('2026-03-03T00:00:00.000Z').toISOString()
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)

    dbMocks.consumeDailyExtraction.mockResolvedValue({
      allowed: false,
      used_credit: false,
      snapshot: {
        limit: 3,
        used: 3,
        remaining: 0,
        extra_credits: 0,
        reset_at: resetAt,
      },
    })

    const result = await consumeUserExtractionRateLimit('user-123')

    expect(dbMocks.consumeDailyExtraction).toHaveBeenCalledWith('user-123')
    expect(result).toMatchObject({
      allowed: false,
      limit: 3,
      used: 3,
      remaining: 0,
      extra_credits: 0,
      used_credit: false,
    })

    dateNowSpy.mockRestore()
  })

  it('snapshot returns allowed=true when credits available even if daily limit exhausted', async () => {
    const resetAt = new Date('2026-03-03T00:00:00.000Z').toISOString()

    dbMocks.getDailyExtractionSnapshot.mockResolvedValue({
      limit: 3,
      used: 3,
      remaining: 0,
      extra_credits: 5,
      reset_at: resetAt,
    })

    const result = await getUserExtractionRateLimitSnapshot('user-abc')

    expect(result.allowed).toBe(true)
    expect(result.extra_credits).toBe(5)
  })

  it('snapshot returns allowed=false when daily limit exhausted and no credits', async () => {
    const resetAt = new Date('2026-03-03T00:00:00.000Z').toISOString()

    dbMocks.getDailyExtractionSnapshot.mockResolvedValue({
      limit: 3,
      used: 3,
      remaining: 0,
      extra_credits: 0,
      reset_at: resetAt,
    })

    const result = await getUserExtractionRateLimitSnapshot('user-abc')

    expect(result.allowed).toBe(false)
    expect(result.extra_credits).toBe(0)
  })

  it('construye el mensaje de rate limit para UX', () => {
    expect(buildExtractionRateLimitMessage(3)).toBe(
      'Has alcanzado el límite de 3 extracciones por día. Vuelve mañana o compra créditos extra.'
    )
  })

  it('usa límites por defecto de comunidad cuando env no está definida o es inválida', () => {
    expect(resolveCommunityActionRateLimitPerHour('post')).toBe(30)
    expect(resolveCommunityActionRateLimitPerHour('comment')).toBe(120)
    expect(resolveCommunityActionRateLimitPerHour('follow')).toBe(120)

    process.env.ACTION_EXTRACTOR_COMMUNITY_POSTS_PER_HOUR = 'abc'
    process.env.ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR = '0'
    process.env.ACTION_EXTRACTOR_COMMUNITY_FOLLOWS_PER_HOUR = '-1'
    expect(resolveCommunityActionRateLimitPerHour('post')).toBe(30)
    expect(resolveCommunityActionRateLimitPerHour('comment')).toBe(120)
    expect(resolveCommunityActionRateLimitPerHour('follow')).toBe(120)
  })

  it('limita el valor máximo de acciones de comunidad a 2000 por hora', () => {
    process.env.ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR = '99999'
    expect(resolveCommunityActionRateLimitPerHour('comment')).toBe(2000)
  })

  it('consume rate limit de comunidad y calcula retryAfterSeconds', async () => {
    process.env.ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR = '150'

    const now = new Date('2026-02-21T12:00:00.000Z').getTime()
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)

    dbMocks.consumeCommunityActionRateLimitByUser.mockResolvedValue({
      allowed: false,
      limit: 150,
      used: 150,
      remaining: 0,
      reset_at: new Date(now + 4_500).toISOString(),
    })

    const result = await consumeUserCommunityActionRateLimit('user-123', 'comment')

    expect(dbMocks.consumeCommunityActionRateLimitByUser).toHaveBeenCalledWith({
      userId: 'user-123',
      actionKey: 'community_comment_create',
      limit: 150,
      windowMinutes: 60,
    })
    expect(result).toMatchObject({
      allowed: false,
      limit: 150,
      used: 150,
      remaining: 0,
      retryAfterSeconds: 5,
    })

    dateNowSpy.mockRestore()
  })

  it('retorna fallback de retryAfterSeconds para snapshot de comunidad cuando reset_at es inválido', async () => {
    dbMocks.getCommunityActionRateLimitUsageByUser.mockResolvedValue({
      allowed: true,
      limit: 120,
      used: 4,
      remaining: 116,
      reset_at: 'not-a-date',
    })

    const result = await getUserCommunityActionRateLimitSnapshot('user-abc', 'follow')

    expect(dbMocks.getCommunityActionRateLimitUsageByUser).toHaveBeenCalledWith({
      userId: 'user-abc',
      actionKey: 'community_follow_toggle',
      limit: 120,
      windowMinutes: 60,
    })
    expect(result.retryAfterSeconds).toBe(60)
  })

  it('construye el mensaje de rate limit de comunidad para UX', () => {
    expect(buildCommunityActionRateLimitMessage('follow', 120)).toBe(
      'Has alcanzado el límite de 120 acciones de follow por hora. Intenta de nuevo en unos minutos.'
    )
  })
})
