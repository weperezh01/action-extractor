import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { flattenItemsAsText, normalizePlaybookPhases } from '@/lib/playbook-tree'
import {
  createChatMessageForUser,
  findExtractionByIdForUser,
  getAppSetting,
  listChatMessagesForUser,
  listExtractionsByUser,
  listExtractionTasksWithEventsForUser,
  logAiUsage,
} from '@/lib/db'
import { type AiProvider, callAi, estimateCostUsd, isProviderAvailable } from '@/lib/ai-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHAT_MODEL_DEFAULT =
  process.env.ACTION_EXTRACTOR_CHAT_MODEL?.trim() || 'claude-haiku-4-5-20251001'
const MAX_QUESTION_LENGTH = 2000
const MAX_CONVERSATION_MESSAGES = 12
const MAX_CONVERSATION_MESSAGE_LENGTH = 1200
const MAX_CONTEXT_EXTRACTIONS = 25
const MAX_CONTEXT_CHARS = 48_000
const MAX_PHASES_PER_EXTRACTION = 5
const MAX_ITEMS_PER_PHASE = 5
const MAX_TASKS_FOR_ACTIVE = 40
const MAX_EVENTS_PER_TASK = 3
const CHAT_MAX_TOKENS = 1024

interface ChatResponsePayload {
  answer: string
  usedExtractionIds: string[]
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function normalizeQuestion(raw: unknown) {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, MAX_QUESTION_LENGTH)
}

function safeParsePhases(value: string) {
  try {
    return normalizePlaybookPhases(JSON.parse(value) as unknown)
  } catch {
    return []
  }
}

function toIsoDateTime(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toISOString()
}

function buildExtractionSummaryBlock(
  extraction: Awaited<ReturnType<typeof listExtractionsByUser>>[number]
) {
  const phases = safeParsePhases(extraction.phases_json)
  const phaseLines = phases
    .slice(0, MAX_PHASES_PER_EXTRACTION)
    .map((phase, phaseIndex) => {
      const title =
        typeof phase?.title === 'string' && phase.title.trim().length > 0
          ? phase.title.trim()
          : `Fase ${phaseIndex + 1}`

      const itemLines = flattenItemsAsText(Array.isArray(phase?.items) ? phase.items : [])
        .slice(0, MAX_ITEMS_PER_PHASE)
        .map((item) => `  - ${truncateText(item, 180)}`)

      if (itemLines.length === 0) {
        return `- ${title}`
      }

      return [`- ${title}`, ...itemLines].join('\n')
    })
    .join('\n')

  const modeLabel = getExtractionModeLabel(normalizeExtractionMode(extraction.extraction_mode))
  const title = extraction.video_title?.trim() || 'Video sin título'
  const orderLabel = extraction.order_number ? `#${extraction.order_number}` : 'sin orden'
  const createdAt = toIsoDateTime(extraction.created_at)

  const block = [
    `EXTRACCION id=${extraction.id} orden=${orderLabel} modo="${modeLabel}" fecha="${createdAt}"`,
    `Titulo: ${truncateText(title, 180)}`,
    `URL: ${extraction.url}`,
    `Objetivo: ${truncateText(extraction.objective, 500)}`,
    phaseLines ? `Fases:\n${phaseLines}` : '',
    `ConsejoPro: ${truncateText(extraction.pro_tip, 240)}`,
  ]
    .filter((line) => line.trim().length > 0)
    .join('\n')

  return block
}

async function buildActiveExtractionTasksBlock(input: {
  userId: string
  activeExtractionId: string
}) {
  const tasks = await listExtractionTasksWithEventsForUser({
    extractionId: input.activeExtractionId,
  })

  if (tasks.length === 0) return ''

  const lines = ['SEGUIMIENTO_INTERACTIVO_DE_EXTRACCION_ACTIVA:']
  for (const task of tasks.slice(0, MAX_TASKS_FOR_ACTIVE)) {
    const checked = task.checked ? 'hecha' : 'pendiente'
    const subitem = task.position_path?.trim() || `${task.phase_id}.${task.item_index + 1}`
    lines.push(
      `- taskId=${task.id} subitem=${subitem} estado=${task.status} checklist=${checked} texto="${truncateText(task.item_text, 220)}"`
    )
    for (const event of task.events.slice(0, MAX_EVENTS_PER_TASK)) {
      lines.push(
        `  evento tipo=${event.event_type} fecha="${toIsoDateTime(event.created_at)}": ${truncateText(
          event.content,
          240
        )}`
      )
    }
  }

  return lines.join('\n')
}

