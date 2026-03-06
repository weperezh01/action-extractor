export type ProfitabilityStatus = 'healthy' | 'at_risk' | 'unprofitable'

function clampNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function normalizeMarginPct(value: number | null | undefined, fallback = 0.75) {
  if (!Number.isFinite(value ?? NaN)) return fallback
  return Math.min(0.99, Math.max(0, Number(value)))
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
}) {
  const extractionCapCost =
    clampNonNegative(input.extractionsPerDay) * 30 * clampNonNegative(input.avgExtractionCostUsd)
  const chatCapCost =
    clampNonNegative(input.chatTokensPerDay) * 30 * clampNonNegative(input.avgChatCostPerTokenUsd)
  const storageCost = clampNonNegative(input.avgMonthlyStorageCostUsd ?? 0)

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
