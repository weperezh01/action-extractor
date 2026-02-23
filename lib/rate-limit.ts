import { consumeExtractionRateLimitByUser, consumeGuestExtractionRateLimit, getExtractionRateLimitUsageByUser } from '@/lib/db'

const DEFAULT_EXTRACTIONS_PER_HOUR = 12
const MAX_EXTRACTIONS_PER_HOUR = 500

export interface UserExtractionRateLimitResult {
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

export function buildExtractionRateLimitMessage(limit: number) {
  return `Has alcanzado el límite de ${limit} extracciones por hora. Intenta de nuevo en unos minutos.`
}

export async function consumeGuestRateLimit(guestId: string) {
  return consumeGuestExtractionRateLimit(guestId)
}
