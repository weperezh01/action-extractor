import {
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptEmptyError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from '@danielxceron/youtube-transcript'
import { YoutubeTranscriptTemporarilyUnavailableError } from '@/lib/youtube-transcript-fallback'

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 1200

export interface RetryBackoffContext {
  error: unknown
  attempt: number
  nextAttempt: number
  maxAttempts: number
  delayMs: number
}

interface RetryBackoffOptions {
  maxAttempts?: number
  baseDelayMs?: number
  shouldRetry: (error: unknown, attempt: number) => boolean
  onRetry?: (context: RetryBackoffContext) => void | Promise<void>
}

export interface ExtractionUserFacingError {
  status: number
  retryable: boolean
  message: string
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryBackoffOptions
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS)

  let lastError: unknown = new Error('Unknown retry error.')

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error
      const hasNextAttempt = attempt < maxAttempts
      if (!hasNextAttempt || !options.shouldRetry(error, attempt)) {
        throw error
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1)
      await options.onRetry?.({
        error,
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts,
        delayMs,
      })
      await wait(delayMs)
    }
  }

  throw lastError
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }

  const candidate = error as {
    status?: unknown
    statusCode?: unknown
    code?: unknown
    error?: { status?: unknown; statusCode?: unknown } | null
  }

  const values = [
    candidate.status,
    candidate.statusCode,
    candidate.error?.status,
    candidate.error?.statusCode,
  ]

  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value)
    }

    const parsed = Number.parseInt(String(value ?? ''), 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function isLikelyNetworkError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const candidate = error as { code?: unknown; name?: unknown; message?: unknown }
  const code = String(candidate.code ?? '').toUpperCase()
  const name = String(candidate.name ?? '')
  const message = String(candidate.message ?? '').toLowerCase()

  if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) {
    return true
  }

  if (name.includes('APIConnection') || name.includes('Timeout')) {
    return true
  }

  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('fetch failed') ||
    message.includes('connection')
  )
}

function isJsonFormatError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('json inválido') ||
    message.includes('json invalido') ||
    message.includes('normalizar la respuesta') ||
    message.includes('invalid json') ||
    message.includes('normalize response')
  )
}

export function classifyTranscriptError(error: unknown): ExtractionUserFacingError {
  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return {
      status: 429,
      retryable: true,
      message:
        'YouTube is temporarily rate-limiting transcript requests. Wait 2-5 minutes and try again.',
    }
  }

  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    return {
      status: 404,
      retryable: false,
      message:
        'This video is not available (private, deleted, or region-restricted). Verify the link and make sure it is public.',
    }
  }

  if (error instanceof YoutubeTranscriptTemporarilyUnavailableError) {
    const languages =
      error.availableLanguages.length > 0 ? ` (detected: ${error.availableLanguages.join(', ')})` : ''
    const fallbackNote = error.audioFallbackAttempted
      ? ' Automatic audio fallback was attempted but did not succeed.'
      : ' Automatic audio fallback is not configured on this server.'
    return {
      status: 503,
      retryable: true,
      message:
        `YouTube has captions for this video${languages}, but transcript downloads are temporarily blocked from the server.${fallbackNote} Wait 2-5 minutes and try again.`,
    }
  }

  if (error instanceof YoutubeTranscriptEmptyError) {
    return {
      status: 503,
      retryable: true,
      message:
        'YouTube returned an empty transcript payload. This is usually temporary. Wait 2-5 minutes and try again.',
    }
  }

  if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
    return {
      status: 422,
      retryable: false,
      message:
        'Captions exist, but not in a supported language for this request. Try another video or subtitles language.',
    }
  }

  if (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError
  ) {
    return {
      status: 422,
      retryable: false,
      message:
        'This video does not have captions available. Try a video with automatic or manual subtitles enabled.',
    }
  }

  return {
    status: 502,
    retryable: true,
    message:
      'Could not fetch the transcript after multiple automatic retries. Make sure the video is public and has captions, then try again in a few minutes.',
  }
}

export function classifyModelError(error: unknown): ExtractionUserFacingError {
  if (isJsonFormatError(error)) {
    return {
      status: 502,
      retryable: false,
      message:
        'The AI returned an invalid format even after automatic correction. Try again or use a different video.',
    }
  }

  const status = getErrorStatus(error)
  if (status === 429) {
    return {
      status: 429,
      retryable: true,
      message:
        'The AI service is temporarily over capacity or quota-limited. Wait 1-2 minutes and try again.',
    }
  }

  if (status === 401 || status === 403) {
    return {
      status: 503,
      retryable: false,
      message:
        'The AI service is not authorized at this time. Contact the platform administrator.',
    }
  }

  if (status !== null && status >= 500) {
    return {
      status: 502,
      retryable: true,
      message:
        'The AI service had a temporary failure. We retried automatically but could not complete. Try again in a few minutes.',
    }
  }

  if (isLikelyNetworkError(error)) {
    return {
      status: 503,
      retryable: true,
      message:
        'Could not connect to the AI service. Check your connection and try again in a few minutes.',
    }
  }

  if (status !== null && status >= 400 && status < 500) {
    return {
      status: 502,
      retryable: false,
      message:
        'The AI could not process this content. Try a different video or URL.',
    }
  }

  return {
    status: 502,
    retryable: true,
    message:
      'Could not generate the extraction after multiple automatic retries. Try again, or use a different video if the problem persists.',
  }
}
