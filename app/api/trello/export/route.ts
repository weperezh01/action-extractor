import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteTrelloConnectionByUserId,
  findExtractionByIdForUser,
  findTrelloConnectionByUserId,
} from '@/lib/db'
import { parseExtractionMetadata, parseExtractionPhases } from '@/lib/export-parsers'
import { createTrelloCardFromExtraction, TrelloApiError } from '@/lib/trello'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { extractionId?: unknown; listId?: unknown }
    | null

  const extractionId =
    typeof body?.extractionId === 'string' ? body.extractionId.trim() : ''
  const listId = typeof body?.listId === 'string' ? body.listId.trim() : ''

  if (!extractionId) {
    return NextResponse.json({ error: 'extractionId es requerido.' }, { status: 400 })
  }

  const connection = await findTrelloConnectionByUserId(user.id)
  if (!connection) {
    return NextResponse.json(
      { error: 'Primero conecta tu cuenta de Trello.' },
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
    const exported = await createTrelloCardFromExtraction({
      apiToken: connection.access_token,
      extractionMode: extraction.extraction_mode,
      objective: extraction.objective,
      phases,
      proTip: extraction.pro_tip,
      metadata,
      videoTitle: extraction.video_title,
      videoUrl: extraction.url,
      preferredListId: listId || null,
    })

    return NextResponse.json({
      cardId: exported.cardId,
      cardUrl: exported.cardUrl,
      listId: exported.listId,
      listName: exported.listName,
      boardId: exported.boardId,
      boardName: exported.boardName,
    })
  } catch (error: unknown) {
    if (error instanceof TrelloApiError) {
      if (error.status === 401) {
        await deleteTrelloConnectionByUserId(user.id)
        return NextResponse.json(
          {
            error:
              'La conexión con Trello expiró o fue revocada. Vuelve a conectar tu cuenta.',
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          error: error.message || 'No se pudo exportar a Trello.',
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      )
    }

    const message =
      error instanceof Error ? error.message : 'No se pudo exportar a Trello.'
    console.error('[ActionExtractor] trello export error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
