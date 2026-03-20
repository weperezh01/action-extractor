import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { type PendingAiUsageLogInput } from '@/lib/ai-usage-log'
import { AI_PRICING_VERSION, callAi, estimateCostUsd } from '@/lib/ai-client'
import { buildExtractionSystemPrompt, buildExtractionUserPrompt, estimateTime } from '@/lib/extract-core'
import { classifyModelError, retryWithBackoff } from '@/lib/extract-resilience'
import {
  buildCachedExtractionResult,
  createRateLimitResponse,
  ensureExtractionProviderConfigured,
  EXTRACTION_MAX_TOKENS,
  ExtractionRequestError,
  finalizeExtractionResult,
  loadExtractionRequestContext,
  parseExtractionRequestBody,
  parseExtractionWithRepair,
  resolveExtractionSourceContent,
} from '@/lib/extraction-server'
import { prepareContentForExtraction } from '@/lib/long-content-preparation'
import { resolveExtractionOutputLanguage } from '@/lib/output-language'
import { consumeUserExtractionRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    const isAdminUser = Boolean(user?.email && isAdminEmail(user.email))
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const input = parseExtractionRequestBody(body)
    const context = await loadExtractionRequestContext(input)

    if (context.cachedVideo) {
      const cachedResult = await buildCachedExtractionResult({
        userId: user.id,
        rawUrl: context.rawUrl,
        videoId: context.videoId!,
        mode: context.mode,
        outputLanguage: context.outputLanguage,
        sourceType: context.sourceType,
        bodySourceLabel: context.bodySourceLabel,
        cachedVideo: context.cachedVideo,
        promptVersion: context.promptVersion,
        extractionModel: context.extractionModel,
      })

      return NextResponse.json({
        ...cachedResult,
        hasSourceText: false,
      })
    }

    ensureExtractionProviderConfigured(context.extractionProvider)

    if (!isAdminUser) {
      const rateLimit = await consumeUserExtractionRateLimit(user.id)
      if (!rateLimit.allowed) {
        return createRateLimitResponse(rateLimit)
      }
    }

    const pendingExtractionId = randomUUID()
    const pendingAiUsageLogs: PendingAiUsageLogInput[] = []

    const resolvedContent = await resolveExtractionSourceContent({
      sourceType: context.sourceType,
      rawUrl: context.rawUrl,
      rawText: context.rawText,
      videoId: context.videoId,
      fallbackVideoCache: context.fallbackVideoCache,
      extractionProvider: context.extractionProvider,
      extractionModel: context.extractionModel,
      userId: user.id,
      onUsage: (usage) => {
        pendingAiUsageLogs.push(usage)
      },
    })

    let preparedContent
    try {
      preparedContent = await prepareContentForExtraction({
        text: resolvedContent.contentText,
        provider: context.extractionProvider,
        model: context.extractionModel,
        userId: user.id,
        sourceType: context.sourceType,
        onUsage: (usage) => {
          pendingAiUsageLogs.push(usage)
        },
      })
    } catch (error: unknown) {
      const modelError = classifyModelError(error)
      return NextResponse.json({ error: modelError.message }, { status: modelError.status })
    }
    const finalTranscript = preparedContent.finalText
    const wordCount = resolvedContent.contentText.split(/\s+/).length
    const { originalTime, savedTime } = estimateTime(wordCount)
    const resolvedOutputLanguage = resolveExtractionOutputLanguage(context.outputLanguage, finalTranscript)

    let modelText: string
    try {
      const aiResult = await retryWithBackoff(
        () =>
          callAi({
            provider: context.extractionProvider,
            model: context.extractionModel,
            system: buildExtractionSystemPrompt(context.mode, resolvedOutputLanguage, context.systemOverride),
            messages: [
              {
                role: 'user', content: buildExtractionUserPrompt(
                  finalTranscript,
                  context.mode,
                  resolvedOutputLanguage,
                  context.userOverride
                ),
              },
            ],
            maxTokens: EXTRACTION_MAX_TOKENS,
          }),
        {
          maxAttempts: 3,
          shouldRetry: (modelError) => classifyModelError(modelError).retryable,
        }
      )
      modelText = aiResult.text
      pendingAiUsageLogs.push({
        provider: context.extractionProvider,
        model: context.extractionModel,
        useType: 'extraction',
        userId: user.id,
        sourceType: context.sourceType,
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        costUsd: estimateCostUsd(context.extractionModel, aiResult.inputTokens, aiResult.outputTokens),
        pricingVersion: AI_PRICING_VERSION,
      })
    } catch (error: unknown) {
      const modelError = classifyModelError(error)
      return NextResponse.json({ error: modelError.message }, { status: modelError.status })
    }

    let responsePayload: Awaited<ReturnType<typeof parseExtractionWithRepair>>
    try {
      responsePayload = await parseExtractionWithRepair({
        modelText,
        provider: context.extractionProvider,
        model: context.extractionModel,
        originalTime,
        savedTime,
        mode: context.mode,
        resolvedOutputLanguage,
        userId: user.id,
        sourceType: context.sourceType,
        onUsage: (usage) => {
          pendingAiUsageLogs.push(usage)
        },
      })
    } catch (error: unknown) {
      const modelError = classifyModelError(error)
      return NextResponse.json({ error: modelError.message }, { status: modelError.status })
    }

    const result = await finalizeExtractionResult({
      userId: user.id,
      pendingExtractionId,
      pendingAiUsageLogs,
      responsePayload,
      rawUrl: context.rawUrl,
      videoId: context.videoId,
      mode: context.mode,
      outputLanguage: context.outputLanguage,
      resolvedOutputLanguage,
      sourceType: context.sourceType,
      bodySourceLabel: context.bodySourceLabel,
      bodySourceFileUrl: context.bodySourceFileUrl,
      bodySourceFileName: context.bodySourceFileName,
      bodySourceFileSizeBytes: context.bodySourceFileSizeBytes,
      bodySourceFileMimeType: context.bodySourceFileMimeType,
      contentText: resolvedContent.contentText,
      contentTitle: resolvedContent.contentTitle,
      transcriptSource: resolvedContent.transcriptSource,
      promptVersion: context.promptVersion,
      extractionModel: context.extractionModel,
      previewPromise: resolvedContent.previewPromise,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof ExtractionRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[ActionExtractor] extract error:', err)
    return NextResponse.json(
      {
        error:
          'No se pudo completar la extracción por un error interno. Intenta nuevamente en unos minutos.',
      },
      { status: 500 }
    )
  }
}
