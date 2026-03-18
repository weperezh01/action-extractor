import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findGoogleDocsConnectionByUserId } from '@/lib/db/integrations'
import { isGoogleDocsOAuthConfigured } from '@/lib/google-docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const connection = await findGoogleDocsConnectionByUserId(user.id)

    return NextResponse.json({
      configured: isGoogleDocsOAuthConfigured(),
      connected: Boolean(connection),
      userEmail: connection?.user_email ?? null,
      googleUserId: connection?.google_user_id ?? null,
      scope: connection?.scope ?? null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] google-docs/status GET error:', message)
    return NextResponse.json({ error: 'No se pudo consultar el estado de Google Docs.' }, { status: 500 })
  }
}
