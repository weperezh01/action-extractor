export type ExtractionMode =
  | 'action_plan'
  | 'executive_summary'
  | 'business_ideas'
  | 'key_quotes'
  | 'concept_map'

export interface ExtractionModeOption {
  value: ExtractionMode
  label: string
  description: string
}

export const DEFAULT_EXTRACTION_MODE: ExtractionMode = 'action_plan'

export const EXTRACTION_MODE_OPTIONS: readonly ExtractionModeOption[] = [
  {
    value: 'action_plan',
    label: 'Plan de Acción',
    description: 'Pasos ejecutables por fases',
  },
  {
    value: 'executive_summary',
    label: 'Resumen Ejecutivo',
    description: 'Ideas clave para decidir rápido',
  },
  {
    value: 'business_ideas',
    label: 'Ideas de Negocio',
    description: 'Oportunidades, monetización y validación',
  },
  {
    value: 'key_quotes',
    label: 'Frases Clave',
    description: 'Citas textuales con contexto práctico',
  },
  {
    value: 'concept_map',
    label: 'Mapa Conceptual',
    description: 'Árbol de ideas y conceptos clave',
  },
]

const EXTRACTION_MODE_SET = new Set<ExtractionMode>(
  EXTRACTION_MODE_OPTIONS.map((option) => option.value)
)

export function isExtractionMode(value: unknown): value is ExtractionMode {
  return typeof value === 'string' && EXTRACTION_MODE_SET.has(value as ExtractionMode)
}

export function normalizeExtractionMode(value: unknown): ExtractionMode {
  return isExtractionMode(value) ? value : DEFAULT_EXTRACTION_MODE
}

export function getExtractionModeLabel(mode: ExtractionMode) {
  const found = EXTRACTION_MODE_OPTIONS.find((option) => option.value === mode)
  return found?.label ?? 'Plan de Acción'
}
