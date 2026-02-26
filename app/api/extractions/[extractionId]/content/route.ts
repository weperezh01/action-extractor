import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  findExtractionAccessForUser,
  syncExtractionTasksForUser,
  updateExtractionPhasesForUser,
} from '@/lib/db'
import { normalizePlaybookPhases, type PlaybookPhase } from '@/lib/playbook-tree'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    const access = await findExtractionAccessForUser({
      id: extractionId,
      userId: user.id,
    })
    if (!access.extraction) {
      return NextResponse.json({ error: 'No se encontró la extracción solicitada.' }, { status: 404 })
    }
    if (!access.role) {
      return NextResponse.json({ error: 'No tienes acceso a esta extracción.' }, { status: 403 })
    }
    if (access.role !== 'owner' && access.role !== 'editor') {
      return NextResponse.json({ error: 'No tienes permisos para editar esta extracción.' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const phases = normalizePlaybookPhases((body as { phases?: unknown })?.phases)
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
      phases: safeParse<PlaybookPhase[]>(updated.phases_json, phases),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el contenido.'
    console.error('[ActionExtractor] extraction content PATCH error:', message)
    return NextResponse.json({ error: 'No se pudo actualizar el contenido.' }, { status: 500 })
  }
}
