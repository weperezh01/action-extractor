import { AI_PRICING_VERSION, callAi, estimateCostUsd, type AiProvider } from '@/lib/ai-client'
import { MAX_AI_CHARS, truncateForAi } from '@/lib/content-extractor'
import { classifyModelError, retryWithBackoff } from '@/lib/extract-resilience'

const CHUNK_TARGET_CHARS = 14_000
const CHUNK_OVERLAP_CHARS = 1_000
const CHUNK_BREAK_SEARCH_CHARS = 2_000
const CHUNK_SUMMARY_MAX_TOKENS = 1_400
const AGGREGATION_MAX_TOKENS = 2_200
const AGGREGATION_GROUP_MAX_CHARS = 38_000
const AGGREGATION_TARGET_CHARS = 32_000
const AGGREGATION_REPAIR_TARGET_CHARS = 24_000
const MAX_AGGREGATION_PASSES = 3

const CHUNK_SUMMARY_SYSTEM_PROMPT =
  'Eres un analista experto en condensar contenido largo. Conserva hechos, pasos, restricciones, métricas, citas y entidades. No inventes datos. No traduzcas el contenido. Devuelve solo JSON válido estricto.'

const CHUNK_SUMMARY_REPAIR_SYSTEM_PROMPT =
  'Eres un normalizador de JSON. Convierte el contenido recibido en JSON válido estricto. Devuelve solo JSON, sin markdown ni texto adicional.'

const AGGREGATION_SYSTEM_PROMPT =
  'Eres un sintetizador de documentos largos para una extracción posterior. Unifica resúmenes parciales en un contexto compacto, fiel y accionable. No inventes datos. No traduzcas el contenido. Devuelve solo texto plano.'

const CHUNK_BREAK_DELIMITERS = ['\n\n', '\n', '. ', '? ', '! ', '; '] as const

interface ChunkSummary {
  resumen: string
  ideasClave: string[]
  acciones: string[]
  metricas: string[]
  riesgos: string[]
  citas: string[]
  entidades: string[]
}

export interface LongContentPreparationProgress {
  step:
    | 'chunking'
    | 'chunk-summary-start'
    | 'chunk-summary-progress'
    | 'chunk-summary-complete'
    | 'aggregate-long-content'
    | 'aggregate-long-content-repair'
  message: string
  currentChunk?: number
  totalChunks?: number
  originalCharCount?: number
  preparedCharCount?: number
  aggregationPass?: number
  aggregationGroups?: number
}

export interface LongContentUsageEvent {
  provider: AiProvider
  model: string
  useType: string
  userId?: string | null
  sourceType?: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  pricingVersion: string
}

export interface PreparedExtractionContent {
  finalText: string
  originalCharCount: number
  preparedCharCount: number
  usedChunking: boolean
  chunkCount: number
  truncated: boolean
  preparationNotes: string[]
}

export interface PrepareContentForExtractionParams {
  text: string
  provider: AiProvider
  model: string
  userId?: string | null
  sourceType?: string | null
  onUsage?: (usage: LongContentUsageEvent) => Promise<void> | void
  onProgress?: (progress: LongContentPreparationProgress) => void
}

