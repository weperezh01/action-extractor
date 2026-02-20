import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { findGoogleDocsConnectionByUserId } from '@/lib/db'
import { isGoogleDocsOAuthConfigured } from '@/lib/google-docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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
}
