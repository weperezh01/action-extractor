import {
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from '@danielxceron/youtube-transcript'
import { describe, expect, it, vi } from 'vitest'
import { classifyModelError, classifyTranscriptError, retryWithBackoff } from '@/lib/extract-resilience'

describe('lib/extract-resilience', () => {
  describe('retryWithBackoff', () => {
    it('reintenta y termina en éxito', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail-1'))
        .mockRejectedValueOnce(new Error('fail-2'))
        .mockResolvedValue('ok')

      const onRetry = vi.fn()

      const result = await retryWithBackoff(operation, {
        maxAttempts: 3,
        baseDelayMs: 1,
        shouldRetry: () => true,
        onRetry,
      })

      expect(result).toBe('ok')
      expect(operation).toHaveBeenCalledTimes(3)
      expect(onRetry).toHaveBeenCalledTimes(2)
    })

    it('no reintenta cuando shouldRetry retorna false', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('boom'))

      await expect(
        retryWithBackoff(operation, {
          maxAttempts: 3,
          baseDelayMs: 1,
          shouldRetry: () => false,
        })
      ).rejects.toThrow('boom')

      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('classifyModelError', () => {
    it('clasifica saturación/quota (429) como retryable', () => {
      expect(classifyModelError({ status: 429 })).toMatchObject({
        status: 429,
        retryable: true,
      })
    })

    it('clasifica errores de formato JSON como no retryable', () => {
      expect(classifyModelError(new Error('JSON inválido en respuesta'))).toMatchObject({
        status: 502,
        retryable: false,
      })
    })
  })

  describe('classifyTranscriptError', () => {
    it('clasifica rate limit de transcript con 429 retryable', () => {
      const error = new YoutubeTranscriptTooManyRequestError()
      expect(classifyTranscriptError(error)).toMatchObject({ status: 429, retryable: true })
    })

    it('clasifica video no disponible con 404 no retryable', () => {
      const error = new YoutubeTranscriptVideoUnavailableError('video-id')
      expect(classifyTranscriptError(error)).toMatchObject({ status: 404, retryable: false })
    })

    it('clasifica transcript deshabilitado con 422 no retryable', () => {
      const error = new YoutubeTranscriptDisabledError('video-id')
      expect(classifyTranscriptError(error)).toMatchObject({ status: 422, retryable: false })
    })
  })
})