function extractJsonObject(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
  }

  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first < 0 || last <= first) return null
  return trimmed.slice(first, last + 1)
}

function parseModelPayload(rawText: string): ChatResponsePayload {
  const fallback = {
    answer: rawText.trim(),
    usedExtractionIds: [],
  } satisfies ChatResponsePayload

  const candidate = extractJsonObject(rawText)
  if (!candidate) return fallback

  try {
    const parsed = JSON.parse(candidate) as {
      answer?: unknown
      usedExtractionIds?: unknown
    }
    const answer =
      typeof parsed.answer === 'string' && parsed.answer.trim().length > 0
        ? parsed.answer.trim()
        : fallback.answer
    const usedExtractionIds = Array.isArray(parsed.usedExtractionIds)
      ? parsed.usedExtractionIds
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : []

    return {
      answer,
      usedExtractionIds,
    }
  } catch {
    return fallback
  }
}

function normalizeExtractionId(raw: unknown) {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const question = normalizeQuestion((body as { question?: unknown })?.question)
    if (!question) {
      return NextResponse.json({ error: 'La pregunta es requerida.' }, { status: 400 })
    }

    const [dbChatProvider, dbChatModelSetting] = await Promise.all([
      getAppSetting('chat_provider').catch(() => null),
      getAppSetting('chat_model').catch(() => null),
    ])
    const resolvedChatProvider: AiProvider =
      (dbChatProvider as AiProvider | null) ?? 'anthropic'
    const resolvedChatModel = dbChatModelSetting || CHAT_MODEL_DEFAULT

    if (!isProviderAvailable(resolvedChatProvider)) {
      return NextResponse.json(
        { error: 'El asistente no está configurado. Falta la API key del proveedor seleccionado.' },
        { status: 503 }
      )
    }

    const activeExtractionId = normalizeExtractionId(
      (body as { activeExtractionId?: unknown })?.activeExtractionId
    )
    const extractionRows = await listExtractionsByUser(user.id, MAX_CONTEXT_EXTRACTIONS)

    if (extractionRows.length === 0) {
      const emptyAnswer =
        'Aún no tienes extracciones guardadas. Crea una extracción primero y luego pregúntame sobre su contenido.'
      void createChatMessageForUser({
        userId: user.id,
        role: 'user',
        content: question,
      }).catch(() => undefined)
      void createChatMessageForUser({
        userId: user.id,
        role: 'assistant',
        content: emptyAnswer,
      }).catch(() => undefined)

      return NextResponse.json({
        answer: emptyAnswer,
        references: [] as Array<{
          id: string
          orderNumber: number | null
          videoTitle: string | null
          mode: string
          createdAt: string
        }>,
      })
    }

    const extractionLookup = new Map(
      extractionRows.map((row) => [
        row.id,
        {
          id: row.id,
          orderNumber: row.order_number ?? null,
          videoTitle: row.video_title,
          mode: getExtractionModeLabel(normalizeExtractionMode(row.extraction_mode)),
          createdAt: row.created_at,
        },
      ])
    )

    const contextBlocks = extractionRows.map(buildExtractionSummaryBlock)
    let activeTasksBlock = ''
    if (activeExtractionId) {
      const activeExtraction =
        extractionRows.find((row) => row.id === activeExtractionId) ??
        (await findExtractionByIdForUser({ id: activeExtractionId, userId: user.id }))

      if (activeExtraction) {
        if (!extractionLookup.has(activeExtraction.id)) {
          extractionLookup.set(activeExtraction.id, {
            id: activeExtraction.id,
            orderNumber: activeExtraction.order_number ?? null,
            videoTitle: activeExtraction.video_title,
            mode: getExtractionModeLabel(normalizeExtractionMode(activeExtraction.extraction_mode)),
            createdAt: activeExtraction.created_at,
          })
          contextBlocks.unshift(buildExtractionSummaryBlock(activeExtraction))
        }

        activeTasksBlock = await buildActiveExtractionTasksBlock({
          userId: user.id,
          activeExtractionId: activeExtraction.id,
        })
      }
    }

    const baseContext = contextBlocks.join('\n\n-----\n\n')
    const fullContext = activeTasksBlock
      ? `${activeTasksBlock}\n\n-----\n\n${baseContext}`
      : baseContext
    const context = fullContext.slice(0, MAX_CONTEXT_CHARS)

    const persistedMessages = await listChatMessagesForUser({
      userId: user.id,
      limit: MAX_CONVERSATION_MESSAGES - 1,
    })

    const messageHistory = persistedMessages.map((entry) => ({
      role: entry.role,
      content: truncateText(entry.content, MAX_CONVERSATION_MESSAGE_LENGTH),
    }))
    while (messageHistory.length > 0 && messageHistory[0]?.role !== 'user') {
      messageHistory.shift()
    }

    const userPrompt = [
      `CONTEXTO_DEL_USUARIO (solo usa este contexto):`,
      context,
      '',
      activeExtractionId ? `EXTRACCION_ACTIVA_PRIORIZADA: ${activeExtractionId}` : '',
      '',
      `PREGUNTA_ACTUAL: ${question}`,
      '',
      'Devuelve SOLO JSON válido con esta estructura exacta:',
      '{',
      '  "answer": "respuesta final para el usuario en español",',
      '  "usedExtractionIds": ["id_extraccion_1", "id_extraccion_2"]',
      '}',
    ]
      .filter((line) => line.length > 0)
      .join('\n')

    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...messageHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userPrompt },
    ]

    const chatAiResult = await callAi({
      provider: resolvedChatProvider,
      model: resolvedChatModel,
      system:
        'Eres el asistente de ROI Action Extractor. Responde en español, de forma clara y accionable. Usa exclusivamente el contexto proporcionado del usuario. Si falta información, dilo explícitamente y pide la extracción o dato necesario. No inventes hechos.',
      messages: anthropicMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      })),
      maxTokens: CHAT_MAX_TOKENS,
    })
    const rawText = chatAiResult.text
    void logAiUsage({
      provider: resolvedChatProvider,
      model: resolvedChatModel,
      useType: 'chat',
      userId: user.id,
      inputTokens: chatAiResult.inputTokens,
      outputTokens: chatAiResult.outputTokens,
      costUsd: estimateCostUsd(resolvedChatModel, chatAiResult.inputTokens, chatAiResult.outputTokens),
    })

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: 'El asistente devolvió una respuesta vacía. Intenta de nuevo.' },
        { status: 502 }
      )
    }

    const parsed = parseModelPayload(rawText)
    const answer =
      parsed.answer.trim() ||
      'No pude construir una respuesta útil con el contexto actual. Intenta reformular la pregunta.'

    const usedExtractionIds = Array.from(
      new Set(
        parsed.usedExtractionIds
          .map((id) => id.trim())
          .filter((id) => extractionLookup.has(id))
      )
    ).slice(0, 6)

    const references = usedExtractionIds
      .map((id) => {
        const reference = extractionLookup.get(id)
        return reference
          ? {
              ...reference,
              createdAt: toIsoDateTime(reference.createdAt),
            }
          : null
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

    await createChatMessageForUser({
      userId: user.id,
      role: 'user',
      content: question,
      metadataJson: JSON.stringify({
        activeExtractionId: activeExtractionId || null,
      }),
    }).catch(() => null)

    await createChatMessageForUser({
      userId: user.id,
      role: 'assistant',
      content: answer,
      metadataJson: JSON.stringify({
        references,
      }),
    }).catch(() => null)

    return NextResponse.json({
      answer,
      references,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido.'
    console.error('[ActionExtractor] chat ask error:', message)

    // Anthropic SDK errors expose a status property
    const status =
      typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : null

    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: 'El asistente no está autorizado. Contacta al administrador.' },
        { status: 503 }
      )
    }

    if (status === 429) {
      return NextResponse.json(
        { error: 'El asistente está temporalmente saturado. Espera un momento e intenta de nuevo.' },
        { status: 429 }
      )
    }

    if (status !== null && status >= 500) {
      return NextResponse.json(
        { error: 'El servicio de IA tuvo una falla temporal. Intenta de nuevo en unos minutos.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: 'No se pudo generar la respuesta del asistente.' },
      { status: 500 }
    )
  }
}
