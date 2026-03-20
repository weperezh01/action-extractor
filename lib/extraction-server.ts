import { NextResponse } from 'next/server'
import { persistAiUsageLogsInBackground, type PendingAiUsageLogInput } from '@/lib/ai-usage-log'
import {
  AI_PRICING_VERSION,
  callAi,
  estimateCostUsd,
  isProviderAvailable,
  resolveAiModel,
  resolveAiProvider,
  type AiProvider,
} from '@/lib/ai-client'
import {
  EXTRACTION_MODEL as EXTRACTION_MODEL_DEFAULT,
  extractVideoId,
  getExtractionPromptVersion,
  parseExtractionModelText,
} from '@/lib/extract-core'
import { classifyModelError, classifyTranscriptError, retryWithBackoff } from '@/lib/extract-resilience'
import { normalizeExtractionMode } from '@/lib/extraction-modes'
import {
  getAppSetting,
  getPromptOverride,
  type DbVideoCache,
} from '@/lib/db'
import {
  createExtraction,
  findAnyVideoCacheByVideoId,
  findExtractionOrderNumberForUser,
  findVideoCacheByVideoId,
  upsertVideoCache,
} from '@/lib/db/extractions'
import {
  normalizeExtractionOutputLanguage,
  type ResolvedExtractionOutputLanguage,
} from '@/lib/output-language'
import { flattenItemsAsText, normalizePlaybookPhases } from '@/lib/playbook-tree'
import { buildExtractionRateLimitMessage, type UserExtractionRateLimitResult } from '@/lib/rate-limit'
import { detectSourceType } from '@/lib/source-detector'
import { resolveVideoPreview } from '@/lib/video-preview'
import { extractWebContent } from '@/lib/content-extractor'
import { resolveYoutubeTranscriptWithFallback } from '@/lib/youtube-transcript-fallback'

export const EXTRACTION_MAX_TOKENS = 4096
const JSON_REPAIR_MAX_TOKENS = 4096
const JSON_REPAIR_SYSTEM_PROMPT =
  'Eres un normalizador de JSON. Convierte contenido en JSON válido estricto. Devuelve solo JSON, sin markdown ni texto adicional.'

const EXTRACTION_SOURCE_TYPES = new Set(['youtube', 'web_url', 'pdf', 'docx', 'text'])

export type ExtractionMode = ReturnType<typeof normalizeExtractionMode>
export type ExtractionOutputLanguage = ReturnType<typeof normalizeExtractionOutputLanguage>
export type ExtractionSourceType = 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text'
export type ExtractionTranscriptSource =
  | 'cache_exact'
  | 'cache_transcript'
  | 'cache_result'
  | 'custom_extractor'
  | 'youtube_transcript'
  | 'yt_dlp_subtitles'
  | 'openai_audio_transcription'
  | 'youtube_official_api'
  | 'web'
  | 'file'
  | 'text'

export interface ParsedExtractionRequest {
  rawUrl: string
  rawText: string
  bodySourceLabel: string | null
  bodySourceFileUrl: string | null
  bodySourceFileName: string | null
  bodySourceFileSizeBytes: number | null
  bodySourceFileMimeType: string | null
  mode: ExtractionMode
  outputLanguage: ExtractionOutputLanguage
  promptVersion: string
  sourceType: ExtractionSourceType
  videoId: string | null
}

export interface LoadedExtractionRequestContext extends ParsedExtractionRequest {
  extractionProvider: AiProvider
  extractionModel: string
  systemOverride: string | null
  userOverride: string | null
  cachedVideo: DbVideoCache | null
  fallbackVideoCache: DbVideoCache | null
}

export interface ExtractionPreview {
  videoTitle: string | null
  thumbnailUrl: string | null
}

export interface ResolvedExtractionContent {
  contentText: string
  contentTitle: string | null
  transcriptSource: ExtractionTranscriptSource
  previewPromise: Promise<ExtractionPreview> | null
}

