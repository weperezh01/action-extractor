import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  createExtraction: vi.fn(),
  findAnyVideoCacheByVideoId: vi.fn(),
  findExtractionOrderNumberForUser: vi.fn(),
  findVideoCacheByVideoId: vi.fn(),
  getAppSetting: vi.fn(),
  getPromptOverride: vi.fn(),
  upsertVideoCache: vi.fn(),
}))

const extractCoreMocks = vi.hoisted(() => ({
  extractVideoId: vi.fn(),
  getExtractionPromptVersion: vi.fn(),
  parseExtractionModelText: vi.fn(),
}))

const sourceMocks = vi.hoisted(() => ({
  detectSourceType: vi.fn(),
}))

vi.mock('@/lib/ai-usage-log', () => ({
  persistAiUsageLogsInBackground: vi.fn(),
}))

vi.mock('@/lib/ai-client', () => ({
  AI_PRICING_VERSION: 'test-pricing-version',
  callAi: vi.fn(),
  estimateCostUsd: vi.fn(() => 0),
  isProviderAvailable: vi.fn(() => true),
  resolveAiProvider: vi.fn((value: unknown, fallback: string) =>
    value === 'anthropic' || value === 'openai' || value === 'google' ? value : fallback
  ),
  resolveAiModel: vi.fn((provider: string, ...candidates: Array<string | null | undefined>) => {
    const modelsByProvider: Record<string, string[]> = {
      anthropic: ['claude-sonnet-test'],
      openai: ['gpt-4o', 'gpt-4o-mini'],
      google: ['gemini-2.0-flash'],
    }
    for (const candidate of candidates) {
      const normalized = typeof candidate === 'string' ? candidate.trim() : ''
      if (normalized && (modelsByProvider[provider] ?? []).includes(normalized)) {
        return normalized
      }
    }
    return modelsByProvider[provider]?.[0] ?? 'claude-sonnet-test'
  }),
}))

vi.mock('@/lib/extract-core', () => ({
  EXTRACTION_MODEL: 'claude-sonnet-test',
  extractVideoId: extractCoreMocks.extractVideoId,
  getExtractionPromptVersion: extractCoreMocks.getExtractionPromptVersion,
  parseExtractionModelText: extractCoreMocks.parseExtractionModelText,
}))

vi.mock('@/lib/extract-resilience', () => ({
  classifyModelError: vi.fn(() => ({ retryable: false, message: 'model-error', status: 500 })),
  classifyTranscriptError: vi.fn(() => ({ retryable: false, message: 'transcript-error', status: 422 })),
  retryWithBackoff: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}))

