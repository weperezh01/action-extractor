export type ExtractionOutputLanguage = 'auto' | 'es' | 'en'
export type ResolvedExtractionOutputLanguage = 'es' | 'en'
export type ExtractionOutputLanguageUiLang = 'en' | 'es'

export interface ExtractionOutputLanguageOption {
  value: ExtractionOutputLanguage
  label: string
  description: string
}

export const DEFAULT_EXTRACTION_OUTPUT_LANGUAGE: ExtractionOutputLanguage = 'auto'

const EXTRACTION_OUTPUT_LANGUAGE_COPY: Record<
  ExtractionOutputLanguageUiLang,
  Record<ExtractionOutputLanguage, { label: string; description: string }>
> = {
  en: {
    auto: {
      label: 'Automatic',
      description: 'Detect the source language',
    },
    es: {
      label: 'Spanish',
      description: 'Force output in Spanish',
    },
    en: {
      label: 'English',
      description: 'Force output in English',
    },
  },
  es: {
    auto: {
      label: 'Automático',
      description: 'Detecta idioma del contenido',
    },
    es: {
      label: 'Español',
      description: 'Salida forzada en español',
    },
    en: {
      label: 'Inglés',
      description: 'Salida forzada en inglés',
    },
  },
}

export function getExtractionOutputLanguageOptions(
  lang: ExtractionOutputLanguageUiLang = 'es'
): readonly ExtractionOutputLanguageOption[] {
  return (Object.keys(EXTRACTION_OUTPUT_LANGUAGE_COPY[lang]) as ExtractionOutputLanguage[]).map(
    (value) => ({
      value,
      label: EXTRACTION_OUTPUT_LANGUAGE_COPY[lang][value].label,
      description: EXTRACTION_OUTPUT_LANGUAGE_COPY[lang][value].description,
    }),
  )
}

export const EXTRACTION_OUTPUT_LANGUAGE_OPTIONS: readonly ExtractionOutputLanguageOption[] =
  getExtractionOutputLanguageOptions('es')

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

export function getExtractionOutputLanguageLabel(
  value: ExtractionOutputLanguage,
  lang: ExtractionOutputLanguageUiLang = 'es'
) {
  return EXTRACTION_OUTPUT_LANGUAGE_COPY[lang][value]?.label ?? EXTRACTION_OUTPUT_LANGUAGE_COPY.es.auto.label
}
