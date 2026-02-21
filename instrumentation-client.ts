import * as Sentry from '@sentry/nextjs'
import {
  resolveSentryClientDsn,
  resolveSentryEnvironment,
  resolveSentryRelease,
  resolveSentryTracesSampleRate,
} from '@/lib/monitoring'

const dsn = resolveSentryClientDsn()

if (dsn) {
  Sentry.init({
    dsn,
    enabled: true,
    environment: resolveSentryEnvironment(),
    release: resolveSentryRelease(),
    tracesSampleRate: resolveSentryTracesSampleRate(),
    integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
