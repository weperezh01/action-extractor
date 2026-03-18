import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getUserCreditBalance, listUserCreditTransactions } from '@/lib/db/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
    }

    const [balance, transactions] = await Promise.all([
      getUserCreditBalance(user.id),
      listUserCreditTransactions(user.id, 10),
    ])

    return NextResponse.json({ balance, transactions })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[ActionExtractor] account/credits GET error:', message)
    return NextResponse.json({ error: 'No se pudo obtener el balance de créditos.' }, { status: 500 })
  }
}