export class ExtractionRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ExtractionRequestError'
    this.status = status
  }
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function buildTranscriptFallbackFromCachedExtraction(cachedVideo: {
  objective: string
  phases_json: string
  pro_tip: string
}) {
  const phases = normalizePlaybookPhases(safeParse<unknown>(cachedVideo.phases_json, []))
  const phaseLines = phases
    .map((phase, index) => {
      const title = typeof phase.title === 'string' && phase.title.trim() ? phase.title.trim() : `Fase ${index + 1}`
      const items = flattenItemsAsText(phase.items).slice(0, 5)
      if (items.length === 0) {
        return `- ${title}`
      }
      return [`- ${title}`, ...items.map((item) => `  - ${item}`)].join('\n')
    })
    .join('\n')

  return [
    'Resumen previo del mismo video:',
    `Objetivo: ${cachedVideo.objective}`,
    phaseLines,
    `Consejo Pro: ${cachedVideo.pro_tip}`,
  ]
    .filter((line) => line.trim().length > 0)
    .join('\n')
}

function buildJsonRepairUserPrompt(rawText: string) {
  return `Convierte el siguiente contenido en JSON VÁLIDO con esta estructura exacta:

{
  "objective": "string",
  "phases": [
    {
      "id": 1,
      "title": "string",
      "items": ["string"]
    }
  ],
  "proTip": "string",
  "metadata": {
    "difficulty": "string",
    "readingTime": "string"
  }
}

Reglas:
- Mantén el contenido original lo más fiel posible.
- Si falta algún campo, completa con valor vacío razonable ("" o []).
- No agregues markdown.
- No uses comentarios.

CONTENIDO A NORMALIZAR:
${rawText}`
}

function buildCompactJsonRepairUserPrompt(rawText: string, modeLabel: string) {
  return `Convierte el siguiente contenido en JSON VÁLIDO y COMPACTO para el modo "${modeLabel}" con esta estructura exacta:

{
  "objective": "string",
  "phases": [
    {
      "id": 1,
      "title": "string",
      "items": ["string"]
    }
  ],
  "proTip": "string",
  "metadata": {
    "difficulty": "string",
    "readingTime": "string"
  }
}

Reglas de compresión:
- Máximo 4 fases.
- Máximo 4 items por fase.
- Cada item con máximo 20 palabras.
- objective en máximo 2 líneas.
- proTip en máximo 1 línea.
- Mantén la esencia del contenido y elimina relleno.
- Si falta algún campo, completa con valor vacío razonable ("" o []).
- Devuelve solo JSON, sin markdown.

CONTENIDO A NORMALIZAR:
${rawText}`
}

function normalizeExplicitSourceType(value: unknown): ExtractionSourceType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return EXTRACTION_SOURCE_TYPES.has(normalized) ? (normalized as ExtractionSourceType) : null
}

export function createRateLimitResponse(rateLimit: UserExtractionRateLimitResult) {
  return NextResponse.json(
    {
      error: buildExtractionRateLimitMessage(rateLimit.limit),
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(rateLimit.retryAfterSeconds),
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-RateLimit-Reset': rateLimit.resetAt,
      },
    }
  )
}

