import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteNotionConnectionByUserId,
  findExtractionByIdForUser,
  findNotionConnectionByUserId,
} from '@/lib/db'
import {
  createNotionPageFromExtraction,
  NotionApiError,
} from '@/lib/notion'
import {
  parseExtractionMetadata,
  parseExtractionPhases,
} from '@/lib/export-parsers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { extractionId?: unknown; parentPageId?: unknown }
    | null

  const extractionId = typeof body?.extractionId === 'string' ? body.extractionId.trim() : ''
  const parentPageId = typeof body?.parentPageId === 'string' ? body.parentPageId.trim() : ''

  if (!extractionId) {
    return NextResponse.json({ error: 'extractionId es requerido.' }, { status: 400 })
  }

  const notionConnection = await findNotionConnectionByUserId(user.id)
  if (!notionConnection) {
    return NextResponse.json(
      { error: 'Primero conecta tu cuenta de Notion.' },
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
    const exported = await createNotionPageFromExtraction({
      accessToken: notionConnection.access_token,
      extractionMode: extraction.extraction_mode,
      objective: extraction.objective,
      phases,
      proTip: extraction.pro_tip,
      metadata,
      videoTitle: extraction.video_title,
      videoUrl: extraction.url,
      parentPageId: parentPageId || null,
    })

    return NextResponse.json({
      pageId: exported.pageId,
      pageUrl: exported.pageUrl,
    })
  } catch (error: unknown) {
    if (error instanceof NotionApiError) {
      if (error.status === 401) {
        await deleteNotionConnectionByUserId(user.id)
        return NextResponse.json(
          {
            error:
              'La conexión con Notion expiró o fue revocada. Vuelve a conectar tu cuenta.',
          },
          { status: 401 }
        )
      }

      if (error.status === 403) {
        return NextResponse.json(
          {
            error:
              'Notion rechazó el acceso. Verifica que el workspace y las páginas estén compartidas con la integración.',
          },
          { status: 403 }
        )
      }

      return NextResponse.json(
        {
          error: error.message || 'No se pudo exportar a Notion.',
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      )
    }

    const message = error instanceof Error ? error.message : 'No se pudo exportar a Notion.'
    console.error('[ActionExtractor] notion export error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
