export type ExtractionOutputLanguage = 'auto' | 'es' | 'en'
export type ResolvedExtractionOutputLanguage = 'es' | 'en'

export interface ExtractionOutputLanguageOption {
  value: ExtractionOutputLanguage
  label: string
  description: string
}

export const DEFAULT_EXTRACTION_OUTPUT_LANGUAGE: ExtractionOutputLanguage = 'auto'

export const EXTRACTION_OUTPUT_LANGUAGE_OPTIONS: readonly ExtractionOutputLanguageOption[] = [
  {
    value: 'auto',
    label: 'Automático',
    description: 'Detecta idioma del video',
  },
  {
    value: 'es',
    label: 'Español',
    description: 'Salida forzada en español',
  },
  {
    value: 'en',
    label: 'English',
    description: 'Force output in English',
  },
]

const EXTRACTION_OUTPUT_LANGUAGE_SET = new Set<ExtractionOutputLanguage>(
  EXTRACTION_OUTPUT_LANGUAGE_OPTIONS.map((option) => option.value)
)

const SPANISH_HINTS = [
  'que',
  'de',
  'la',
  'el',
  'los',
  'las',
  'para',
  'con',
  'como',
  'porque',
  'cuando',
  'tambien',
  'negocio',
  'ventas',
  'dinero',
  'estrategia',
]

const ENGLISH_HINTS = [
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'because',
  'when',
  'business',
  'sales',
  'market',
  'strategy',
  'money',
]

function countHints(text: string, hints: string[]) {
  const words = text.split(/\s+/)
  if (!words.length) return 0

  let score = 0
  for (const word of words) {
    if (hints.includes(word)) score += 1
  }

  return score
}

export function isExtractionOutputLanguage(value: unknown): value is ExtractionOutputLanguage {
  return typeof value === 'string' && EXTRACTION_OUTPUT_LANGUAGE_SET.has(value as ExtractionOutputLanguage)
}

export function normalizeExtractionOutputLanguage(value: unknown): ExtractionOutputLanguage {
  return isExtractionOutputLanguage(value) ? value : DEFAULT_EXTRACTION_OUTPUT_LANGUAGE
}

export function detectTranscriptLanguage(transcript: string): ResolvedExtractionOutputLanguage {
  const normalized = transcript
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[^a-zñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return 'es'

  const sample = normalized.slice(0, 20_000)
  let spanishScore = countHints(sample, SPANISH_HINTS)
  let englishScore = countHints(sample, ENGLISH_HINTS)

  if (/[ñ¿¡]/.test(transcript)) {
    spanishScore += 4
  }

  if (englishScore > spanishScore * 1.15) {
    return 'en'
  }

  return 'es'
}

export function resolveExtractionOutputLanguage(
  requestedLanguage: ExtractionOutputLanguage,
  transcript: string
): ResolvedExtractionOutputLanguage {
  if (requestedLanguage === 'auto') {
    return detectTranscriptLanguage(transcript)
  }

  return requestedLanguage
}

export function getExtractionOutputLanguageLabel(value: ExtractionOutputLanguage) {
  const found = EXTRACTION_OUTPUT_LANGUAGE_OPTIONS.find((option) => option.value === value)
  return found?.label ?? 'Automático'
}