export function parseExtractionRequestBody(body: unknown): ParsedExtractionRequest {
  const rawUrl = typeof (body as { url?: unknown })?.url === 'string' ? (body as { url: string }).url.trim() : ''
  const rawText = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : ''
  const bodySourceLabel =
    typeof (body as { sourceLabel?: unknown })?.sourceLabel === 'string'
      ? (body as { sourceLabel: string }).sourceLabel
      : null
  const bodySourceFileUrl = (() => {
    const value = (body as { sourceFileUrl?: unknown })?.sourceFileUrl
    return typeof value === 'string' && (value.startsWith('https://') || value.startsWith('/api/uploads/'))
      ? value
      : null
  })()
  const bodySourceFileName = (() => {
    const value = (body as { sourceFileName?: unknown })?.sourceFileName
    return typeof value === 'string' ? value.slice(0, 500) : null
  })()
  const bodySourceFileSizeBytes = (() => {
    const value = (body as { sourceFileSizeBytes?: unknown })?.sourceFileSizeBytes
    return typeof value === 'number' && value > 0 ? value : null
  })()
  const bodySourceFileMimeType = (() => {
    const value = (body as { sourceFileMimeType?: unknown })?.sourceFileMimeType
    return typeof value === 'string' ? value.slice(0, 200) : null
  })()

  const mode = normalizeExtractionMode((body as { mode?: unknown })?.mode)
  const outputLanguage = normalizeExtractionOutputLanguage((body as { outputLanguage?: unknown })?.outputLanguage)
  const promptVersion = getExtractionPromptVersion(mode, outputLanguage)

  const explicitSourceType = normalizeExplicitSourceType((body as { sourceType?: unknown })?.sourceType)
  const detectedSourceType = detectSourceType(rawUrl || rawText)
  const sourceType = explicitSourceType ?? detectedSourceType

  if ((sourceType === 'youtube' || sourceType === 'web_url') && !rawUrl) {
    throw new ExtractionRequestError('URL requerida.', 400)
  }

  if ((sourceType === 'pdf' || sourceType === 'docx' || sourceType === 'text') && !rawText) {
    throw new ExtractionRequestError('Contenido de texto requerido.', 400)
  }

  const videoId = sourceType === 'youtube' ? extractVideoId(rawUrl) : null
  if (sourceType === 'youtube' && !videoId) {
    throw new ExtractionRequestError(
      'URL de YouTube inválida. Usa el formato https://youtube.com/watch?v=...',
      400
    )
  }

  return {
    rawUrl,
    rawText,
    bodySourceLabel,
    bodySourceFileUrl,
    bodySourceFileName,
    bodySourceFileSizeBytes,
    bodySourceFileMimeType,
    mode,
    outputLanguage,
    promptVersion,
    sourceType,
    videoId,
  }
}

export async function loadExtractionRequestContext(
  input: ParsedExtractionRequest
): Promise<LoadedExtractionRequestContext> {
  const [dbExtractionProvider, dbExtractionModel, systemOverride, userOverride] = await Promise.all([
    getAppSetting('extraction_provider').catch(() => null),
    getAppSetting('extraction_model').catch(() => null),
    getPromptOverride(`extraction:${input.mode}:system`).catch(() => null),
    getPromptOverride(`extraction:${input.mode}:user`).catch(() => null),
  ])

  const extractionProvider = resolveAiProvider(dbExtractionProvider, 'anthropic')
  const extractionModel = resolveAiModel(
    extractionProvider,
    typeof dbExtractionModel === 'string' ? dbExtractionModel : null,
    EXTRACTION_MODEL_DEFAULT
  )
  const cachedVideo =
    input.sourceType === 'youtube' && input.videoId
      ? await findVideoCacheByVideoId({
          videoId: input.videoId,
          promptVersion: input.promptVersion,
          model: extractionModel,
        })
      : null
  const fallbackVideoCache =
    input.sourceType === 'youtube' && input.videoId
      ? cachedVideo ?? (await findAnyVideoCacheByVideoId(input.videoId))
      : null

  return {
    ...input,
    extractionProvider,
    extractionModel,
    systemOverride,
    userOverride,
    cachedVideo,
    fallbackVideoCache,
  }
}

export function ensureExtractionProviderConfigured(provider: AiProvider) {
  if (!isProviderAvailable(provider)) {
    throw new ExtractionRequestError(
      'Servicio de IA no configurado. Falta la API key del proveedor seleccionado.',
      503
    )
  }
}

