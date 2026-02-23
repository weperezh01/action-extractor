import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteTodoistConnectionByUserId,
  findExtractionByIdForUser,
  findTodoistConnectionByUserId,
} from '@/lib/db'
import { parseExtractionMetadata, parseExtractionPhases } from '@/lib/export-parsers'
import { createTodoistTaskFromExtraction, TodoistApiError } from '@/lib/todoist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { extractionId?: unknown; projectId?: unknown }
    | null

  const extractionId =
    typeof body?.extractionId === 'string' ? body.extractionId.trim() : ''
  const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : ''

  if (!extractionId) {
    return NextResponse.json({ error: 'extractionId es requerido.' }, { status: 400 })
  }

  const connection = await findTodoistConnectionByUserId(user.id)
  if (!connection) {
    return NextResponse.json(
      { error: 'Primero conecta tu cuenta de Todoist.' },
      { status: 409 }
    )
  }

  const extraction = await findExtractionByIdForUser({
    id: extractionId,
    userId: user.id,
  })

  if (!extraction) {
    return NextResponse.json(
      { error: 'No se encontró la extracción seleccionada.' },
      { status: 404 }
    )
  }

  const phases = parseExtractionPhases(extraction.phases_json)
  const metadata = parseExtractionMetadata(extraction.metadata_json)

  try {
    const exported = await createTodoistTaskFromExtraction({
      accessToken: connection.access_token,
      extractionMode: extraction.extraction_mode,
      objective: extraction.objective,
      phases,
      proTip: extraction.pro_tip,
      metadata,
      videoTitle: extraction.video_title,
      videoUrl: extraction.url ?? '',
      preferredProjectId: projectId || connection.project_id,
    })

    return NextResponse.json({
      taskId: exported.taskId,
      taskUrl: exported.taskUrl,
      projectId: exported.projectId,
    })
  } catch (error: unknown) {
    if (error instanceof TodoistApiError) {
      if (error.status === 401) {
        await deleteTodoistConnectionByUserId(user.id)
        return NextResponse.json(
          {
            error:
              'La conexión con Todoist expiró o fue revocada. Vuelve a conectar tu cuenta.',
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          error: error.message || 'No se pudo exportar a Todoist.',
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      )
    }

    const message =
      error instanceof Error ? error.message : 'No se pudo exportar a Todoist.'
    console.error('[ActionExtractor] todoist export error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
