import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  consumeExtractionRateLimitByUser: vi.fn(),
  consumeCommunityActionRateLimitByUser: vi.fn(),
  getExtractionRateLimitUsageByUser: vi.fn(),
  getCommunityActionRateLimitUsageByUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  consumeExtractionRateLimitByUser: dbMocks.consumeExtractionRateLimitByUser,
  consumeCommunityActionRateLimitByUser: dbMocks.consumeCommunityActionRateLimitByUser,
  getExtractionRateLimitUsageByUser: dbMocks.getExtractionRateLimitUsageByUser,
  getCommunityActionRateLimitUsageByUser: dbMocks.getCommunityActionRateLimitUsageByUser,
}))

import {
  buildCommunityActionRateLimitMessage,
  buildExtractionRateLimitMessage,
  consumeUserCommunityActionRateLimit,
  consumeUserExtractionRateLimit,
  getUserCommunityActionRateLimitSnapshot,
  getUserExtractionRateLimitSnapshot,
  resolveCommunityActionRateLimitPerHour,
  resolveExtractionRateLimitPerHour,
} from '@/lib/rate-limit'

const ORIGINAL_LIMIT_ENV = process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR
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
    dbMocks.consumeExtractionRateLimitByUser.mockReset()
    dbMocks.consumeCommunityActionRateLimitByUser.mockReset()
    dbMocks.getExtractionRateLimitUsageByUser.mockReset()
    dbMocks.getCommunityActionRateLimitUsageByUser.mockReset()
    delete process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR
    delete process.env.ACTION_EXTRACTOR_COMMUNITY_POSTS_PER_HOUR
    delete process.env.ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR
    delete process.env.ACTION_EXTRACTOR_COMMUNITY_FOLLOWS_PER_HOUR
  })

  afterEach(() => {
    restoreEnv('ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR', ORIGINAL_LIMIT_ENV)
    restoreEnv('ACTION_EXTRACTOR_COMMUNITY_POSTS_PER_HOUR', ORIGINAL_COMMUNITY_POSTS_LIMIT_ENV)
    restoreEnv('ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR', ORIGINAL_COMMUNITY_COMMENTS_LIMIT_ENV)
    restoreEnv('ACTION_EXTRACTOR_COMMUNITY_FOLLOWS_PER_HOUR', ORIGINAL_COMMUNITY_FOLLOWS_LIMIT_ENV)
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
