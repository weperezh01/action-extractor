import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, isAdminEmail } from '@/lib/auth'
import { updatePlan, deletePlan } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { planId } = params
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })

  const input: Parameters<typeof updatePlan>[1] = {}

  if (typeof body.name === 'string') input.name = body.name
  if (typeof body.displayName === 'string') input.displayName = body.displayName
  if (typeof body.priceMonthlyUsd === 'number') input.priceMonthlyUsd = body.priceMonthlyUsd
  if ('stripePriceId' in body) input.stripePriceId = body.stripePriceId as string | null
  if (typeof body.extractionsPerHour === 'number') input.extractionsPerHour = body.extractionsPerHour
  if (typeof body.extractionsPerDay === 'number') input.extractionsPerDay = body.extractionsPerDay
  if (typeof body.chatTokensPerDay === 'number') input.chatTokensPerDay = body.chatTokensPerDay
  if (typeof body.storageLimitBytes === 'number' && body.storageLimitBytes >= 0) input.storageLimitBytes = body.storageLimitBytes
  if (typeof body.targetGrossMarginPct === 'number') input.targetGrossMarginPct = body.targetGrossMarginPct
  if (typeof body.profitabilityAlertEnabled === 'boolean') input.profitabilityAlertEnabled = body.profitabilityAlertEnabled
  if (typeof body.estimatedMonthlyFixedCostUsd === 'number') {
    input.estimatedMonthlyFixedCostUsd = body.estimatedMonthlyFixedCostUsd
  }
  if (typeof body.featuresJson === 'string') {
    try { JSON.parse(body.featuresJson) } catch {
      return NextResponse.json({ error: 'featuresJson no es JSON válido.' }, { status: 400 })
    }
    input.featuresJson = body.featuresJson
  }
  if (typeof body.isActive === 'boolean') input.isActive = body.isActive
  if (typeof body.displayOrder === 'number') input.displayOrder = body.displayOrder

  if (input.priceMonthlyUsd !== undefined && (!Number.isFinite(input.priceMonthlyUsd) || input.priceMonthlyUsd < 0)) {
    return NextResponse.json({ error: 'priceMonthlyUsd debe ser ≥ 0.' }, { status: 400 })
  }
  if (input.extractionsPerHour !== undefined && (!Number.isFinite(input.extractionsPerHour) || input.extractionsPerHour < 1)) {
    return NextResponse.json({ error: 'extractionsPerHour debe ser ≥ 1.' }, { status: 400 })
  }
  if (input.extractionsPerDay !== undefined && (!Number.isFinite(input.extractionsPerDay) || input.extractionsPerDay < 0)) {
    return NextResponse.json({ error: 'extractionsPerDay debe ser ≥ 0.' }, { status: 400 })
  }
  if (input.chatTokensPerDay !== undefined && (!Number.isFinite(input.chatTokensPerDay) || input.chatTokensPerDay < 0)) {
    return NextResponse.json({ error: 'chatTokensPerDay debe ser ≥ 0.' }, { status: 400 })
  }
  if (input.storageLimitBytes !== undefined && (!Number.isFinite(input.storageLimitBytes) || input.storageLimitBytes < 0)) {
    return NextResponse.json({ error: 'storageLimitBytes debe ser ≥ 0.' }, { status: 400 })
  }
  if (input.targetGrossMarginPct !== undefined && (!Number.isFinite(input.targetGrossMarginPct) || input.targetGrossMarginPct < 0 || input.targetGrossMarginPct >= 1)) {
    return NextResponse.json({ error: 'targetGrossMarginPct debe estar entre 0 y 0.99.' }, { status: 400 })
  }
  if (input.estimatedMonthlyFixedCostUsd !== undefined && (!Number.isFinite(input.estimatedMonthlyFixedCostUsd) || input.estimatedMonthlyFixedCostUsd < 0)) {
    return NextResponse.json({ error: 'estimatedMonthlyFixedCostUsd debe ser ≥ 0.' }, { status: 400 })
  }

  const plan = await updatePlan(planId, input)
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado.' }, { status: 404 })

  return NextResponse.json({ plan })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { planId } = params

  // Protect seed plans from deletion
  if (['plan_free', 'plan_starter', 'plan_pro', 'plan_business'].includes(planId)) {
    return NextResponse.json(
      { error: 'Los planes predeterminados (Free, Starter, Pro, Business) no se pueden eliminar.' },
      { status: 400 }
    )
  }

  await deletePlan(planId)
  return NextResponse.json({ ok: true })
}