export async function parseExtractionWithRepair(params: {
  modelText: string
  provider: AiProvider
  model: string
  mode: ExtractionMode
  resolvedOutputLanguage: ResolvedExtractionOutputLanguage
  originalTime: string
  savedTime: string
  onRepair?: () => void
  userId?: string | null
  sourceType?: string | null
  onUsage?: (usage: PendingAiUsageLogInput) => Promise<void> | void
}) {
  const {
    modelText,
    provider,
    model,
    mode,
    resolvedOutputLanguage,
    originalTime,
    savedTime,
    onRepair,
    userId,
    sourceType,
    onUsage,
  } = params

  const parseWithTime = (text: string) =>
    parseExtractionModelText(
      text,
      {
        originalTime,
        savedTime,
      },
      mode,
      resolvedOutputLanguage
    )

  try {
    return parseWithTime(modelText)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('JSON inválido')) {
      throw error
    }

    onRepair?.()

    const repairPrompts = [
      buildJsonRepairUserPrompt(modelText),
      buildCompactJsonRepairUserPrompt(modelText, mode),
    ]

    let lastError: unknown = error
    for (const repairPrompt of repairPrompts) {
      try {
        const repairResult = await retryWithBackoff(
          () =>
            callAi({
              provider,
              model,
              system: JSON_REPAIR_SYSTEM_PROMPT,
              messages: [{ role: 'user', content: repairPrompt }],
              maxTokens: JSON_REPAIR_MAX_TOKENS,
            }),
          {
            maxAttempts: 2,
            shouldRetry: (repairError) => classifyModelError(repairError).retryable,
          }
        )

        if (!repairResult.text.trim()) {
          lastError = new Error('No se pudo normalizar la respuesta del modelo.')
          continue
        }

        await onUsage?.({
          provider,
          model,
          useType: 'repair',
          userId,
          sourceType,
          inputTokens: repairResult.inputTokens,
          outputTokens: repairResult.outputTokens,
          costUsd: estimateCostUsd(model, repairResult.inputTokens, repairResult.outputTokens),
          pricingVersion: AI_PRICING_VERSION,
        })

        return parseWithTime(repairResult.text)
      } catch (repairError: unknown) {
        lastError = repairError
      }
    }

    if (lastError instanceof Error) {
      throw lastError
    }

    throw new Error('El modelo devolvió JSON inválido. Intenta de nuevo.')
  }
}

export type ParsedExtractionPayload = Awaited<ReturnType<typeof parseExtractionWithRepair>>