export function normalizePreparationText(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function findBreakNear(text: string, start: number, idealEnd: number, targetChars: number) {
  const minimumBreakpoint = start + Math.floor(targetChars * 0.6)
  const backwardFloor = Math.max(minimumBreakpoint, idealEnd - CHUNK_BREAK_SEARCH_CHARS)
  const forwardCeiling = Math.min(text.length, idealEnd + CHUNK_BREAK_SEARCH_CHARS)

  for (const delimiter of CHUNK_BREAK_DELIMITERS) {
    const backwardIndex = text.lastIndexOf(delimiter, idealEnd)
    if (backwardIndex >= backwardFloor) {
      return backwardIndex + delimiter.length
    }

    const forwardIndex = text.indexOf(delimiter, idealEnd)
    if (forwardIndex !== -1 && forwardIndex <= forwardCeiling) {
      return forwardIndex + delimiter.length
    }
  }

  return idealEnd
}

function advancePastWhitespace(text: string, index: number) {
  let nextIndex = index
  while (nextIndex < text.length && /\s/.test(text[nextIndex] ?? '')) {
    nextIndex += 1
  }
  return nextIndex
}

function splitTextByTarget(text: string, targetChars: number, overlapChars: number): string[] {
  const normalized = normalizePreparationText(text)
  if (!normalized) return []
  if (normalized.length <= targetChars) return [normalized]

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const remaining = normalized.length - start
    if (remaining <= targetChars) {
      const finalChunk = normalized.slice(start).trim()
      if (finalChunk) chunks.push(finalChunk)
      break
    }

    const idealEnd = Math.min(start + targetChars, normalized.length)
    const resolvedEnd = Math.max(findBreakNear(normalized, start, idealEnd, targetChars), start + 1)
    const chunk = normalized.slice(start, resolvedEnd).trim()
    if (chunk) chunks.push(chunk)

    if (resolvedEnd >= normalized.length) break

    const overlapStart = Math.max(resolvedEnd - overlapChars, start + 1)
    start = advancePastWhitespace(normalized, overlapStart)
  }

  return chunks
}

export function splitTextIntoPreparationChunks(text: string): string[] {
  return splitTextByTarget(text, CHUNK_TARGET_CHARS, CHUNK_OVERLAP_CHARS)
}

function buildChunkSummaryUserPrompt(chunk: string, index: number, totalChunks: number) {
  return `Resume el siguiente segmento de un documento largo para una extracción posterior.

Debes devolver JSON válido exacto con esta estructura:
{
  "resumen": "string",
  "ideasClave": ["string"],
  "acciones": ["string"],
  "metricas": ["string"],
  "riesgos": ["string"],
  "citas": ["string"],
  "entidades": ["string"]
}

Reglas:
- Conserva el idioma original del contenido.
- No traduzcas.
- No inventes.
- "resumen": máximo 120 palabras.
- "ideasClave": máximo 6 items, cada uno máximo 18 palabras.
- "acciones": máximo 6 items, cada uno máximo 18 palabras.
- "metricas": máximo 4 items, cada uno máximo 18 palabras.
- "riesgos": máximo 4 items, cada uno máximo 18 palabras.
- "citas": máximo 3 citas cortas y literales si existen.
- "entidades": máximo 8 nombres propios, conceptos o términos clave.
- Elimina duplicados y relleno.

SEGMENTO ${index}/${totalChunks}:
${chunk}`
}

function buildChunkSummaryRepairUserPrompt(rawText: string) {
  return `Convierte el siguiente contenido en JSON válido con esta estructura exacta:

{
  "resumen": "string",
  "ideasClave": ["string"],
  "acciones": ["string"],
  "metricas": ["string"],
  "riesgos": ["string"],
  "citas": ["string"],
  "entidades": ["string"]
}

Reglas:
- Mantén el contenido original lo más fiel posible.
- Si falta algún campo, completa con valor vacío razonable.
- Devuelve solo JSON.

CONTENIDO:
${rawText}`
}

function stripOuterCodeFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (!match) return trimmed
  return match[1].trim()
}

function extractJsonObject(text: string) {
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null
  return text.slice(firstBrace, lastBrace + 1).trim()
}

function toStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
}

function parseChunkSummaryModelText(text: string): ChunkSummary {
  const stripped = stripOuterCodeFence(text)
  const candidate = extractJsonObject(stripped) ?? stripped
  const parsed = JSON.parse(candidate) as Record<string, unknown>

  return {
    resumen: typeof parsed.resumen === 'string' ? parsed.resumen.trim() : '',
    ideasClave: toStringArray(parsed.ideasClave, 6),
    acciones: toStringArray(parsed.acciones, 6),
    metricas: toStringArray(parsed.metricas, 4),
    riesgos: toStringArray(parsed.riesgos, 4),
    citas: toStringArray(parsed.citas, 3),
    entidades: toStringArray(parsed.entidades, 8),
  }
}

