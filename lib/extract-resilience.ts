import {
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptEmptyError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from '@danielxceron/youtube-transcript'

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

  let lastError: unknown = new Error('Retry error desconocido.')

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
    message.includes('normalizar la respuesta')
  )
}

export function classifyTranscriptError(error: unknown): ExtractionUserFacingError {
  if (error instanceof YoutubeTranscriptTooManyRequestError) {
    return {
      status: 429,
      retryable: true,
      message:
        'YouTube está limitando temporalmente la transcripción por exceso de solicitudes. Espera 2-5 minutos y vuelve a intentar.',
    }
  }

  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    return {
      status: 404,
      retryable: false,
      message:
        'El video no está disponible (privado, eliminado o restringido). Verifica el enlace y que sea público.',
    }
  }

  if (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError ||
    error instanceof YoutubeTranscriptNotAvailableLanguageError ||
    error instanceof YoutubeTranscriptEmptyError
  ) {
    return {
      status: 422,
      retryable: false,
      message:
        'Este video no tiene subtítulos disponibles. Prueba con un video que tenga subtítulos automáticos o manuales.',
    }
  }

  return {
    status: 502,
    retryable: true,
    message:
      'No se pudo obtener la transcripción tras varios intentos automáticos. Sugerencias: verifica que el video sea público, tenga subtítulos y vuelve a intentar en unos minutos.',
  }
}

export function classifyModelError(error: unknown): ExtractionUserFacingError {
  if (isJsonFormatError(error)) {
    return {
      status: 502,
      retryable: false,
      message:
        'La IA devolvió un formato inválido incluso después de corrección automática. Intenta nuevamente o prueba con otro video.',
    }
  }

  const status = getErrorStatus(error)
  if (status === 429) {
    return {
      status: 429,
      retryable: true,
      message:
        'El servicio de IA está temporalmente saturado o en límite de cuota. Espera 1-2 minutos y vuelve a intentar.',
    }
  }

  if (status === 401 || status === 403) {
    return {
      status: 503,
      retryable: false,
      message:
        'El servicio de IA no está autorizado en este momento. Contacta al administrador de la plataforma.',
    }
  }

  if (status !== null && status >= 500) {
    return {
      status: 502,
      retryable: true,
      message:
        'El servicio de IA tuvo una falla temporal. Reintentamos automáticamente, pero no se pudo completar. Intenta de nuevo en unos minutos.',
    }
  }

  if (isLikelyNetworkError(error)) {
    return {
      status: 503,
      retryable: true,
      message:
        'No se pudo conectar con el servicio de IA. Revisa tu conexión y vuelve a intentar en unos minutos.',
    }
  }

  if (status !== null && status >= 400 && status < 500) {
    return {
      status: 502,
      retryable: false,
      message:
        'La solicitud a la IA no pudo procesarse con este contenido. Prueba con otro video o una URL diferente.',
    }
  }

  return {
    status: 502,
    retryable: true,
    message:
      'No se pudo generar la extracción con IA tras varios intentos automáticos. Intenta nuevamente y, si persiste, prueba con otro video.',
  }
}