export async function buildCachedExtractionResult(params: {
  userId?: string | null
  rawUrl: string
  videoId: string
  mode: ExtractionMode
  outputLanguage: ExtractionOutputLanguage
  sourceType: ExtractionSourceType
  bodySourceLabel: string | null
  cachedVideo: DbVideoCache
  promptVersion: string
  extractionModel: string
}) {
  const {
    userId,
    rawUrl,
    videoId,
    mode,
    outputLanguage,
    sourceType,
    bodySourceLabel,
    cachedVideo,
    promptVersion,
    extractionModel,
  } = params

  const cachedMetadata = safeParse(cachedVideo.metadata_json, {
    readingTime: '3 min',
    difficulty: 'Media',
    originalTime: '0m',
    savedTime: '0m',
  })

  const responsePayload = {
    mode,
    objective: cachedVideo.objective,
    phases: safeParse(cachedVideo.phases_json, []),
    proTip: cachedVideo.pro_tip,
    metadata: {
      readingTime:
        typeof cachedMetadata.readingTime === 'string' ? cachedMetadata.readingTime : '3 min',
      difficulty:
        typeof cachedMetadata.difficulty === 'string' ? cachedMetadata.difficulty : 'Media',
      originalTime:
        typeof cachedMetadata.originalTime === 'string' ? cachedMetadata.originalTime : '0m',
      savedTime: typeof cachedMetadata.savedTime === 'string' ? cachedMetadata.savedTime : '0m',
    },
  }

  const videoPreview = await resolveVideoPreview({
    videoId,
    titleHint: cachedVideo.video_title,
    thumbnailHint: cachedVideo.thumbnail_url,
  })

  if (!cachedVideo.video_title || !cachedVideo.thumbnail_url) {
    await upsertVideoCache({
      videoId,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      objective: responsePayload.objective,
      phasesJson: JSON.stringify(responsePayload.phases),
      proTip: responsePayload.proTip,
      metadataJson: JSON.stringify(responsePayload.metadata),
      transcriptText: cachedVideo.transcript_text,
      promptVersion,
      model: extractionModel,
    })
  }

  if (userId) {
    const saved = await createExtraction({
      userId,
      url: rawUrl || null,
      videoId,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      extractionMode: mode,
      objective: responsePayload.objective,
      phasesJson: JSON.stringify(responsePayload.phases),
      proTip: responsePayload.proTip,
      metadataJson: JSON.stringify(responsePayload.metadata),
      sourceType,
      sourceLabel: videoPreview.videoTitle ?? bodySourceLabel,
      transcriptSource: 'cache_exact',
    })
    const orderNumber = await findExtractionOrderNumberForUser({ id: saved.id, userId })

    return {
      ...responsePayload,
      url: rawUrl || null,
      videoId,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      outputLanguageRequested: outputLanguage,
      outputLanguageResolved: outputLanguage === 'auto' ? null : outputLanguage,
      id: saved.id,
      orderNumber: orderNumber ?? undefined,
      shareVisibility: saved.share_visibility,
      clonePermission: saved.clone_permission,
      createdAt: saved.created_at,
      cached: true,
      sourceType,
      transcriptSource: 'cache_exact' as const,
      sourceLabel: saved.source_label,
      folderId: saved.folder_id,
    }
  }

  return {
    ...responsePayload,
    url: rawUrl || null,
    videoId,
    videoTitle: videoPreview.videoTitle,
    thumbnailUrl: videoPreview.thumbnailUrl,
    outputLanguageRequested: outputLanguage,
    outputLanguageResolved: outputLanguage === 'auto' ? null : outputLanguage,
    cached: true,
    sourceType,
    transcriptSource: 'cache_exact' as const,
    sourceLabel: videoPreview.videoTitle ?? bodySourceLabel,
  }
}