function renderChunkSummaryText(summary: ChunkSummary, index: number) {
  const sections = [
    `Segmento ${index}`,
    summary.resumen ? `Resumen: ${summary.resumen}` : null,
    summary.ideasClave.length ? `Ideas clave:\n- ${summary.ideasClave.join('\n- ')}` : null,
    summary.acciones.length ? `Acciones y procesos:\n- ${summary.acciones.join('\n- ')}` : null,
    summary.metricas.length ? `Hechos y metricas:\n- ${summary.metricas.join('\n- ')}` : null,
    summary.riesgos.length ? `Riesgos y limites:\n- ${summary.riesgos.join('\n- ')}` : null,
    summary.citas.length ? `Citas:\n- ${summary.citas.join('\n- ')}` : null,
    summary.entidades.length ? `Entidades y terminos:\n- ${summary.entidades.join('\n- ')}` : null,
  ]

  return sections.filter(Boolean).join('\n')
}

function buildAggregationUserPrompt(params: {
  texts: string[]
  aggregationPass: number
  groupIndex: number
  totalGroups: number
  targetChars: number
}) {
  const { texts, aggregationPass, groupIndex, totalGroups, targetChars } = params

  return `Condensa los siguientes resúmenes parciales en un solo contexto compacto para una extracción final.

Reglas:
- Conserva el idioma original del contenido.
- No traduzcas.
- No inventes.
- Elimina duplicados.
- Prioriza información accionable y factual.
- Máximo aproximado: ${targetChars} caracteres.
- Devuelve solo texto plano.
- Usa estas secciones exactas:
RESUMEN GENERAL
ACCIONES Y PROCESOS
HECHOS Y METRICAS
RIESGOS Y LIMITES
CITAS Y DETALLES RELEVANTES
ENTIDADES Y TERMINOS CLAVE

PASADA ${aggregationPass}, GRUPO ${groupIndex}/${totalGroups}

RESUMENES DE SEGMENTOS:
${texts.join('\n\n==============================\n\n')}`
}

async function callModelWithUsage(params: {
  provider: AiProvider
  model: string
  system: string
  prompt: string
  maxTokens: number
  userId?: string | null
  sourceType?: string | null
  useType: string
  onUsage?: (usage: LongContentUsageEvent) => Promise<void> | void
}) {
  const result = await retryWithBackoff(
    () =>
      callAi({
        provider: params.provider,
        model: params.model,
        system: params.system,
        messages: [{ role: 'user', content: params.prompt }],
        maxTokens: params.maxTokens,
      }),
    {
      maxAttempts: 3,
      shouldRetry: (error) => classifyModelError(error).retryable,
    }
  )

  await params.onUsage?.({
    provider: params.provider,
    model: params.model,
    useType: params.useType,
    userId: params.userId ?? null,
    sourceType: params.sourceType ?? null,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: estimateCostUsd(params.model, result.inputTokens, result.outputTokens),
    pricingVersion: AI_PRICING_VERSION,
  })

  return result.text.trim()
}

