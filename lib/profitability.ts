export type ProfitabilityStatus = 'healthy' | 'at_risk' | 'unprofitable'
export type SharedCostAllocationStrategy = 'none' | 'paid_only' | 'all_active'
export type ScenarioRecommendation =
  | 'keep'
  | 'raise_price'
  | 'lower_limits'
  | 'raise_price_and_lower_limits'
  | 'acquisition_mode'

export interface BusinessAssumptions {
  version: 1
  targetGrossMarginPct: number
  paymentFeePct: number
  paymentFeeFixedUsd: number
  monthlyInfraFixedUsd: number
  monthlyPayrollUsd: number
  monthlySupportUsd: number
  monthlyToolingUsd: number
  targetPaybackMonths: number
  assumedMonthlyChurnPct: number
  assumedTrialToPaidPct: number
}

export interface ScenarioRecommendationResult {
  recommendation: ScenarioRecommendation
  reason: string
}

export const DEFAULT_BUSINESS_ASSUMPTIONS: BusinessAssumptions = {
  version: 1,
  targetGrossMarginPct: 0.75,
  paymentFeePct: 0.029,
  paymentFeeFixedUsd: 0.3,
  monthlyInfraFixedUsd: 0,
  monthlyPayrollUsd: 0,
  monthlySupportUsd: 0,
  monthlyToolingUsd: 0,
  targetPaybackMonths: 12,
  assumedMonthlyChurnPct: 0.05,
  assumedTrialToPaidPct: 0.05,
}

function clampNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function clampProbability(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(0.99, Math.max(0, Number(value)))
}

function clampPositiveNumber(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(1, Number(value)))
}

export function normalizeMarginPct(value: number | null | undefined, fallback = 0.75) {
  if (!Number.isFinite(value ?? NaN)) return fallback
  return Math.min(0.99, Math.max(0, Number(value)))
}

export function normalizeBusinessAssumptions(
  value: Partial<BusinessAssumptions> | null | undefined
): BusinessAssumptions {
  const source = value ?? {}

  return {
    version: 1,
    targetGrossMarginPct: normalizeMarginPct(
      typeof source.targetGrossMarginPct === 'number'
        ? source.targetGrossMarginPct
        : DEFAULT_BUSINESS_ASSUMPTIONS.targetGrossMarginPct,
      DEFAULT_BUSINESS_ASSUMPTIONS.targetGrossMarginPct
    ),
    paymentFeePct: clampProbability(
      typeof source.paymentFeePct === 'number'
        ? source.paymentFeePct
        : DEFAULT_BUSINESS_ASSUMPTIONS.paymentFeePct,
      DEFAULT_BUSINESS_ASSUMPTIONS.paymentFeePct
    ),
    paymentFeeFixedUsd: clampNonNegative(
      typeof source.paymentFeeFixedUsd === 'number'
        ? source.paymentFeeFixedUsd
        : DEFAULT_BUSINESS_ASSUMPTIONS.paymentFeeFixedUsd
    ),
    monthlyInfraFixedUsd: clampNonNegative(
      typeof source.monthlyInfraFixedUsd === 'number'
        ? source.monthlyInfraFixedUsd
        : DEFAULT_BUSINESS_ASSUMPTIONS.monthlyInfraFixedUsd
    ),
    monthlyPayrollUsd: clampNonNegative(
      typeof source.monthlyPayrollUsd === 'number'
        ? source.monthlyPayrollUsd
        : DEFAULT_BUSINESS_ASSUMPTIONS.monthlyPayrollUsd
    ),
    monthlySupportUsd: clampNonNegative(
      typeof source.monthlySupportUsd === 'number'
        ? source.monthlySupportUsd
        : DEFAULT_BUSINESS_ASSUMPTIONS.monthlySupportUsd
    ),
    monthlyToolingUsd: clampNonNegative(
      typeof source.monthlyToolingUsd === 'number'
        ? source.monthlyToolingUsd
        : DEFAULT_BUSINESS_ASSUMPTIONS.monthlyToolingUsd
    ),
    targetPaybackMonths: clampPositiveNumber(
      typeof source.targetPaybackMonths === 'number'
        ? source.targetPaybackMonths
        : DEFAULT_BUSINESS_ASSUMPTIONS.targetPaybackMonths,
      DEFAULT_BUSINESS_ASSUMPTIONS.targetPaybackMonths,
      36
    ),
    assumedMonthlyChurnPct: clampProbability(
      typeof source.assumedMonthlyChurnPct === 'number'
        ? source.assumedMonthlyChurnPct
        : DEFAULT_BUSINESS_ASSUMPTIONS.assumedMonthlyChurnPct,
      DEFAULT_BUSINESS_ASSUMPTIONS.assumedMonthlyChurnPct
    ),
    assumedTrialToPaidPct: clampProbability(
      typeof source.assumedTrialToPaidPct === 'number'
        ? source.assumedTrialToPaidPct
        : DEFAULT_BUSINESS_ASSUMPTIONS.assumedTrialToPaidPct,
      DEFAULT_BUSINESS_ASSUMPTIONS.assumedTrialToPaidPct
    ),
  }
}