export async function resolveExtractionSourceContent(params: {
  sourceType: ExtractionSourceType
  rawUrl: string
  rawText: string
  videoId: string | null
  fallbackVideoCache: DbVideoCache | null
  extractionProvider: AiProvider
  extractionModel: string
  userId?: string | null
  onUsage: (usage: PendingAiUsageLogInput) => void
  onStatus?: (update: { step: string; message: string }) => void
}) {
  const {
    sourceType,
    rawUrl,
    rawText,
    videoId,
    fallbackVideoCache,
    extractionProvider,
    extractionModel,
    userId,
    onUsage,
    onStatus,
  } = params

  let contentText = ''
  let contentTitle: string | null = null
  const previewPromise = sourceType === 'youtube' && videoId ? resolveVideoPreview({ videoId }) : null
  let transcriptSource: ExtractionTranscriptSource = 'youtube_transcript'

  if (sourceType === 'youtube') {
    onStatus?.({
      step: 'transcript',
      message: 'Obteniendo transcripción de YouTube...',
    })

    let transcriptText = fallbackVideoCache?.transcript_text?.trim() ?? ''
    transcriptSource = transcriptText ? 'cache_transcript' : 'youtube_transcript'
    const transcriptFallbackFromCache = fallbackVideoCache
      ? buildTranscriptFallbackFromCachedExtraction(fallbackVideoCache)
      : ''

    if (transcriptText) {
      onStatus?.({
        step: 'transcript-cache',
        message: 'Usando transcripción en caché del video...',
      })
    } else {
      try {
        const transcriptResolution = await retryWithBackoff(
          () =>
            resolveYoutubeTranscriptWithFallback(videoId!, {
              onStatus,
            }),
          {
            maxAttempts: 3,
            shouldRetry: (transcriptError) => classifyTranscriptError(transcriptError).retryable,
            onRetry: ({ nextAttempt, maxAttempts, delayMs }) =>
              onStatus?.({
                step: 'transcript-retry',
                message: `Fallo al obtener la transcripción. Reintentando (${nextAttempt}/${maxAttempts}) en ${Math.ceil(
                  delayMs / 1000
                )}s...`,
              }),
          }
        )

        if (!transcriptResolution.segments.length) {
          if (transcriptFallbackFromCache) {
            transcriptText = transcriptFallbackFromCache
            transcriptSource = 'cache_result'
            onStatus?.({
              step: 'transcript-fallback',
              message:
                'No se pudieron leer subtítulos en este momento. Usando una extracción previa del mismo video como respaldo.',
            })
          } else {
            throw new ExtractionRequestError(
              'No se encontró transcripción utilizable para este video. Prueba con otro enlace.',
              422
            )
          }
        } else {
          transcriptText = transcriptResolution.segments.map((segment) => segment.text).join(' ')
          transcriptSource = transcriptResolution.source
          for (const usageEvent of transcriptResolution.usageEvents) {
            onUsage({
              provider: usageEvent.provider,
              model: usageEvent.model,
              useType: usageEvent.useType,
              userId: userId ?? null,
              sourceType,
              inputTokens: 0,
              outputTokens: 0,
              costUsd: usageEvent.costUsd,
              pricingVersion: usageEvent.pricingVersion,
            })
          }
        }
      } catch (error: unknown) {
        if (transcriptFallbackFromCache) {
          transcriptText = transcriptFallbackFromCache
          transcriptSource = 'cache_result'
          onStatus?.({
            step: 'transcript-fallback',
            message:
              'No se pudieron leer subtítulos en este momento. Usando una extracción previa del mismo video como respaldo.',
          })
        } else if (error instanceof ExtractionRequestError) {
          throw error
        } else {
          const transcriptError = classifyTranscriptError(error)
          throw new ExtractionRequestError(transcriptError.message, transcriptError.status)
        }
      }
    }

    contentText = transcriptText
  } else if (sourceType === 'web_url') {
    onStatus?.({
      step: 'fetch',
      message: 'Descargando contenido de la página web...',
    })
    try {
      const webContent = await extractWebContent(rawUrl)
      contentText = webContent.text
      contentTitle = webContent.title
      transcriptSource = 'web'
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No se pudo descargar la página.'
      throw new ExtractionRequestError(message, 422)
    }
  } else if (sourceType === 'text') {
    onStatus?.({ step: 'text', message: 'Preparando texto para análisis...' })
    contentText = rawText
    transcriptSource = 'text'
  } else {
    onStatus?.({ step: 'file', message: sourceType === 'pdf' ? 'Analizando documento PDF...' : 'Analizando documento Word...' })
    contentText = rawText
    transcriptSource = 'file'
  }

  if (!contentText.trim()) {
    throw new ExtractionRequestError('El contenido está vacío. Prueba con otra fuente.', 422)
  }

  return {
    contentText,
    contentTitle,
    transcriptSource,
    previewPromise,
  } satisfies ResolvedExtractionContent
}

