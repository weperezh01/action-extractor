import * as Sentry from '@sentry/nextjs'
import {
  resolveSentryEnvironment,
  resolveSentryRelease,
  resolveSentryServerDsn,
  resolveSentryTracesSampleRate,
} from '@/lib/monitoring'

const dsn = resolveSentryServerDsn()

if (dsn) {
  Sentry.init({
    dsn,
    enabled: true,
    environment: resolveSentryEnvironment(),
    release: resolveSentryRelease(),
    tracesSampleRate: resolveSentryTracesSampleRate(),
  })
}