export function getTotalSharedFixedCostUsd(assumptions: BusinessAssumptions) {
  return (
    clampNonNegative(assumptions.monthlyInfraFixedUsd) +
    clampNonNegative(assumptions.monthlyPayrollUsd) +
    clampNonNegative(assumptions.monthlySupportUsd) +
    clampNonNegative(assumptions.monthlyToolingUsd)
  )
}

export function calculateSharedFixedCostAllocationPerUser(input: {
  sharedFixedCostUsd: number
  totalActiveUsers: number
  totalActivePaidUsers: number
  planPriceMonthlyUsd: number
}) {
  const sharedFixedCostUsd = clampNonNegative(input.sharedFixedCostUsd)
  if (sharedFixedCostUsd <= 0) {
    return { allocatedCostPerUserUsd: 0, strategy: 'none' as SharedCostAllocationStrategy }
  }

  const totalActiveUsers = Math.max(0, Math.trunc(input.totalActiveUsers))
  const totalActivePaidUsers = Math.max(0, Math.trunc(input.totalActivePaidUsers))

  if (totalActivePaidUsers > 0) {
    return {
      allocatedCostPerUserUsd:
        input.planPriceMonthlyUsd > 0 ? sharedFixedCostUsd / totalActivePaidUsers : 0,
      strategy: 'paid_only' as SharedCostAllocationStrategy,
    }
  }

  if (totalActiveUsers > 0) {
    return {
      allocatedCostPerUserUsd: sharedFixedCostUsd / totalActiveUsers,
      strategy: 'all_active' as SharedCostAllocationStrategy,
    }
  }

  return { allocatedCostPerUserUsd: 0, strategy: 'none' as SharedCostAllocationStrategy }
}

export function calculatePaymentFeeMonthlyUsd(input: {
  priceMonthlyUsd: number
  paymentFeePct: number
  paymentFeeFixedUsd: number
}) {
  const priceMonthlyUsd = clampNonNegative(input.priceMonthlyUsd)
  if (priceMonthlyUsd <= 0) return 0

  return (
    priceMonthlyUsd * clampProbability(input.paymentFeePct, DEFAULT_BUSINESS_ASSUMPTIONS.paymentFeePct) +
    clampNonNegative(input.paymentFeeFixedUsd)
  )
}

export function calculateRequiredPriceForMargin(costUsd: number, targetGrossMarginPct: number): number | null {
  const safeCostUsd = clampNonNegative(costUsd)
  const safeTargetMarginPct = normalizeMarginPct(targetGrossMarginPct)
  const denominator = 1 - safeTargetMarginPct

  if (safeCostUsd <= 0 || denominator <= 0) return null
  return safeCostUsd / denominator
}

export function roundUpPriceUsd(value: number) {
  const safeValue = clampNonNegative(value)
  if (safeValue <= 0) return 0
  if (safeValue < 20) return Math.ceil(safeValue)
  if (safeValue < 100) return Math.ceil(safeValue / 5) * 5
  return Math.ceil(safeValue / 10) * 10
}

function roundBytesUp(value: number, step: number) {
  if (!Number.isFinite(value) || value <= 0) return step
  return Math.ceil(value / step) * step
}

