const DEFAULT_TRACES_SAMPLE_RATE = 0.1

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function resolveSentryServerDsn() {
  return normalizeEnvValue(process.env.SENTRY_DSN) ?? normalizeEnvValue(process.env.NEXT_PUBLIC_SENTRY_DSN)
}

export function resolveSentryClientDsn() {
  return normalizeEnvValue(process.env.NEXT_PUBLIC_SENTRY_DSN)
}

export function resolveSentryEnvironment() {
  return (
    normalizeEnvValue(process.env.SENTRY_ENVIRONMENT) ??
    normalizeEnvValue(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ??
    process.env.NODE_ENV ??
    'production'
  )
}

export function resolveSentryRelease() {
  return normalizeEnvValue(process.env.SENTRY_RELEASE) ?? normalizeEnvValue(process.env.NEXT_PUBLIC_SENTRY_RELEASE)
}

export function resolveSentryTracesSampleRate() {
  const raw = normalizeEnvValue(process.env.SENTRY_TRACES_SAMPLE_RATE)
  if (!raw) return DEFAULT_TRACES_SAMPLE_RATE

  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_TRACES_SAMPLE_RATE
  if (parsed < 0) return 0
  if (parsed > 1) return 1
  return parsed
}
