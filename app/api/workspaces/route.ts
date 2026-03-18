import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { createWorkspace, listWorkspacesForUser } from '@/lib/db/workspaces'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    const workspaces = await listWorkspacesForUser(user.id)
    return NextResponse.json({ workspaces })
  } catch (error: unknown) {
    console.error('[workspaces] GET error:', error)
    return NextResponse.json({ error: 'Error al listar workspaces.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
    }

    const b = body as { name?: unknown; slug?: unknown; description?: unknown; avatarColor?: unknown }
    const name = typeof b.name === 'string' ? b.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'El nombre del workspace es requerido.' }, { status: 400 })
    if (name.length > 80) return NextResponse.json({ error: 'El nombre no puede superar 80 caracteres.' }, { status: 400 })

    const workspace = await createWorkspace({
      ownerId: user.id,
      name,
      slug: typeof b.slug === 'string' ? b.slug.trim() : undefined,
      description: typeof b.description === 'string' ? b.description : undefined,
      avatarColor: typeof b.avatarColor === 'string' ? b.avatarColor : undefined,
    })

    return NextResponse.json({ workspace }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al crear workspace.'
    console.error('[workspaces] POST error:', msg)
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('slug')) {
      return NextResponse.json({ error: 'El slug ya está en uso. Elige otro nombre.' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