vi.mock('@/lib/extraction-modes', () => ({
  normalizeExtractionMode: vi.fn((value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : 'summary'
  ),
}))

vi.mock('@/lib/db', () => ({
  getAppSetting: dbMocks.getAppSetting,
  getPromptOverride: dbMocks.getPromptOverride,
}))

vi.mock('@/lib/db/extractions', () => ({
  createExtraction: dbMocks.createExtraction,
  findAnyVideoCacheByVideoId: dbMocks.findAnyVideoCacheByVideoId,
  findExtractionOrderNumberForUser: dbMocks.findExtractionOrderNumberForUser,
  findVideoCacheByVideoId: dbMocks.findVideoCacheByVideoId,
  upsertVideoCache: dbMocks.upsertVideoCache,
}))

vi.mock('@/lib/output-language', () => ({
  normalizeExtractionOutputLanguage: vi.fn((value: unknown) =>
    value === 'es' || value === 'en' || value === 'auto' ? value : 'auto'
  ),
}))

vi.mock('@/lib/playbook-tree', () => ({
  flattenItemsAsText: vi.fn(() => []),
  normalizePlaybookPhases: vi.fn(() => []),
}))

vi.mock('@/lib/rate-limit', () => ({
  buildExtractionRateLimitMessage: vi.fn(() => 'rate-limit-message'),
}))

vi.mock('@/lib/source-detector', () => ({
  detectSourceType: sourceMocks.detectSourceType,
}))

vi.mock('@/lib/video-preview', () => ({
  resolveVideoPreview: vi.fn(),
}))

vi.mock('@/lib/content-extractor', () => ({
  extractWebContent: vi.fn(),
}))

vi.mock('@/lib/youtube-transcript-fallback', () => ({
  resolveYoutubeTranscriptWithFallback: vi.fn(),
}))

import {
  ExtractionRequestError,
  loadExtractionRequestContext,
  parseExtractionRequestBody,
} from '@/lib/extraction-server'

describe('lib/extraction-server', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    extractCoreMocks.getExtractionPromptVersion.mockReturnValue('prompt-v1')
    extractCoreMocks.extractVideoId.mockImplementation((url: string) =>
      url.includes('watch?v=valid123') ? 'valid123' : null
    )
    sourceMocks.detectSourceType.mockImplementation((value: string) =>
      value.includes('youtube.com') ? 'youtube' : 'text'
    )

    dbMocks.getAppSetting.mockImplementation(async (key: string) => {
      if (key === 'extraction_provider') return 'openai'
      if (key === 'extraction_model') return 'gpt-4o-mini'
      return null
    })
    dbMocks.getPromptOverride.mockResolvedValue(null)
    dbMocks.findVideoCacheByVideoId.mockResolvedValue(null)
    dbMocks.findAnyVideoCacheByVideoId.mockResolvedValue(null)
  })

  it('requiere URL para fuentes web', () => {
    expect(() => parseExtractionRequestBody({ sourceType: 'web_url', mode: 'summary' })).toThrowError(
      new ExtractionRequestError('URL requerida.', 400)
    )
  })

  it('requiere texto para fuentes de tipo text', () => {
    expect(() => parseExtractionRequestBody({ sourceType: 'text', mode: 'summary' })).toThrowError(
      new ExtractionRequestError('Contenido de texto requerido.', 400)
    )
  })

  it('rechaza URLs inválidas de YouTube', () => {
    expect(() =>
      parseExtractionRequestBody({
        sourceType: 'youtube',
        url: 'https://youtube.com/watch?v=invalid',
        mode: 'summary',
      })
    ).toThrowError(
      new ExtractionRequestError(
        'URL de YouTube inválida. Usa el formato https://youtube.com/watch?v=...',
        400
      )
    )
  })

  it('carga provider y model antes de resolver la caché de video', async () => {
    const input = parseExtractionRequestBody({
      sourceType: 'youtube',
      url: 'https://youtube.com/watch?v=valid123',
      mode: 'summary',
    })

    const context = await loadExtractionRequestContext(input)

    expect(dbMocks.findVideoCacheByVideoId).toHaveBeenCalledWith({
      videoId: 'valid123',
      promptVersion: 'prompt-v1',
      model: 'gpt-4o-mini',
    })
    expect(context.extractionProvider).toBe('openai')
    expect(context.extractionModel).toBe('gpt-4o-mini')
  })

  it('usa un modelo válido por proveedor cuando la configuración guardada no coincide', async () => {
    dbMocks.getAppSetting.mockImplementation(async (key: string) => {
      if (key === 'extraction_provider') return 'openai'
      if (key === 'extraction_model') return 'claude-sonnet-test'
      return null
    })

    const input = parseExtractionRequestBody({
      sourceType: 'youtube',
      url: 'https://youtube.com/watch?v=valid123',
      mode: 'summary',
    })

    const context = await loadExtractionRequestContext(input)

    expect(context.extractionProvider).toBe('openai')
    expect(context.extractionModel).toBe('gpt-4o')
    expect(dbMocks.findVideoCacheByVideoId).toHaveBeenCalledWith({
      videoId: 'valid123',
      promptVersion: 'prompt-v1',
      model: 'gpt-4o',
    })
  })
})
