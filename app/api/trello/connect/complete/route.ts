import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { upsertTrelloConnection } from '@/lib/db'
import {
  getTrelloMemberByToken,
  TrelloApiError,
  verifyTrelloOauthState,
} from '@/lib/trello'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { token?: unknown; state?: unknown }
    | null

  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const state = typeof body?.state === 'string' ? body.state.trim() : ''
  if (!token || !state) {
    return NextResponse.json({ error: 'token y state son requeridos.' }, { status: 400 })
  }

  if (!verifyTrelloOauthState(state, user.id)) {
    return NextResponse.json({ error: 'No se pudo validar la conexión con Trello.' }, { status: 400 })
  }

  try {
    const member = await getTrelloMemberByToken(token)

    await upsertTrelloConnection({
      userId: user.id,
      accessToken: token,
      memberId: normalizeNullableString(member?.id),
      username: normalizeNullableString(member?.username),
      fullName: normalizeNullableString(member?.fullName),
    })

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if (error instanceof TrelloApiError) {
      return NextResponse.json(
        {
          error: error.message || 'No se pudo validar la cuenta de Trello.',
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 }
      )
    }

    const message =
      error instanceof Error ? error.message : 'No se pudo completar la conexión con Trello.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
