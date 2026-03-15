export type ExtractionMode =
  | 'action_plan'
  | 'executive_summary'
  | 'business_ideas'
  | 'key_quotes'
  | 'concept_map'

export type ExtractionModeUiLang = 'en' | 'es'

export interface ExtractionModeOption {
  value: ExtractionMode
  label: string
  description: string
}

export const DEFAULT_EXTRACTION_MODE: ExtractionMode = 'action_plan'

const EXTRACTION_MODE_COPY: Record<
  ExtractionModeUiLang,
  Record<ExtractionMode, { label: string; description: string }>
> = {
  en: {
    action_plan: {
      label: 'Action Plan',
      description: 'Executable steps by phases',
    },
    executive_summary: {
      label: 'Executive Summary',
      description: 'Key ideas to decide quickly',
    },
    business_ideas: {
      label: 'Business Ideas',
      description: 'Opportunities, monetization, and validation',
    },
    key_quotes: {
      label: 'Key Quotes',
      description: 'Verbatim quotes with practical context',
    },
    concept_map: {
      label: 'Concept Map',
      description: 'Key concepts and relationships',
    },
  },
  es: {
    action_plan: {
      label: 'Plan de Acción',
      description: 'Pasos ejecutables por fases',
    },
    executive_summary: {
      label: 'Resumen Ejecutivo',
      description: 'Ideas clave para decidir rápido',
    },
    business_ideas: {
      label: 'Ideas de Negocio',
      description: 'Oportunidades, monetización y validación',
    },
    key_quotes: {
      label: 'Frases Clave',
      description: 'Citas textuales con contexto práctico',
    },
    concept_map: {
      label: 'Mapa Conceptual',
      description: 'Conceptos y relaciones clave',
    },
  },
}

export function getExtractionModeOptions(
  lang: ExtractionModeUiLang = 'es'
): readonly ExtractionModeOption[] {
  return (Object.keys(EXTRACTION_MODE_COPY[lang]) as ExtractionMode[]).map((value) => ({
    value,
    label: EXTRACTION_MODE_COPY[lang][value].label,
    description: EXTRACTION_MODE_COPY[lang][value].description,
  }))
}

export const EXTRACTION_MODE_OPTIONS: readonly ExtractionModeOption[] = getExtractionModeOptions('es')

const EXTRACTION_MODE_SET = new Set<ExtractionMode>(
  EXTRACTION_MODE_OPTIONS.map((option) => option.value)
)

export function isExtractionMode(value: unknown): value is ExtractionMode {
  return typeof value === 'string' && EXTRACTION_MODE_SET.has(value as ExtractionMode)
}

export function normalizeExtractionMode(value: unknown): ExtractionMode {
  return isExtractionMode(value) ? value : DEFAULT_EXTRACTION_MODE
}

export function getExtractionModeLabel(
  mode: ExtractionMode,
  lang: ExtractionModeUiLang = 'es'
) {
  return EXTRACTION_MODE_COPY[lang][mode]?.label ?? EXTRACTION_MODE_COPY.es.action_plan.label
}

export function getExtractionModeDescription(
  mode: ExtractionMode,
  lang: ExtractionModeUiLang = 'es'
) {
  return EXTRACTION_MODE_COPY[lang][mode]?.description ?? EXTRACTION_MODE_COPY.es.action_plan.description
}
