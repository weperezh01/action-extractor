import { describe, expect, it } from 'vitest'
import {
  calculateGrossMarginPct,
  calculateMaxVariableCostAllowed,
  calculateMonthlyRunRate,
  calculateProjectedPlanCapCost,
  calculateRecommendedChatTokensPerDay,
  calculateRecommendedExtractionsPerDay,
  classifyProfitabilityStatus,
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
})
