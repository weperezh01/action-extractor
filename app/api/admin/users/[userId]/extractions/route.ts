import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { findAdminUserById, listExtractionsByUser } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseLimit(raw: string | null) {
  if (!raw) return 50
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return 50
  return Math.min(100, Math.max(1, parsed))
}

export async function GET(
  req: NextRequest,
  context: { params: { userId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Acceso restringido a administradores.' }, { status: 403 })
    }

    const userId = typeof context.params?.userId === 'string' ? context.params.userId.trim() : ''
    if (!userId) {
      return NextResponse.json({ error: 'userId inválido.' }, { status: 400 })
    }

    const limit = parseLimit(req.nextUrl.searchParams.get('limit'))
    const targetUser = await findAdminUserById(userId)

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    const rows = await listExtractionsByUser(userId, limit)

    return NextResponse.json({
      user: targetUser,
      extractions: rows.map((row) => ({
        id: row.id,
        url: row.url,
        video_id: row.video_id,
        video_title: row.video_title,
        thumbnail_url: row.thumbnail_url,
        extraction_mode: row.extraction_mode,
        objective: row.objective,
        created_at: row.created_at,
      })),
      limit,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar las extracciones del usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
