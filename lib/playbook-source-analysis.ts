import { logAiUsageSafely } from '@/lib/ai-usage-log'
import {
  AI_PRICING_VERSION,
  callAi,
  estimateCostUsd,
  isProviderAvailable,
  resolveAiModel,
  resolveAiProvider,
  type AiProvider,
} from '@/lib/ai-client'
import { classifyModelError, retryWithBackoff } from '@/lib/extract-resilience'
import {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  estimateTime,
  EXTRACTION_MODEL as EXTRACTION_MODEL_DEFAULT,
  parseExtractionModelText,
} from '@/lib/extract-core'
import { normalizeExtractionMode, type ExtractionMode } from '@/lib/extraction-modes'
import {
  normalizeExtractionOutputLanguage,
  resolveExtractionOutputLanguage,
  type ExtractionOutputLanguage,
  type ResolvedExtractionOutputLanguage,
} from '@/lib/output-language'
import { getAppSetting, getPromptOverride } from '@/lib/db'
import { prepareContentForExtraction } from '@/lib/long-content-preparation'

const EXTRACTION_MAX_TOKENS = 4096
const JSON_REPAIR_MAX_TOKENS = 4096
const JSON_REPAIR_SYSTEM_PROMPT =
  'Eres un normalizador de JSON. Convierte contenido en JSON válido estricto. Devuelve solo JSON, sin markdown ni texto adicional.'

export interface CombinedPlaybookSource {
  id: string
  kind: 'primary' | 'additional'
  sourceType: string
  sourceLabel: string | null
  url: string | null
  sourceFileName: string | null
  text: string
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

async function parseExtractionWithRepair(params: {
  modelText: string
  provider: AiProvider
  model: string
  mode: ExtractionMode
  resolvedOutputLanguage: ResolvedExtractionOutputLanguage
  originalTime: string
  savedTime: string
  userId?: string | null
  sourceType?: string | null
}) {
  const {
    modelText,
    provider,
    model,
    mode,
    resolvedOutputLanguage,
    originalTime,
    savedTime,
    userId,
    sourceType,
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

        await logAiUsageSafely({
          provider,
          model,
          useType: 'repair',
          userId: userId ?? null,
          sourceType: sourceType ?? null,
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

    throw lastError instanceof Error ? lastError : new Error('No se pudo corregir el JSON.')
  }
}

export function buildCombinedPlaybookSourceText(sources: CombinedPlaybookSource[]) {
  return sources
    .map((source, index) => {
      const header = source.kind === 'primary' ? `Fuente principal ${index + 1}` : `Fuente adicional ${index + 1}`
      const metadata = [
        `Tipo: ${source.sourceType}`,
        source.sourceLabel?.trim() ? `Etiqueta: ${source.sourceLabel.trim()}` : null,
        source.url?.trim() ? `URL: ${source.url.trim()}` : null,
        source.sourceFileName?.trim() ? `Archivo: ${source.sourceFileName.trim()}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      return `${header}\n${metadata}\n\nContenido:\n${source.text.trim()}`
    })
    .join('\n\n==============================\n\n')
}

export async function generatePlaybookFromSourceText(input: {
  transcript: string
  mode: ExtractionMode
  requestedOutputLanguage?: ExtractionOutputLanguage
  userId?: string | null
  sourceType?: string | null
}) {
  const transcript = input.transcript.trim()
  if (!transcript) {
    throw new Error('El contenido combinado está vacío.')
  }

  const requestedOutputLanguage = normalizeExtractionOutputLanguage(input.requestedOutputLanguage)
  const mode = normalizeExtractionMode(input.mode)
  const [dbExtractionProvider, dbExtractionModel, systemOverride, userOverride] = await Promise.all([
    getAppSetting('extraction_provider').catch(() => null),
    getAppSetting('extraction_model').catch(() => null),
    getPromptOverride(`extraction:${mode}:system`).catch(() => null),
    getPromptOverride(`extraction:${mode}:user`).catch(() => null),
  ])

  const provider = resolveAiProvider(dbExtractionProvider, 'anthropic')
  const model = resolveAiModel(
    provider,
    typeof dbExtractionModel === 'string' ? dbExtractionModel : null,
    EXTRACTION_MODEL_DEFAULT
  )

  if (!isProviderAvailable(provider)) {
    const error = new Error('Servicio de IA no configurado. Falta la API key del proveedor seleccionado.')
    ;(error as Error & { status?: number }).status = 503
    throw error
  }

  let preparedContent
  try {
    preparedContent = await prepareContentForExtraction({
      text: transcript,
      provider,
      model,
      userId: input.userId ?? null,
      sourceType: input.sourceType ?? 'multi_source',
      onUsage: (usage) => logAiUsageSafely(usage),
    })
  } catch (error: unknown) {
    const modelError = classifyModelError(error)
    const wrappedError = new Error(modelError.message)
    ;(wrappedError as Error & { status?: number }).status = modelError.status
    throw wrappedError
  }
  const finalTranscript = preparedContent.finalText
  const wordCount = transcript.split(/\s+/).filter(Boolean).length
  const { originalTime, savedTime } = estimateTime(wordCount)
  const resolvedOutputLanguage = resolveExtractionOutputLanguage(requestedOutputLanguage, finalTranscript)

  const aiResult = await retryWithBackoff(
    () =>
      callAi({
        provider,
        model,
        system: buildExtractionSystemPrompt(mode, resolvedOutputLanguage, systemOverride),
        messages: [
          {
            role: 'user',
            content: buildExtractionUserPrompt(finalTranscript, mode, resolvedOutputLanguage, userOverride),
          },
        ],
        maxTokens: EXTRACTION_MAX_TOKENS,
      }),
    {
      maxAttempts: 3,
      shouldRetry: (modelError) => classifyModelError(modelError).retryable,
    }
  )

  await logAiUsageSafely({
    provider,
    model,
    useType: 'extraction',
    userId: input.userId ?? null,
    sourceType: input.sourceType ?? 'multi_source',
    inputTokens: aiResult.inputTokens,
    outputTokens: aiResult.outputTokens,
    costUsd: estimateCostUsd(model, aiResult.inputTokens, aiResult.outputTokens),
    pricingVersion: AI_PRICING_VERSION,
  })

  const parsed = await parseExtractionWithRepair({
    modelText: aiResult.text,
    provider,
    model,
    mode,
    resolvedOutputLanguage,
    originalTime,
    savedTime,
    userId: input.userId ?? null,
    sourceType: input.sourceType ?? 'multi_source',
  })

  return {
    ...parsed,
    outputLanguageRequested: requestedOutputLanguage,
    outputLanguageResolved: resolvedOutputLanguage,
    combinedText: transcript,
  }
}