export async function finalizeExtractionResult(params: {
  userId?: string | null
  pendingExtractionId?: string | null
  pendingAiUsageLogs: PendingAiUsageLogInput[]
  responsePayload: ParsedExtractionPayload
  rawUrl: string
  videoId: string | null
  mode: ExtractionMode
  outputLanguage: ExtractionOutputLanguage
  resolvedOutputLanguage: ResolvedExtractionOutputLanguage
  sourceType: ExtractionSourceType
  bodySourceLabel: string | null
  bodySourceFileUrl: string | null
  bodySourceFileName: string | null
  bodySourceFileSizeBytes: number | null
  bodySourceFileMimeType: string | null
  contentText: string
  contentTitle: string | null
  transcriptSource: ExtractionTranscriptSource
  promptVersion: string
  extractionModel: string
  previewPromise: Promise<ExtractionPreview> | null
}) {
  const {
    userId,
    pendingExtractionId,
    pendingAiUsageLogs,
    responsePayload,
    rawUrl,
    videoId,
    mode,
    outputLanguage,
    resolvedOutputLanguage,
    sourceType,
    bodySourceLabel,
    bodySourceFileUrl,
    bodySourceFileName,
    bodySourceFileSizeBytes,
    bodySourceFileMimeType,
    contentText,
    contentTitle,
    transcriptSource,
    promptVersion,
    extractionModel,
    previewPromise,
  } = params

  const videoPreview = previewPromise ? await previewPromise : { videoTitle: null, thumbnailUrl: null }

  if (sourceType === 'youtube' && videoId) {
    await upsertVideoCache({
      videoId,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      objective: responsePayload.objective,
      phasesJson: JSON.stringify(responsePayload.phases),
      proTip: responsePayload.proTip,
      metadataJson: JSON.stringify(responsePayload.metadata),
      transcriptText: transcriptSource === 'cache_result' ? null : contentText,
      promptVersion,
      model: extractionModel,
    })
  }

  const resolvedSourceLabel =
    sourceType === 'youtube'
      ? (videoPreview.videoTitle ?? bodySourceLabel)
      : (contentTitle ?? bodySourceLabel)
  const sourceTextToStore = sourceType !== 'youtube' ? contentText || null : null

  if (userId) {
    const saved = await createExtraction({
      id: pendingExtractionId ?? undefined,
      userId,
      url: rawUrl || null,
      videoId: videoId ?? null,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      extractionMode: mode,
      objective: responsePayload.objective,
      phasesJson: JSON.stringify(responsePayload.phases),
      proTip: responsePayload.proTip,
      metadataJson: JSON.stringify(responsePayload.metadata),
      sourceType,
      sourceLabel: resolvedSourceLabel,
      sourceText: sourceTextToStore,
      sourceFileUrl: bodySourceFileUrl,
      sourceFileName: bodySourceFileName,
      sourceFileSizeBytes: bodySourceFileSizeBytes,
      sourceFileMimeType: bodySourceFileMimeType,
      transcriptSource,
    })

    persistAiUsageLogsInBackground(pendingAiUsageLogs, saved.id)
    const orderNumber = await findExtractionOrderNumberForUser({ id: saved.id, userId })

    return {
      ...responsePayload,
      url: rawUrl || null,
      videoId: videoId ?? null,
      videoTitle: videoPreview.videoTitle,
      thumbnailUrl: videoPreview.thumbnailUrl,
      outputLanguageRequested: outputLanguage,
      outputLanguageResolved: resolvedOutputLanguage,
      id: saved.id,
      orderNumber: orderNumber ?? undefined,
      shareVisibility: saved.share_visibility,
      clonePermission: saved.clone_permission,
      createdAt: saved.created_at,
      cached: false,
      sourceType,
      transcriptSource: saved.transcript_source,
      sourceLabel: saved.source_label,
      folderId: saved.folder_id,
      sourceFileUrl: saved.source_file_url,
      sourceFileName: saved.source_file_name,
      sourceFileSizeBytes: saved.source_file_size_bytes,
      sourceFileMimeType: saved.source_file_mime_type,
      hasSourceText: !!sourceTextToStore,
    }
  }

  persistAiUsageLogsInBackground(pendingAiUsageLogs, null)

  return {
    ...responsePayload,
    url: rawUrl || null,
    videoId: videoId ?? null,
    videoTitle: videoPreview.videoTitle,
    thumbnailUrl: videoPreview.thumbnailUrl,
    outputLanguageRequested: outputLanguage,
    outputLanguageResolved: resolvedOutputLanguage,
    cached: false,
    sourceType,
    transcriptSource,
    sourceLabel: resolvedSourceLabel,
  }
}
