import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import {
  deleteGoogleDocsConnectionByUserId,
  findExtractionByIdForUser,
  findGoogleDocsConnectionByUserId,
  upsertGoogleDocsConnection,
} from '@/lib/db'
import { parseExtractionMetadata, parseExtractionPhases } from '@/lib/export-parsers'
import {
  createGoogleDocFromExtraction,
  GoogleDocsApiError,
  refreshGoogleAccessToken,
} from '@/lib/google-docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isTokenExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  const value = new Date(expiresAt).getTime()
  if (!Number.isFinite(value)) return false
  return value <= Date.now() + 30_000
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { extractionId?: unknown }
    | null

  const extractionId =
    typeof body?.extractionId === 'string' ? body.extractionId.trim() : ''
  if (!extractionId) {
    return NextResponse.json({ error: 'extractionId es requerido.' }, { status: 400 })
  }

  const connection = await findGoogleDocsConnectionByUserId(user.id)
  if (!connection) {
    return NextResponse.json(
      { error: 'Primero conecta tu cuenta de Google Docs.' },
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

  let accessToken = connection.access_token

  if (isTokenExpired(connection.token_expires_at)) {
    if (!connection.refresh_token) {
      await deleteGoogleDocsConnectionByUserId(user.id)
      return NextResponse.json(
        {
          error:
            'La conexión con Google expiró y no se pudo renovar automáticamente. Vuelve a conectar tu cuenta.',
        },
        { status: 401 }
      )
    }

    try {
      const refreshed = await refreshGoogleAccessToken(connection.refresh_token)
      accessToken = refreshed.access_token

      await upsertGoogleDocsConnection({
        userId: user.id,
        accessToken,
        refreshToken: refreshed.refresh_token ?? connection.refresh_token,
        tokenExpiresAt: refreshed.token_expires_at ?? connection.token_expires_at,
        scope: refreshed.scope ?? connection.scope,
        googleUserId: connection.google_user_id,
        userEmail: connection.user_email,
      })
    } catch (error: unknown) {
      await deleteGoogleDocsConnectionByUserId(user.id)
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo renovar la sesión de Google Docs.'
      return NextResponse.json(
        {
          error: `${message} Vuelve a conectar tu cuenta.`,
        },
        { status: 401 }
      )
    }
  }

  const phases = parseExtractionPhases(extraction.phases_json)
  const metadata = parseExtractionMetadata(extraction.metadata_json)

  try {
    const exported = await createGoogleDocFromExtraction({
      accessToken,
      extractionMode: extraction.extraction_mode,
      objective: extraction.objective,
      phases,
      proTip: extraction.pro_tip,
      metadata,
      videoTitle: extraction.video_title,
      videoUrl: extraction.url ?? '',
    })

    return NextResponse.json({
      documentId: exported.documentId,
      documentUrl: exported.documentUrl,
    })
  } catch (error: unknown) {
    if (error instanceof GoogleDocsApiError) {
      if (error.status === 401) {
        await deleteGoogleDocsConnectionByUserId(user.id)
        return NextResponse.json(
          {
            error:
              'La conexión con Google Docs expiró o fue revocada. Vuelve a conectar tu cuenta.',
          },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          error: error.message || 'No se pudo exportar a Google Docs.',
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      )
    }

    const message =
      error instanceof Error ? error.message : 'No se pudo exportar a Google Docs.'
    console.error('[ActionExtractor] google docs export error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