async function summarizeChunk(params: {
  chunk: string
  index: number
  totalChunks: number
  provider: AiProvider
  model: string
  userId?: string | null
  sourceType?: string | null
  onUsage?: (usage: LongContentUsageEvent) => Promise<void> | void
}) {
  const rawSummary = await callModelWithUsage({
    provider: params.provider,
    model: params.model,
    system: CHUNK_SUMMARY_SYSTEM_PROMPT,
    prompt: buildChunkSummaryUserPrompt(params.chunk, params.index, params.totalChunks),
    maxTokens: CHUNK_SUMMARY_MAX_TOKENS,
    userId: params.userId,
    sourceType: params.sourceType,
    useType: 'extraction',
    onUsage: params.onUsage,
  })

  try {
    return parseChunkSummaryModelText(rawSummary)
  } catch {
    const repairedSummary = await callModelWithUsage({
      provider: params.provider,
      model: params.model,
      system: CHUNK_SUMMARY_REPAIR_SYSTEM_PROMPT,
      prompt: buildChunkSummaryRepairUserPrompt(rawSummary),
      maxTokens: CHUNK_SUMMARY_MAX_TOKENS,
      userId: params.userId,
      sourceType: params.sourceType,
      useType: 'repair',
      onUsage: params.onUsage,
    })

    return parseChunkSummaryModelText(repairedSummary)
  }
}

