import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  buildExtractionLineageForUser,
} from '@/lib/db'
import { findCloneableExtractionAccessForUser } from '@/lib/db/extractions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseExtractionId(raw: unknown) {
  return typeof raw === 'string' ? raw.trim() : ''
}

export async function GET(
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

    const access = await findCloneableExtractionAccessForUser({
      id: extractionId,
      userId: user.id,
    })

    if (!access.extraction) {
      return NextResponse.json({ error: 'No se encontró el playbook solicitado.' }, { status: 404 })
    }

    if (!access.role) {
      return NextResponse.json({ error: 'No tienes acceso a este playbook.' }, { status: 403 })
    }

    const lineage = await buildExtractionLineageForUser({
      extractionId,
      userId: user.id,
      includeCopyStats: access.role === 'owner',
    })

    return NextResponse.json(lineage)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el linaje del playbook.'
    console.error('[ActionExtractor] extraction lineage GET error:', message)
    return NextResponse.json({ error: 'No se pudo cargar el linaje del playbook.' }, { status: 500 })
  }
}
