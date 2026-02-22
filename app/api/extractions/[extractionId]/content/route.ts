import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionByIdForUser,
  syncExtractionTasksForUser,
  updateExtractionPhasesForUser,
} from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface EditablePhase {
  id: number
  title: string
  items: string[]
}

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeEditablePhases(payload: unknown): EditablePhase[] {
  if (!Array.isArray(payload)) return []

  const parsed = payload
    .map((phase) => {
      if (!phase || typeof phase !== 'object') return null

      const rawTitle = (phase as { title?: unknown }).title
      const rawItems = (phase as { items?: unknown }).items
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
      const items = Array.isArray(rawItems)
        ? rawItems.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
        : []

      if (!title || items.length === 0) {
        return null
      }

      return { title, items }
    })
    .filter((phase): phase is { title: string; items: string[] } => Boolean(phase))

  return parsed.map((phase, index) => ({
    id: index + 1,
    title: phase.title,
    items: phase.items,
  }))
}

export async function PATCH(
  req: NextRequest,
  context: { params: { extractionId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const extractionId = parseExtractionId(context.params?.extractionId)
    if (!extractionId) {
      return NextResponse.json({ error: 'extractionId inválido.' }, { status: 400 })
    }

    const extraction = await findExtractionByIdForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const phases = normalizeEditablePhases((body as { phases?: unknown })?.phases)
    if (phases.length === 0) {
      return NextResponse.json(
        { error: 'Debes conservar al menos un ítem principal con subítems válidos.' },
        { status: 400 }
      )
    }

    const updated = await updateExtractionPhasesForUser({
      id: extractionId,
      userId: user.id,
      phasesJson: JSON.stringify(phases),
    })
    if (!updated) {
      return NextResponse.json({ error: 'No se pudo actualizar el contenido.' }, { status: 404 })
    }

    await syncExtractionTasksForUser({
      userId: user.id,
      extractionId: updated.id,
      phases,
    })

    return NextResponse.json({
      extractionId: updated.id,
      phases: safeParse<EditablePhase[]>(updated.phases_json, phases),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el contenido.'
    console.error('[ActionExtractor] extraction content PATCH error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar el contenido.' }, { status: 500 })
  }
}