function packTextGroups(texts: string[], maxChars: number) {
  const groups: string[][] = []
  let currentGroup: string[] = []
  let currentLength = 0

  for (const text of texts) {
    const normalizedTexts =
      text.length > maxChars ? splitTextByTarget(text, Math.max(8_000, maxChars - 2_000), 0) : [text]

    for (const normalizedText of normalizedTexts) {
      const separatorLength = currentGroup.length === 0 ? 0 : 32
      const nextLength = currentLength + separatorLength + normalizedText.length

      if (currentGroup.length > 0 && nextLength > maxChars) {
        groups.push(currentGroup)
        currentGroup = [normalizedText]
        currentLength = normalizedText.length
        continue
      }

      currentGroup.push(normalizedText)
      currentLength = nextLength
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  return groups
}

async function aggregateTextGroup(params: {
  texts: string[]
  aggregationPass: number
  groupIndex: number
  totalGroups: number
  targetChars: number
  provider: AiProvider
  model: string
  userId?: string | null
  sourceType?: string | null
  onUsage?: (usage: LongContentUsageEvent) => Promise<void> | void
}) {
  return callModelWithUsage({
    provider: params.provider,
    model: params.model,
    system: AGGREGATION_SYSTEM_PROMPT,
    prompt: buildAggregationUserPrompt(params),
    maxTokens: AGGREGATION_MAX_TOKENS,
    userId: params.userId,
    sourceType: params.sourceType,
    useType: 'extraction',
    onUsage: params.onUsage,
  })
}

export async function prepareContentForExtraction(
  params: PrepareContentForExtractionParams
): Promise<PreparedExtractionContent> {
  const normalized = normalizePreparationText(params.text)
  if (!normalized) {
    return {
      finalText: '',
      originalCharCount: 0,
      preparedCharCount: 0,
      usedChunking: false,
      chunkCount: 0,
      truncated: false,
      preparationNotes: [],
    }
  }

  if (normalized.length <= MAX_AI_CHARS) {
    return {
      finalText: normalized,
      originalCharCount: normalized.length,
      preparedCharCount: normalized.length,
      usedChunking: false,
      chunkCount: 1,
      truncated: false,
      preparationNotes: [],
    }
  }

  const chunks = splitTextIntoPreparationChunks(normalized)
  params.onProgress?.({
    step: 'chunking',
    message: `Contenido largo detectado. Dividiendo el material en ${chunks.length} segmentos...`,
    totalChunks: chunks.length,
    originalCharCount: normalized.length,
  })
  params.onProgress?.({
    step: 'chunk-summary-start',
    message: `Resumiendo ${chunks.length} segmentos para incluir todo el contenido...`,
    totalChunks: chunks.length,
    originalCharCount: normalized.length,
  })

  const chunkDigests: string[] = []
  for (let index = 0; index < chunks.length; index += 1) {
    const summary = await summarizeChunk({
      chunk: chunks[index]!,
      index: index + 1,
      totalChunks: chunks.length,
      provider: params.provider,
      model: params.model,
      userId: params.userId,
      sourceType: params.sourceType,
      onUsage: params.onUsage,
    })

    chunkDigests.push(renderChunkSummaryText(summary, index + 1))
    params.onProgress?.({
      step: 'chunk-summary-progress',
      message: `Resumiendo segmento ${index + 1}/${chunks.length}...`,
      currentChunk: index + 1,
      totalChunks: chunks.length,
      originalCharCount: normalized.length,
    })
  }

  params.onProgress?.({
    step: 'chunk-summary-complete',
    message: `Se resumieron ${chunks.length} segmentos. Consolidando contenido...`,
    totalChunks: chunks.length,
    originalCharCount: normalized.length,
  })

  let currentTexts = chunkDigests
  let aggregationPass = 1
  const preparationNotes = [`chunk-count:${chunks.length}`]

  while (
    aggregationPass <= MAX_AGGREGATION_PASSES &&
    (currentTexts.length > 1 || (currentTexts[0]?.length ?? 0) > MAX_AI_CHARS)
  ) {
    const groups = packTextGroups(currentTexts, AGGREGATION_GROUP_MAX_CHARS)
    params.onProgress?.({
      step: 'aggregate-long-content',
      message:
        groups.length > 1
          ? `Consolidando resúmenes largos (${groups.length} grupos, pasada ${aggregationPass})...`
          : `Compactando síntesis larga (pasada ${aggregationPass})...`,
      totalChunks: chunks.length,
      originalCharCount: normalized.length,
      aggregationPass,
      aggregationGroups: groups.length,
    })

    const nextTexts: string[] = []
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const aggregated = await aggregateTextGroup({
        texts: groups[groupIndex]!,
        aggregationPass,
        groupIndex: groupIndex + 1,
        totalGroups: groups.length,
        targetChars: aggregationPass === 1 ? AGGREGATION_TARGET_CHARS : AGGREGATION_REPAIR_TARGET_CHARS,
        provider: params.provider,
        model: params.model,
        userId: params.userId,
        sourceType: params.sourceType,
        onUsage: params.onUsage,
      })
      nextTexts.push(aggregated)
    }

    preparationNotes.push(`aggregation-pass:${aggregationPass}`)
    currentTexts = nextTexts
    aggregationPass += 1
  }

  let preparedText = currentTexts.join('\n\n').trim()
  if (preparedText.length > MAX_AI_CHARS) {
    params.onProgress?.({
      step: 'aggregate-long-content-repair',
      message: 'La síntesis consolidada quedó demasiado larga. Compactando una vez más...',
      totalChunks: chunks.length,
      originalCharCount: normalized.length,
      aggregationPass,
    })

    const repairGroups = packTextGroups(currentTexts, AGGREGATION_GROUP_MAX_CHARS)
    const repairedTexts: string[] = []

    for (let groupIndex = 0; groupIndex < repairGroups.length; groupIndex += 1) {
      const repairedText = await aggregateTextGroup({
        texts: repairGroups[groupIndex]!,
        aggregationPass,
        groupIndex: groupIndex + 1,
        totalGroups: repairGroups.length,
        targetChars: AGGREGATION_REPAIR_TARGET_CHARS,
        provider: params.provider,
        model: params.model,
        userId: params.userId,
        sourceType: params.sourceType,
        onUsage: params.onUsage,
      })
      repairedTexts.push(repairedText)
    }

    preparedText = repairedTexts.join('\n\n').trim()

    preparationNotes.push('aggregation-repair')
  }

  const truncatedResult = truncateForAi(preparedText)
  if (truncatedResult.truncated) {
    preparationNotes.push('final-truncate-fallback')
  }

  return {
    finalText: truncatedResult.finalText,
    originalCharCount: normalized.length,
    preparedCharCount: truncatedResult.finalText.length,
    usedChunking: true,
    chunkCount: chunks.length,
    truncated: truncatedResult.truncated,
    preparationNotes,
  }
}
