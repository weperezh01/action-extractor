import { describe, expect, it } from 'vitest'
import { estimateTime, extractVideoId, parseExtractionModelText } from '@/lib/extract-core'

const TIME_DATA = {
  originalTime: '1h 0m',
  savedTime: '57m',
}

describe('lib/extract-core', () => {
  describe('extractVideoId', () => {
    it('extrae el video id desde una URL watch', () => {
      expect(extractVideoId('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toBe('jNQXAC9IVRw')
    })

    it('extrae el video id desde una URL corta', () => {
      expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=43')).toBe('dQw4w9WgXcQ')
    })

    it('retorna null para URL no válida', () => {
      expect(extractVideoId('https://example.com/video/123')).toBeNull()
    })
  })

  describe('estimateTime', () => {
    it('calcula tiempos original y ahorrado', () => {
      expect(estimateTime(3000)).toEqual({
        originalTime: '20m',
        savedTime: '17m',
      })
    })
  })

  describe('parseExtractionModelText', () => {
    it('parsea JSON válido con structure completa', () => {
      const input = JSON.stringify({
        objective: 'Objetivo principal',
        phases: [{ id: 1, title: 'Fase 1', items: ['Acción A', 'Acción B'] }],
        proTip: 'Consejo',
        metadata: { readingTime: '4 min', difficulty: 'Difícil' },
      })

      const result = parseExtractionModelText(input, TIME_DATA, 'action_plan', 'es')

      expect(result.mode).toBe('action_plan')
      expect(result.objective).toBe('Objetivo principal')
      expect(result.phases).toHaveLength(1)
      expect(result.metadata).toEqual({
        readingTime: '4 min',
        difficulty: 'Difícil',
        originalTime: '1h 0m',
        savedTime: '57m',
      })
    })

    it('repara comas colgantes y parsea JSON dentro de fenced block', () => {
      const input = `Respuesta final:\n\n\`\`\`json
{
  "objective": "Objetivo",
  "phases": [
    {
      "id": 1,
      "title": "Fase 1",
      "items": ["Uno", "Dos",],
    },
  ],
  "proTip": "Tip",
  "metadata": {
    "readingTime": "3 min",
    "difficulty": "Media",
  },
}
\`\`\``

      const result = parseExtractionModelText(input, TIME_DATA, 'executive_summary', 'es')

      expect(result.mode).toBe('executive_summary')
      expect(result.objective).toBe('Objetivo')
      expect(result.proTip).toBe('Tip')
      expect(result.phases).toHaveLength(1)
    })

    it('usa defaults cuando faltan campos opcionales', () => {
      const input = JSON.stringify({
        objective: 123,
        phases: 'invalid',
        proTip: null,
      })

      const result = parseExtractionModelText(input, TIME_DATA, 'business_ideas', 'en')

      expect(result.objective).toBe('')
      expect(result.phases).toEqual([])
      expect(result.proTip).toBe('')
      expect(result.metadata.readingTime).toBe('3 min')
      expect(result.metadata.difficulty).toBe('Medium')
    })

    it('lanza error si no puede obtener JSON', () => {
      expect(() => parseExtractionModelText('no-json-at-all', TIME_DATA, 'key_quotes', 'es')).toThrow(
        'El modelo devolvió JSON inválido. Intenta de nuevo.'
      )
    })
  })
})
