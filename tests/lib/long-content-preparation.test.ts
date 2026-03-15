import { beforeEach, describe, expect, it, vi } from 'vitest'

const callAiMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/ai-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai-client')>('@/lib/ai-client')
  return {
    ...actual,
    AI_PRICING_VERSION: 'test-pricing',
    callAi: callAiMock,
    estimateCostUsd: vi.fn(() => 0),
  }
})

import { MAX_AI_CHARS } from '@/lib/content-extractor'
import {
  prepareContentForExtraction,
  splitTextIntoPreparationChunks,
  type LongContentPreparationProgress,
  type LongContentUsageEvent,
} from '@/lib/long-content-preparation'

function buildLongText(paragraphs = 180) {
  return Array.from({ length: paragraphs }, (_, index) => {
    const label = `P${String(index).padStart(3, '0')}`
    return `${label} ${'Contenido importante y accionable '.repeat(18)}${'Dato clave '.repeat(10)}`
  }).join('\n\n')
}

function chunkSummaryJson(label: string) {
  return JSON.stringify({
    resumen: `Resumen de ${label}`,
    ideasClave: [`Idea ${label}`],
    acciones: [`Accion ${label}`],
    metricas: [`Metrica ${label}`],
    riesgos: [`Riesgo ${label}`],
    citas: [`Cita ${label}`],
    entidades: [`Entidad ${label}`],
  })
}

function compactAggregateText(label = 'compacto') {
  return [
    'RESUMEN GENERAL',
    `Sintesis ${label}.`,
    '',
    'ACCIONES Y PROCESOS',
    '- accion principal',
    '',
    'HECHOS Y METRICAS',
    '- metrica principal',
    '',
    'RIESGOS Y LIMITES',
    '- riesgo principal',
    '',
    'CITAS Y DETALLES RELEVANTES',
    '- cita principal',
    '',
    'ENTIDADES Y TERMINOS CLAVE',
    '- entidad principal',
  ].join('\n')
}

describe('lib/long-content-preparation', () => {
  beforeEach(() => {
    callAiMock.mockReset()
  })

  it('divide contenido largo en multiples chunks con overlap', () => {
    const text = buildLongText(80)
    const chunks = splitTextIntoPreparationChunks(text)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]?.includes('P000')).toBe(true)
    expect(chunks.at(-1)?.includes('P079')).toBe(true)
    expect(chunks.every((chunk) => chunk.length <= 16_500)).toBe(true)

    const duplicatedLabels = Array.from({ length: 80 }, (_, index) => `P${String(index).padStart(3, '0')}`).filter(
      (label) => chunks.filter((chunk) => chunk.includes(label)).length >= 2
    )
    expect(duplicatedLabels.length).toBeGreaterThan(0)
  })

  it('mantiene contenido corto sin llamadas extra a IA', async () => {
    const result = await prepareContentForExtraction({
      text: 'Resumen corto.\n\nCon pocos caracteres.',
      provider: 'openai',
      model: 'gpt-4o-mini',
    })

    expect(result).toMatchObject({
      finalText: 'Resumen corto.\n\nCon pocos caracteres.',
      usedChunking: false,
      chunkCount: 1,
      truncated: false,
    })
    expect(callAiMock).not.toHaveBeenCalled()
  })

  it('resume por chunks y agrega progreso para contenido largo', async () => {
    callAiMock.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
      const prompt = messages[0]?.content ?? ''
      if (prompt.includes('RESUMENES DE SEGMENTOS')) {
        return {
          text: compactAggregateText(),
          inputTokens: 120,
          outputTokens: 60,
        }
      }

      const match = prompt.match(/SEGMENTO (\d+)\/(\d+)/)
      const label = match ? `${match[1]}/${match[2]}` : 'segmento'
      return {
        text: chunkSummaryJson(label),
        inputTokens: 40,
        outputTokens: 20,
      }
    })

    const progress: LongContentPreparationProgress[] = []
    const usages: LongContentUsageEvent[] = []

    const result = await prepareContentForExtraction({
      text: buildLongText(),
      provider: 'openai',
      model: 'gpt-4o-mini',
      onProgress: (entry) => progress.push(entry),
      onUsage: (entry) => {
        usages.push(entry)
      },
    })

    expect(result.usedChunking).toBe(true)
    expect(result.chunkCount).toBeGreaterThan(1)
    expect(result.finalText).toContain('RESUMEN GENERAL')
    expect(result.finalText.length).toBeLessThanOrEqual(MAX_AI_CHARS)
    expect(result.truncated).toBe(false)
    expect(progress.map((entry) => entry.step)).toEqual(
      expect.arrayContaining([
        'chunking',
        'chunk-summary-start',
        'chunk-summary-progress',
        'chunk-summary-complete',
        'aggregate-long-content',
      ])
    )
    expect(usages).toHaveLength(result.chunkCount + 1)
    expect(callAiMock).toHaveBeenCalledTimes(result.chunkCount + 1)
  })

  it('repara JSON inválido de un chunk antes de continuar', async () => {
    let repaired = false

    callAiMock.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
      const prompt = messages[0]?.content ?? ''

      if (prompt.includes('RESUMENES DE SEGMENTOS')) {
        return {
          text: compactAggregateText('reparado'),
          inputTokens: 120,
          outputTokens: 60,
        }
      }

      if (prompt.includes('Convierte el siguiente contenido en JSON válido')) {
        repaired = true
        return {
          text: chunkSummaryJson('repair'),
          inputTokens: 30,
          outputTokens: 15,
        }
      }

      if (!repaired) {
        return {
          text: '```json\n{"resumen":"roto"',
          inputTokens: 30,
          outputTokens: 15,
        }
      }

      return {
        text: chunkSummaryJson('ok'),
        inputTokens: 30,
        outputTokens: 15,
      }
    })

    const usages: LongContentUsageEvent[] = []

    const result = await prepareContentForExtraction({
      text: buildLongText(),
      provider: 'openai',
      model: 'gpt-4o-mini',
      onUsage: (entry) => {
        usages.push(entry)
      },
    })

    expect(result.finalText).toContain('RESUMEN GENERAL')
    expect(usages.some((entry) => entry.useType === 'repair')).toBe(true)
  })

  it('compacta una vez mas si la primera agregacion sigue demasiado larga', async () => {
    callAiMock.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
      const prompt = messages[0]?.content ?? ''

      if (prompt.includes('RESUMENES DE SEGMENTOS')) {
        if (prompt.includes('PASADA 4')) {
          return {
            text: compactAggregateText('segunda compactacion'),
            inputTokens: 140,
            outputTokens: 70,
          }
        }

        return {
          text: `RESUMEN GENERAL\n${'A'.repeat(MAX_AI_CHARS + 2_000)}`,
          inputTokens: 140,
          outputTokens: 70,
        }
      }

      return {
        text: chunkSummaryJson('largo'),
        inputTokens: 40,
        outputTokens: 20,
      }
    })

    const progress: LongContentPreparationProgress[] = []

    const result = await prepareContentForExtraction({
      text: buildLongText(),
      provider: 'openai',
      model: 'gpt-4o-mini',
      onProgress: (entry) => progress.push(entry),
    })

    expect(result.finalText).toContain('segunda compactacion')
    expect(result.truncated).toBe(false)
    expect(progress.map((entry) => entry.step)).toContain('aggregate-long-content-repair')
  })
})
