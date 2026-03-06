import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getCommunityUserProfile } from '@/lib/db'

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

    const { userId } = params
    if (!userId?.trim()) {
      return NextResponse.json({ error: 'ID de usuario inválido.' }, { status: 400 })
    }

    const profile = await getCommunityUserProfile(user.id, userId.trim())
    if (!profile) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ profile, isOwnProfile: user.id === userId.trim() })
  } catch (error: unknown) {
    console.error('[GET /api/community/users/[userId]]', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
