import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { listPromptOverrides } from '@/lib/db'
import {
  getDefaultExtractionSystemPrompt,
  getDefaultExtractionUserPrompt,
  CHAT_SYSTEM_PROMPT_DEFAULT,
} from '@/lib/extract-core'
import { EXTRACTION_MODE_OPTIONS } from '@/lib/extraction-modes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODE_LABELS: Record<string, string> = {
  action_plan: 'Plan de Acción',
  executive_summary: 'Resumen Ejecutivo',
  business_ideas: 'Ideas de Negocio',
  key_quotes: 'Frases Clave',
  concept_map: 'Mapa Conceptual',
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const overrides = await listPromptOverrides()
  const overrideMap = new Map(overrides.map((o) => [o.prompt_key, o]))

  const prompts: Array<{
    promptKey: string
    label: string
    category: 'extraction' | 'chat'
    mode: string | null
    type: 'system' | 'user'
    defaultContent: string
    overriddenContent: string | null
    isOverridden: boolean
    updatedAt: string | null
    updatedBy: string | null
  }> = []

  for (const { value: mode } of EXTRACTION_MODE_OPTIONS) {
    const modeLabel = MODE_LABELS[mode] ?? mode

    const systemKey = `extraction:${mode}:system`
    const systemOverride = overrideMap.get(systemKey)
    prompts.push({
      promptKey: systemKey,
      label: `${modeLabel} — Sistema`,
      category: 'extraction',
      mode,
      type: 'system',
      defaultContent: getDefaultExtractionSystemPrompt(mode),
      overriddenContent: systemOverride?.content ?? null,
      isOverridden: !!systemOverride,
      updatedAt: systemOverride?.updated_at ?? null,
      updatedBy: systemOverride?.updated_by ?? null,
    })

    const userKey = `extraction:${mode}:user`
    const userOverride = overrideMap.get(userKey)
    prompts.push({
      promptKey: userKey,
      label: `${modeLabel} — Usuario`,
      category: 'extraction',
      mode,
      type: 'user',
      defaultContent: getDefaultExtractionUserPrompt(mode),
      overriddenContent: userOverride?.content ?? null,
      isOverridden: !!userOverride,
      updatedAt: userOverride?.updated_at ?? null,
      updatedBy: userOverride?.updated_by ?? null,
    })
  }

  const chatKey = 'chat:system'
  const chatOverride = overrideMap.get(chatKey)
  prompts.push({
    promptKey: chatKey,
    label: 'Asistente Chat — Sistema',
    category: 'chat',
    mode: null,
    type: 'system',
    defaultContent: CHAT_SYSTEM_PROMPT_DEFAULT,
    overriddenContent: chatOverride?.content ?? null,
    isOverridden: !!chatOverride,
    updatedAt: chatOverride?.updated_at ?? null,
    updatedBy: chatOverride?.updated_by ?? null,
  })

  return NextResponse.json({ prompts })
}