export function calculateRecommendedStorageLimitBytes(input: {
  currentStorageLimitBytes: number
  avgStorageUsedBytes: number
  p95StorageUsedBytes: number
}) {
  const current = clampNonNegative(input.currentStorageLimitBytes)
  const avgUsed = clampNonNegative(input.avgStorageUsedBytes)
  const p95Used = clampNonNegative(input.p95StorageUsedBytes)
  const baseline = Math.max(50 * 1024 * 1024, avgUsed * 2, p95Used * 1.25)

  if (baseline <= 1024 * 1024 * 1024) {
    return Math.min(current || baseline, roundBytesUp(baseline, 100 * 1024 * 1024))
  }

  return Math.min(current || baseline, roundBytesUp(baseline, 512 * 1024 * 1024))
}

export function calculateUpgradePressureScore(input: {
  extractionRatio: number
  chatRatio: number
  storageRatio: number
}) {
  const weighted =
    clampNonNegative(input.extractionRatio) * 0.45 +
    clampNonNegative(input.chatRatio) * 0.35 +
    clampNonNegative(input.storageRatio) * 0.2

  return Math.max(0, Math.min(100, Math.round(weighted * 100)))
}

export function calculateMonthlyRunRate(periodCostUsd: number, periodDays: number) {
  const safeCost = clampNonNegative(periodCostUsd)
  const safeDays = Number.isFinite(periodDays) && periodDays > 0 ? periodDays : 30
  return (safeCost / safeDays) * 30
}

export function calculateGrossMarginPct(revenueUsd: number, costUsd: number): number | null {
  const safeRevenue = clampNonNegative(revenueUsd)
  const safeCost = clampNonNegative(costUsd)
  if (safeRevenue <= 0) {
    if (safeCost <= 0) return 0
    return -1
  }
  return (safeRevenue - safeCost) / safeRevenue
}

export function calculateMaxVariableCostAllowed(revenueUsd: number, targetGrossMarginPct: number) {
  const safeRevenue = clampNonNegative(revenueUsd)
  const safeTargetMargin = normalizeMarginPct(targetGrossMarginPct)
  return safeRevenue * (1 - safeTargetMargin)
}

export function calculateProjectedPlanCapCost(input: {
  extractionsPerDay: number
  avgExtractionCostUsd: number
  chatTokensPerDay: number
  avgChatCostPerTokenUsd: number
  avgMonthlyStorageCostUsd?: number
  storageCapCostUsd?: number
}) {
  const extractionCapCost =
    clampNonNegative(input.extractionsPerDay) * 30 * clampNonNegative(input.avgExtractionCostUsd)
  const chatCapCost =
    clampNonNegative(input.chatTokensPerDay) * 30 * clampNonNegative(input.avgChatCostPerTokenUsd)
  const storageCost = clampNonNegative(
    input.storageCapCostUsd ?? input.avgMonthlyStorageCostUsd ?? 0
  )

  return {
    extractionCapCostUsd: extractionCapCost,
    chatCapCostUsd: chatCapCost,
    storageCapCostUsd: storageCost,
    totalCostUsd: extractionCapCost + chatCapCost + storageCost,
  }
}

export function calculateRecommendedExtractionsPerDay(input: {
  maxVariableCostAllowedUsd: number
  avgExtractionCostUsd: number
  currentChatCapCostUsd: number
  currentStorageCostUsd?: number
}) {
  const unitCost = clampNonNegative(input.avgExtractionCostUsd)
  if (unitCost <= 0) return null

  const remainingBudget =
    clampNonNegative(input.maxVariableCostAllowedUsd) -
    clampNonNegative(input.currentChatCapCostUsd) -
    clampNonNegative(input.currentStorageCostUsd ?? 0)

  if (remainingBudget <= 0) return 0
  return Math.max(0, Math.floor(remainingBudget / (unitCost * 30)))
}

export function calculateRecommendedChatTokensPerDay(input: {
  maxVariableCostAllowedUsd: number
  avgChatCostPerTokenUsd: number
  currentExtractionCapCostUsd: number
  currentStorageCostUsd?: number
}) {
  const unitCost = clampNonNegative(input.avgChatCostPerTokenUsd)
  if (unitCost <= 0) return null

  const remainingBudget =
    clampNonNegative(input.maxVariableCostAllowedUsd) -
    clampNonNegative(input.currentExtractionCapCostUsd) -
    clampNonNegative(input.currentStorageCostUsd ?? 0)

  if (remainingBudget <= 0) return 0
  return Math.max(0, Math.floor(remainingBudget / (unitCost * 30)))
}

