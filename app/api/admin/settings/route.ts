import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { getAppSetting, upsertAppSetting } from '@/lib/db'
import { getBusinessAssumptions, upsertBusinessAssumptions } from '@/lib/db/billing'
import {
  type AiProvider,
  PROVIDER_MODELS,
  PROVIDER_LABELS,
  PROVIDER_ENV_KEYS,
  MODEL_LABELS,
  resolveAiModel,
  resolveAiProvider,
  isValidProviderModel,
} from '@/lib/ai-client'
import { type BusinessAssumptions, normalizeBusinessAssumptions } from '@/lib/profitability'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALL_PROVIDERS: AiProvider[] = ['anthropic', 'openai', 'google']

const DEFAULT_EXTRACTION_PROVIDER: AiProvider = 'anthropic'
const DEFAULT_EXTRACTION_MODEL =
  process.env.ACTION_EXTRACTOR_EXTRACTION_MODEL?.trim() || 'claude-sonnet-4-6'

const DEFAULT_CHAT_PROVIDER: AiProvider = 'anthropic'
const DEFAULT_CHAT_MODEL =
  process.env.ACTION_EXTRACTOR_CHAT_MODEL?.trim() || 'claude-haiku-4-5-20251001'

function isValidProvider(value: unknown): value is AiProvider {
  return ALL_PROVIDERS.includes(value as AiProvider)
}

