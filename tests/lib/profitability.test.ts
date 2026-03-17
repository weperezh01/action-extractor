import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BUSINESS_ASSUMPTIONS,
  calculatePaymentFeeMonthlyUsd,
  calculateRecommendedStorageLimitBytes,
  calculateRequiredPriceForMargin,
  calculateSharedFixedCostAllocationPerUser,
  calculateUpgradePressureScore,
  calculateGrossMarginPct,
  calculateMaxVariableCostAllowed,
  calculateMonthlyRunRate,
  calculateProjectedPlanCapCost,
  calculateRecommendedChatTokensPerDay,
  calculateRecommendedExtractionsPerDay,
  classifyProfitabilityStatus,
  deriveScenarioRecommendation,
  normalizeBusinessAssumptions,
  normalizeMarginPct,
} from '@/lib/profitability'

describe('lib/profitability', () => {
  it('normaliza el target de margen dentro del rango permitido', () => {
    expect(normalizeMarginPct(undefined)).toBe(0.75)
    expect(normalizeMarginPct(-1)).toBe(0)
    expect(normalizeMarginPct(1.5)).toBe(0.99)
    expect(normalizeMarginPct(0.8)).toBe(0.8)
  })

  it('calcula run rate mensual y margen bruto correctamente', () => {
    expect(calculateMonthlyRunRate(12, 30)).toBe(12)
    expect(calculateMonthlyRunRate(6, 15)).toBe(12)
    expect(calculateGrossMarginPct(100, 25)).toBe(0.75)
    expect(calculateGrossMarginPct(0, 10)).toBe(-1)
  })

  it('proyecta costo mensual al tope actual del plan', () => {
    expect(
      calculateProjectedPlanCapCost({
        extractionsPerDay: 3,
        avgExtractionCostUsd: 0.2,
        chatTokensPerDay: 10000,
        avgChatCostPerTokenUsd: 0.000001,
        avgMonthlyStorageCostUsd: 1.5,
      })
    ).toEqual({
      extractionCapCostUsd: 18,
      chatCapCostUsd: 0.3,
      storageCapCostUsd: 1.5,
      totalCostUsd: 19.8,
    })
  })

  it('recomienda nuevos límites según presupuesto variable disponible', () => {
    expect(
      calculateRecommendedExtractionsPerDay({
        maxVariableCostAllowedUsd: 20,
        avgExtractionCostUsd: 0.25,
        currentChatCapCostUsd: 2,
        currentStorageCostUsd: 3,
      })
    ).toBe(2)

    expect(
      calculateRecommendedChatTokensPerDay({
        maxVariableCostAllowedUsd: 25,
        avgChatCostPerTokenUsd: 0.000002,
        currentExtractionCapCostUsd: 10,
        currentStorageCostUsd: 3,
      })
    ).toBe(200000)
  })

  it('clasifica salud, riesgo y pérdida', () => {
    expect(
      classifyProfitabilityStatus({
        actualMarginPct: 0.8,
        projectedMarginPct: 0.78,
        targetGrossMarginPct: 0.75,
      })
    ).toBe('healthy')

    expect(
      classifyProfitabilityStatus({
        actualMarginPct: 0.7,
        projectedMarginPct: 0.76,
        targetGrossMarginPct: 0.75,
      })
    ).toBe('at_risk')

    expect(
      classifyProfitabilityStatus({
        actualMarginPct: -0.2,
        projectedMarginPct: 0.1,
        targetGrossMarginPct: 0.75,
      })
    ).toBe('unprofitable')
  })

  it('calcula el máximo costo variable permitido según margen objetivo', () => {
    expect(calculateMaxVariableCostAllowed(40, 0.75)).toBe(10)
  })

  it('normaliza supuestos de negocio y usa defaults seguros', () => {
    expect(
      normalizeBusinessAssumptions({
        paymentFeePct: 2,
        paymentFeeFixedUsd: -4,
        targetPaybackMonths: 0,
      })
    ).toEqual({
      ...DEFAULT_BUSINESS_ASSUMPTIONS,
      paymentFeePct: 0.99,
      paymentFeeFixedUsd: 0,
      targetPaybackMonths: 1,
    })
  })

  it('asigna costo fijo compartido a pagados o a todos si no hay pagados', () => {
    expect(
      calculateSharedFixedCostAllocationPerUser({
        sharedFixedCostUsd: 1000,
        totalActiveUsers: 20,
        totalActivePaidUsers: 10,
        planPriceMonthlyUsd: 29,
      })
    ).toEqual({
      allocatedCostPerUserUsd: 100,
      strategy: 'paid_only',
    })

    expect(
      calculateSharedFixedCostAllocationPerUser({
        sharedFixedCostUsd: 1000,
        totalActiveUsers: 20,
        totalActivePaidUsers: 10,
        planPriceMonthlyUsd: 0,
      })
    ).toEqual({
      allocatedCostPerUserUsd: 0,
      strategy: 'paid_only',
    })

    expect(
      calculateSharedFixedCostAllocationPerUser({
        sharedFixedCostUsd: 1000,
        totalActiveUsers: 20,
        totalActivePaidUsers: 0,
        planPriceMonthlyUsd: 0,
      })
    ).toEqual({
      allocatedCostPerUserUsd: 50,
      strategy: 'all_active',
    })
  })

  it('calcula fee de cobro, precio requerido y storage recomendado', () => {
    expect(
      calculatePaymentFeeMonthlyUsd({
        priceMonthlyUsd: 29,
        paymentFeePct: 0.03,
        paymentFeeFixedUsd: 0.3,
      })
    ).toBeCloseTo(1.17, 5)

    expect(calculateRequiredPriceForMargin(12, 0.75)).toBe(48)

    expect(
      calculateRecommendedStorageLimitBytes({
        currentStorageLimitBytes: 2 * 1024 * 1024 * 1024,
        avgStorageUsedBytes: 220 * 1024 * 1024,
        p95StorageUsedBytes: 480 * 1024 * 1024,
      })
    ).toBe(600 * 1024 * 1024)
  })

  it('calcula presión de upgrade y recomendación de escenario', () => {
    expect(
      calculateUpgradePressureScore({
        extractionRatio: 0.8,
        chatRatio: 0.5,
        storageRatio: 0.25,
      })
    ).toBe(59)

    expect(
      deriveScenarioRecommendation({
        planName: 'pro',
        targetGrossMarginPct: 0.75,
        actualMarginPct: 0.61,
        projectedMarginPct: 0.48,
        p95MarginPct: 0.42,
        currentExtractionsPerDay: 40,
        recommendedExtractionsPerDay: 24,
        currentChatTokensPerDay: 100000,
        recommendedChatTokensPerDay: 60000,
        currentStorageLimitBytes: 2 * 1024 * 1024 * 1024,
        recommendedStorageLimitBytes: 1024 * 1024 * 1024,
        upgradePressureScore: 68,
        unprofitableUsers: 3,
        activeUsers: 10,
      })
    ).toEqual({
      recommendation: 'raise_price_and_lower_limits',
      reason: 'El margen cae por debajo de la meta en múltiples vistas; conviene subir precio y recortar topes.',
    })
  })
})