export function classifyProfitabilityStatus(input: {
  actualMarginPct: number | null
  projectedMarginPct: number | null
  targetGrossMarginPct: number
}) {
  const target = normalizeMarginPct(input.targetGrossMarginPct)
  const actual = input.actualMarginPct
  const projected = input.projectedMarginPct

  if ((actual ?? 0) < 0 || (projected ?? 0) < 0) {
    return 'unprofitable' satisfies ProfitabilityStatus
  }

  if ((actual ?? 1) < target || (projected ?? 1) < target) {
    return 'at_risk' satisfies ProfitabilityStatus
  }

  return 'healthy' satisfies ProfitabilityStatus
}

export function deriveScenarioRecommendation(input: {
  planName: string
  targetGrossMarginPct: number
  actualMarginPct: number | null
  projectedMarginPct: number | null
  p95MarginPct: number | null
  currentExtractionsPerDay: number
  recommendedExtractionsPerDay: number | null
  currentChatTokensPerDay: number
  recommendedChatTokensPerDay: number | null
  currentStorageLimitBytes: number
  recommendedStorageLimitBytes: number | null
  upgradePressureScore: number
  unprofitableUsers: number
  activeUsers: number
}): ScenarioRecommendationResult {
  if (input.planName === 'free') {
    return {
      recommendation: 'acquisition_mode',
      reason:
        input.upgradePressureScore >= 60
          ? 'Plan de adquisición con presión de upgrade suficiente; revisar límites sin monetizarlo directamente.'
          : 'Plan de adquisición; controlar costo y mantener presión moderada hacia upgrade.',
    }
  }

  const target = normalizeMarginPct(input.targetGrossMarginPct)
  const actual = input.actualMarginPct
  const projected = input.projectedMarginPct
  const p95 = input.p95MarginPct
  const belowTargetCount = [actual, projected, p95].filter(
    (value) => value !== null && value < target
  ).length
  const hardLoss = [actual, projected, p95].some((value) => value !== null && value < 0)
  const lowerExtraction =
    input.recommendedExtractionsPerDay !== null &&
    input.recommendedExtractionsPerDay < input.currentExtractionsPerDay
  const lowerChat =
    input.recommendedChatTokensPerDay !== null &&
    input.recommendedChatTokensPerDay < input.currentChatTokensPerDay
  const lowerStorage =
    input.recommendedStorageLimitBytes !== null &&
    input.recommendedStorageLimitBytes < input.currentStorageLimitBytes * 0.95
  const shouldTightenLimits = lowerExtraction || lowerChat || lowerStorage
  const highRiskShare =
    input.activeUsers > 0 ? input.unprofitableUsers / input.activeUsers >= 0.2 : false

  if (hardLoss) {
    return shouldTightenLimits
      ? {
          recommendation: 'raise_price_and_lower_limits',
          reason: 'El plan pierde dinero en escenarios reales/extremos; requiere precio y topes más conservadores.',
        }
      : {
          recommendation: 'raise_price',
          reason: 'El plan pierde dinero y no hay espacio suficiente vía límites; el precio debe subir.',
        }
  }

  if (belowTargetCount >= 2 || highRiskShare) {
    return shouldTightenLimits
      ? {
          recommendation: 'raise_price_and_lower_limits',
          reason: 'El margen cae por debajo de la meta en múltiples vistas; conviene subir precio y recortar topes.',
        }
      : {
          recommendation: 'raise_price',
          reason: 'El margen está por debajo de la meta y el principal ajuste debería venir por precio.',
        }
  }

  if (shouldTightenLimits) {
    return {
      recommendation: 'lower_limits',
      reason:
        input.upgradePressureScore >= 65
          ? 'El uso se acerca a los topes y conviene estrechar límites para mejorar margen y empujar upgrade.'
          : 'El plan es rentable, pero los topes actuales son más amplios de lo necesario.',
    }
  }

  return {
    recommendation: 'keep',
    reason: 'La combinación actual de precio y límites está alineada con la meta de margen.',
  }
}
