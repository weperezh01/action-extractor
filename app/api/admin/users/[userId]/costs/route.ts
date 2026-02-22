import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { getAdminUserAiCostDetail } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Acceso restringido a administradores.' }, { status: 403 })
    }

    const { userId } = params
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'userId requerido.' }, { status: 400 })
    }

    const detail = await getAdminUserAiCostDetail(userId)
    return NextResponse.json(detail)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los costos del usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
