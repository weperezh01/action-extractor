import {
  consumeCommunityActionRateLimitByUser,
  consumeExtractionRateLimitByUser,
  consumeGuestExtractionRateLimit,
  getCommunityActionRateLimitUsageByUser,
  getExtractionRateLimitUsageByUser,
} from '@/lib/db'

const DEFAULT_EXTRACTIONS_PER_HOUR = 12
const MAX_EXTRACTIONS_PER_HOUR = 500
const DEFAULT_COMMUNITY_POSTS_PER_HOUR = 30
const DEFAULT_COMMUNITY_COMMENTS_PER_HOUR = 120
const DEFAULT_COMMUNITY_FOLLOWS_PER_HOUR = 120
const MAX_COMMUNITY_ACTIONS_PER_HOUR = 2000

const COMMUNITY_ACTION_WINDOW_MINUTES = 60

export type CommunityActionKind = 'post' | 'comment' | 'follow'

export interface UserExtractionRateLimitResult {
  allowed: boolean
  limit: number
  used: number
  remaining: number
  resetAt: string
  retryAfterSeconds: number
}

export interface UserCommunityActionRateLimitResult {
  allowed: boolean
  limit: number
  used: number
  remaining: number
  resetAt: string
  retryAfterSeconds: number
}

export function resolveExtractionRateLimitPerHour() {
  const rawLimit = process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR
  if (!rawLimit) {
    return DEFAULT_EXTRACTIONS_PER_HOUR
  }

  const parsed = Number.parseInt(rawLimit, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_EXTRACTIONS_PER_HOUR
  }

  return Math.min(parsed, MAX_EXTRACTIONS_PER_HOUR)
}

export async function consumeUserExtractionRateLimit(userId: string): Promise<UserExtractionRateLimitResult> {
  const limit = resolveExtractionRateLimitPerHour()
  const usage = await consumeExtractionRateLimitByUser({ userId, limit })

  const resetAtMs = new Date(usage.reset_at).getTime()
  const retryAfterSeconds = Number.isFinite(resetAtMs)
    ? Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000))
    : 60

  return {
    allowed: usage.allowed,
    limit: usage.limit,
    used: usage.used,
    remaining: usage.remaining,
    resetAt: usage.reset_at,
    retryAfterSeconds,
  }
}

export async function getUserExtractionRateLimitSnapshot(
  userId: string
): Promise<UserExtractionRateLimitResult> {
  const limit = resolveExtractionRateLimitPerHour()
  const usage = await getExtractionRateLimitUsageByUser({ userId, limit })

  const resetAtMs = new Date(usage.reset_at).getTime()
  const retryAfterSeconds = Number.isFinite(resetAtMs)
    ? Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000))
    : 60

  return {
    allowed: usage.allowed,
    limit: usage.limit,
    used: usage.used,
    remaining: usage.remaining,
    resetAt: usage.reset_at,
    retryAfterSeconds,
  }
}

function resolveCommunityActionDefaults(action: CommunityActionKind) {
  if (action === 'post') {
    return {
      envKey: 'ACTION_EXTRACTOR_COMMUNITY_POSTS_PER_HOUR',
      defaultLimit: DEFAULT_COMMUNITY_POSTS_PER_HOUR,
      actionKey: 'community_post_create',
      label: 'posts',
    } as const
  }
  if (action === 'comment') {
    return {
      envKey: 'ACTION_EXTRACTOR_COMMUNITY_COMMENTS_PER_HOUR',
      defaultLimit: DEFAULT_COMMUNITY_COMMENTS_PER_HOUR,
      actionKey: 'community_comment_create',
      label: 'comentarios',
    } as const
  }
  return {
    envKey: 'ACTION_EXTRACTOR_COMMUNITY_FOLLOWS_PER_HOUR',
    defaultLimit: DEFAULT_COMMUNITY_FOLLOWS_PER_HOUR,
    actionKey: 'community_follow_toggle',
    label: 'acciones de follow',
  } as const
}

export function resolveCommunityActionRateLimitPerHour(action: CommunityActionKind) {
  const config = resolveCommunityActionDefaults(action)
  const rawLimit = process.env[config.envKey]
  if (!rawLimit) return config.defaultLimit

  const parsed = Number.parseInt(rawLimit, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return config.defaultLimit

  return Math.min(parsed, MAX_COMMUNITY_ACTIONS_PER_HOUR)
}

export async function consumeUserCommunityActionRateLimit(
  userId: string,
  action: CommunityActionKind
): Promise<UserCommunityActionRateLimitResult> {
  const config = resolveCommunityActionDefaults(action)
  const limit = resolveCommunityActionRateLimitPerHour(action)
  const usage = await consumeCommunityActionRateLimitByUser({
    userId,
    actionKey: config.actionKey,
    limit,
    windowMinutes: COMMUNITY_ACTION_WINDOW_MINUTES,
  })

  const resetAtMs = new Date(usage.reset_at).getTime()
  const retryAfterSeconds = Number.isFinite(resetAtMs)
    ? Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000))
    : 60

  return {
    allowed: usage.allowed,
    limit: usage.limit,
    used: usage.used,
    remaining: usage.remaining,
    resetAt: usage.reset_at,
    retryAfterSeconds,
  }
}

export async function getUserCommunityActionRateLimitSnapshot(
  userId: string,
  action: CommunityActionKind
): Promise<UserCommunityActionRateLimitResult> {
  const config = resolveCommunityActionDefaults(action)
  const limit = resolveCommunityActionRateLimitPerHour(action)
  const usage = await getCommunityActionRateLimitUsageByUser({
    userId,
    actionKey: config.actionKey,
    limit,
    windowMinutes: COMMUNITY_ACTION_WINDOW_MINUTES,
  })

  const resetAtMs = new Date(usage.reset_at).getTime()
  const retryAfterSeconds = Number.isFinite(resetAtMs)
    ? Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000))
    : 60

  return {
    allowed: usage.allowed,
    limit: usage.limit,
    used: usage.used,
    remaining: usage.remaining,
    resetAt: usage.reset_at,
    retryAfterSeconds,
  }
}

export function buildExtractionRateLimitMessage(limit: number) {
  return `Has alcanzado el límite de ${limit} extracciones por hora. Intenta de nuevo en unos minutos.`
}

export function buildCommunityActionRateLimitMessage(action: CommunityActionKind, limit: number) {
  const label = resolveCommunityActionDefaults(action).label
  return `Has alcanzado el límite de ${limit} ${label} por hora. Intenta de nuevo en unos minutos.`
}

export async function consumeGuestRateLimit(guestId: string) {
  return consumeGuestExtractionRateLimit(guestId)
}