function getApiKeyStatus(provider: AiProvider): boolean {
  const envKey = PROVIDER_ENV_KEYS[provider]
  return Boolean(process.env[envKey]?.trim())
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  const [extractionProvider, extractionModel, chatProvider, chatModel, businessAssumptions] = await Promise.all([
    getAppSetting('extraction_provider'),
    getAppSetting('extraction_model'),
    getAppSetting('chat_provider'),
    getAppSetting('chat_model'),
    getBusinessAssumptions(),
  ])

  const resolvedExtractionProvider = resolveAiProvider(extractionProvider, DEFAULT_EXTRACTION_PROVIDER)
  const resolvedChatProvider = resolveAiProvider(chatProvider, DEFAULT_CHAT_PROVIDER)
  const resolvedExtractionModel = resolveAiModel(
    resolvedExtractionProvider,
    typeof extractionModel === 'string' ? extractionModel : null,
    DEFAULT_EXTRACTION_MODEL
  )
  const resolvedChatModel = resolveAiModel(
    resolvedChatProvider,
    typeof chatModel === 'string' ? chatModel : null,
    DEFAULT_CHAT_MODEL
  )

  const providers = ALL_PROVIDERS.map((p) => ({
    id: p,
    label: PROVIDER_LABELS[p],
    hasApiKey: getApiKeyStatus(p),
    models: PROVIDER_MODELS[p].map((m) => ({ id: m, label: MODEL_LABELS[m] ?? m })),
  }))

  return NextResponse.json({
    extractionProvider: resolvedExtractionProvider,
    extractionModel: resolvedExtractionModel,
    chatProvider: resolvedChatProvider,
    chatModel: resolvedChatModel,
    providers,
    defaults: {
      extractionProvider: DEFAULT_EXTRACTION_PROVIDER,
      extractionModel: DEFAULT_EXTRACTION_MODEL,
      chatProvider: DEFAULT_CHAT_PROVIDER,
      chatModel: DEFAULT_CHAT_MODEL,
    },
    businessAssumptions,
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const { extractionProvider, extractionModel, chatProvider, chatModel, businessAssumptions } = body as {
    extractionProvider?: unknown
    extractionModel?: unknown
    chatProvider?: unknown
    chatModel?: unknown
    businessAssumptions?: unknown
  }

  const updates: Array<Promise<void>> = []

  // Validate and queue extraction settings
  const newExtractionProvider = extractionProvider !== undefined ? extractionProvider : null
  const newExtractionModel = extractionModel !== undefined ? extractionModel : null

  if (newExtractionProvider !== null) {
    if (!isValidProvider(newExtractionProvider)) {
      return NextResponse.json(
        { error: `Proveedor de extracción inválido. Opciones: ${ALL_PROVIDERS.join(', ')}` },
        { status: 400 }
      )
    }
    updates.push(upsertAppSetting('extraction_provider', newExtractionProvider))
  }

  if (newExtractionModel !== null) {
    if (typeof newExtractionModel !== 'string') {
      return NextResponse.json({ error: 'Modelo de extracción inválido.' }, { status: 400 })
    }
    const providerToCheck = isValidProvider(newExtractionProvider)
      ? newExtractionProvider
      : ((await getAppSetting('extraction_provider')) as AiProvider | null) ?? DEFAULT_EXTRACTION_PROVIDER
    if (!isValidProviderModel(providerToCheck, newExtractionModel)) {
      return NextResponse.json(
        {
          error: `Modelo "${newExtractionModel}" no es válido para el proveedor "${providerToCheck}".`,
        },
        { status: 400 }
      )
    }
    updates.push(upsertAppSetting('extraction_model', newExtractionModel))
  }

  // Validate and queue chat settings
  const newChatProvider = chatProvider !== undefined ? chatProvider : null
  const newChatModel = chatModel !== undefined ? chatModel : null

  if (newChatProvider !== null) {
    if (!isValidProvider(newChatProvider)) {
      return NextResponse.json(
        { error: `Proveedor de chat inválido. Opciones: ${ALL_PROVIDERS.join(', ')}` },
        { status: 400 }
      )
    }
    updates.push(upsertAppSetting('chat_provider', newChatProvider))
  }

  if (newChatModel !== null) {
    if (typeof newChatModel !== 'string') {
      return NextResponse.json({ error: 'Modelo de chat inválido.' }, { status: 400 })
    }
    const providerToCheck = isValidProvider(newChatProvider)
      ? newChatProvider
      : ((await getAppSetting('chat_provider')) as AiProvider | null) ?? DEFAULT_CHAT_PROVIDER
    if (!isValidProviderModel(providerToCheck, newChatModel)) {
      return NextResponse.json(
        { error: `Modelo "${newChatModel}" no es válido para el proveedor "${providerToCheck}".` },
        { status: 400 }
      )
    }
    updates.push(upsertAppSetting('chat_model', newChatModel))
  }

  if (businessAssumptions !== undefined) {
    if (!businessAssumptions || typeof businessAssumptions !== 'object' || Array.isArray(businessAssumptions)) {
      return NextResponse.json({ error: 'businessAssumptions debe ser un objeto.' }, { status: 400 })
    }
    updates.push(
      upsertBusinessAssumptions(
        normalizeBusinessAssumptions(businessAssumptions as Partial<BusinessAssumptions>)
      ).then(() => undefined)
    )
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No se proporcionó ningún cambio.' }, { status: 400 })
  }

  await Promise.all(updates)

  const [savedExtractionProvider, savedExtractionModel, savedChatProvider, savedChatModel, savedBusinessAssumptions] =
    await Promise.all([
      getAppSetting('extraction_provider'),
      getAppSetting('extraction_model'),
      getAppSetting('chat_provider'),
      getAppSetting('chat_model'),
      getBusinessAssumptions(),
    ])

  return NextResponse.json({
    extractionProvider: resolveAiProvider(savedExtractionProvider, DEFAULT_EXTRACTION_PROVIDER),
    extractionModel: resolveAiModel(
      resolveAiProvider(savedExtractionProvider, DEFAULT_EXTRACTION_PROVIDER),
      typeof savedExtractionModel === 'string' ? savedExtractionModel : null,
      DEFAULT_EXTRACTION_MODEL
    ),
    chatProvider: resolveAiProvider(savedChatProvider, DEFAULT_CHAT_PROVIDER),
    chatModel: resolveAiModel(
      resolveAiProvider(savedChatProvider, DEFAULT_CHAT_PROVIDER),
      typeof savedChatModel === 'string' ? savedChatModel : null,
      DEFAULT_CHAT_MODEL
    ),
    businessAssumptions: savedBusinessAssumptions,
  })
}
