import { ExtractionMode, getExtractionModeLabel } from '@/lib/extraction-modes'
import {
  ExtractionOutputLanguage,
  ResolvedExtractionOutputLanguage,
} from '@/lib/output-language'

export interface ExtractPhase {
  id: number
  title: string
  items: string[]
}

export interface ExtractMetadata {
  readingTime: string
  difficulty: string
  originalTime: string
  savedTime: string
}

export interface ExtractResultPayload {
  mode: ExtractionMode
  objective: string
  phases: ExtractPhase[]
  proTip: string
  metadata: ExtractMetadata
}

export const EXTRACTION_MODEL =
  process.env.ACTION_EXTRACTOR_EXTRACTION_MODEL?.trim() || 'claude-sonnet-4-6'
export const EXTRACTION_PROMPT_VERSION = 'multi-mode-v3'

const MODE_PROMPT_VERSION: Record<ExtractionMode, string> = {
  action_plan: EXTRACTION_PROMPT_VERSION,
  executive_summary: EXTRACTION_PROMPT_VERSION,
  business_ideas: EXTRACTION_PROMPT_VERSION,
  key_quotes: EXTRACTION_PROMPT_VERSION,
  concept_map: EXTRACTION_PROMPT_VERSION,
}

export function getExtractionPromptVersion(
  mode: ExtractionMode,
  outputLanguage: ExtractionOutputLanguage = 'auto'
) {
  return `${MODE_PROMPT_VERSION[mode]}:${mode}:${outputLanguage}`
}

function buildLanguageResponseRule(language: ResolvedExtractionOutputLanguage) {
  return language === 'en' ? 'Respond only in English.' : 'Responde únicamente en español.'
}

function buildDifficultyRule(language: ResolvedExtractionOutputLanguage) {
  return language === 'en'
    ? 'Difficulty must be "Easy", "Medium" or "Hard" based on required resources/skills.'
    : 'La dificultad debe ser "Fácil", "Media" o "Difícil" según recursos/habilidades requeridas.'
}

function buildActionPlanSystemPrompt(language: ResolvedExtractionOutputLanguage) {
  return `Eres un estratega de negocios experto. Analizas transcripciones de videos/podcasts y conviertes contenido largo en salidas útiles para ejecución empresarial.

REGLAS GLOBALES:
- ${buildLanguageResponseRule(language)}
- Devuelve solo contenido accionable o estratégicamente relevante.
- ${buildDifficultyRule(language)}
- Mantén un tono directo, sin relleno.

REGLAS DEL MODO "PLAN DE ACCIÓN":
- Cada acción debe ser específica, medible y comenzar con verbo de acción.
- Elimina anécdotas, motivación genérica o consejos vagos.
- Genera entre 4 y 6 fases con 3 a 5 items por fase.
- El consejo pro debe ser la táctica más contraintuitiva o menos obvia.`
}

function buildExecutiveSummarySystemPrompt(language: ResolvedExtractionOutputLanguage) {
  return `Actúa como un Analista de Inteligencia de Negocios. Tu cliente es un CEO o inversor sin tiempo para ver un video largo.

OBJETIVO:
- Extraer la esencia del contenido para facilitar decisiones ejecutivas.

REGLAS GLOBALES:
- ${buildLanguageResponseRule(language)}
- Mantén concisión extrema: ideas directas, cero relleno.
- Prioriza tesis central, argumentos clave y métricas relevantes.
- Si no existen datos cuantitativos, indícalo explícitamente.`
}

function buildBusinessIdeasSystemPrompt(language: ResolvedExtractionOutputLanguage) {
  return `Actúa como un Inversor Ángel y Cazador de Tendencias. Analiza la transcripción para detectar oportunidades de mercado y modelos de monetización.

OBJETIVO:
- Traducir el contenido en ideas de negocio accionables.

REGLAS GLOBALES:
- ${buildLanguageResponseRule(language)}
- Todo debe estar orientado a creación de valor y dinero.
- Incluye validación rápida por idea (MVP barato y ágil).
- Señala riesgos reales y métricas de éxito inicial.`
}

function buildKeyQuotesSystemPrompt(language: ResolvedExtractionOutputLanguage) {
  return `Actúa como un Copywriter experto y Creador de Contenido. Tu trabajo es extraer frases memorables de negocio y su aplicación práctica.

OBJETIVO:
- Identificar citas de alto impacto y convertirlas en acción/comunicación.

REGLAS GLOBALES:
- ${buildLanguageResponseRule(language)}
- Prioriza frases que cambian perspectiva o revelan verdades incómodas.
- Si una frase no es textual exacta, marca claramente que es paráfrasis.
- Cada frase debe incluir interpretación práctica concreta.`
}

function buildConceptMapSystemPrompt(language: ResolvedExtractionOutputLanguage) {
  return `Actúa como un Experto en Síntesis del Conocimiento. Tu objetivo es mapear las ideas, conceptos y relaciones presentes en el contenido.

OBJETIVO:
- Construir un árbol jerárquico de conceptos: desde la idea central hasta sus ramas y subconceptos.

REGLAS GLOBALES:
- ${buildLanguageResponseRule(language)}
- Cada nodo debe ser una idea concisa (máximo 15 palabras).
- Las relaciones entre conceptos deben ser explícitas en los ítems de cada sección.
- Prioriza conceptos únicos y relaciones no obvias.
- Incluye de 4 a 6 ramas principales (fases) con 3 a 5 subconceptos cada una.
- ${buildDifficultyRule(language)}`
}

export function buildExtractionSystemPrompt(
  mode: ExtractionMode,
  outputLanguage: ResolvedExtractionOutputLanguage
) {
  switch (mode) {
    case 'executive_summary':
      return buildExecutiveSummarySystemPrompt(outputLanguage)
    case 'business_ideas':
      return buildBusinessIdeasSystemPrompt(outputLanguage)
    case 'key_quotes':
      return buildKeyQuotesSystemPrompt(outputLanguage)
    case 'concept_map':
      return buildConceptMapSystemPrompt(outputLanguage)
    case 'action_plan':
    default:
      return buildActionPlanSystemPrompt(outputLanguage)
  }
}

function buildActionPlanUserPrompt(
  transcript: string,
  mode: ExtractionMode,
  outputLanguage: ResolvedExtractionOutputLanguage
) {
  const languageLabel = outputLanguage === 'en' ? 'English' : 'Español'
  return `MODO SOLICITADO: ${getExtractionModeLabel(mode)}
IDIOMA DE SALIDA: ${languageLabel}

Analiza la transcripción y responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

{
  "objective": "Descripción en 1-2 oraciones del objetivo central del contenido",
  "phases": [
    {
      "id": 1,
      "title": "Fase 1: Nombre Descriptivo",
      "items": ["Acción específica 1", "Acción específica 2", "Acción específica 3"]
    }
  ],
  "proTip": "La táctica más específica y contraintuitiva del contenido",
  "metadata": {
    "difficulty": "Media",
    "readingTime": "3 min"
  }
}

TRANSCRIPCIÓN:
${transcript}`
}

function buildExecutiveSummaryUserPrompt(
  transcript: string,
  outputLanguage: ResolvedExtractionOutputLanguage
) {
  const languageLabel = outputLanguage === 'en' ? 'English' : 'Español'
  const noMetricsLabel =
    outputLanguage === 'en'
      ? 'No concrete metrics are mentioned'
      : 'No se mencionan métricas concretas'
  return `MODO SOLICITADO: Resumen Ejecutivo
IDIOMA DE SALIDA: ${languageLabel}

Analiza la transcripción como un informe para dirección general.

REGLAS DE SALIDA OBLIGATORIAS:
- Genera entre 4 y 6 secciones.
- Cada item debe ser breve (1 línea).
- Debe existir una sección con datos/métricas relevantes.
- Si no hay datos numéricos, incluye el item: "${noMetricsLabel}".
- Evita pasos operativos detallados.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

{
  "objective": "Tesis central del video en máximo 2 líneas",
  "phases": [
    {
      "id": 1,
      "title": "Sección 1: Tesis Central",
      "items": ["Argumento principal", "Implicación para dirección"]
    }
  ],
  "proTip": "Recomendación ejecutiva de mayor impacto",
  "metadata": {
    "difficulty": "Media",
    "readingTime": "3 min"
  }
}

TRANSCRIPCIÓN:
${transcript}`
}

function buildBusinessIdeasUserPrompt(
  transcript: string,
  outputLanguage: ResolvedExtractionOutputLanguage
) {
  const languageLabel = outputLanguage === 'en' ? 'English' : 'Español'
  return `MODO SOLICITADO: Ideas de Negocio
IDIOMA DE SALIDA: ${languageLabel}

Analiza la transcripción para descubrir oportunidades de mercado y monetización.

REGLAS DE SALIDA OBLIGATORIAS:
- Genera entre 4 y 5 oportunidades/secciones.
- Cada sección debe incluir items sobre: propuesta, monetización, validación rápida (MVP), métrica de éxito y riesgo principal.
- Cada item debe tener máximo 26 palabras.
- Evita párrafos largos y ejemplos extensos.
- Propón validaciones rápidas que puedan probarse con bajo costo y velocidad.
- Enfócate en claridad comercial, no en teoría.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

{
  "objective": "Oportunidad principal detectada en 1-2 líneas",
  "phases": [
    {
      "id": 1,
      "title": "Oportunidad 1: Nombre corto",
      "items": [
        "Monetización: cómo funciona y a quién se cobra",
        "MVP: experimento de validación rápida",
        "Métrica de éxito: señal objetiva inicial",
        "Riesgo principal: obstáculo crítico"
      ]
    }
  ],
  "proTip": "Idea con mayor potencial y motivo estratégico",
  "metadata": {
    "difficulty": "Media",
    "readingTime": "3 min"
  }
}

TRANSCRIPCIÓN:
${transcript}`
}

function buildKeyQuotesUserPrompt(
  transcript: string,
  outputLanguage: ResolvedExtractionOutputLanguage
) {
  const languageLabel = outputLanguage === 'en' ? 'English' : 'Español'
  const paraphraseLabel = outputLanguage === 'en' ? '[paraphrase]' : '[paráfrasis]'
  return `MODO SOLICITADO: Frases Clave
IDIOMA DE SALIDA: ${languageLabel}

Extrae frases impactantes de negocio y su traducción práctica.

REGLAS DE SALIDA OBLIGATORIAS:
- Genera entre 4 y 6 temas/secciones.
- Los items deben usar formato: "cita" - aplicación práctica.
- Si una cita no es literal, marca la cita con ${paraphraseLabel}.
- Incluye una sección final con una idea de post para redes sociales.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

{
  "objective": "Idea central que resume la lección del contenido",
  "phases": [
    {
      "id": 1,
      "title": "Tema 1: Frases de Alto Impacto",
      "items": [
        "\"Cita textual 1\" - aplicación práctica",
        "\"Cita textual 2\" - aplicación práctica"
      ]
    }
  ],
  "proTip": "Frase con mayor palanca de acción inmediata",
  "metadata": {
    "difficulty": "Media",
    "readingTime": "3 min"
  }
}

TRANSCRIPCIÓN:
${transcript}`
}

function buildConceptMapUserPrompt(
  transcript: string,
  outputLanguage: ResolvedExtractionOutputLanguage
) {
  const languageLabel = outputLanguage === 'en' ? 'English' : 'Español'
  return `MODO SOLICITADO: Mapa Conceptual
IDIOMA DE SALIDA: ${languageLabel}

Analiza la transcripción y construye un mapa conceptual jerárquico.

REGLAS DE SALIDA OBLIGATORIAS:
- Genera entre 4 y 6 ramas principales (fases/conceptos padre).
- Cada rama debe tener entre 3 y 5 subconceptos (ítems).
- Los ítems describen el subconcepto y su relación con la rama padre.
- El objetivo resume la idea central del contenido (máximo 2 líneas).
- El proTip debe ser el concepto más contraintuitivo o menos conocido.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

{
  "objective": "Concepto central del contenido en máximo 2 líneas",
  "phases": [
    {
      "id": 1,
      "title": "Concepto 1: Nombre del nodo raíz",
      "items": [
        "Subconcepto 1.1: descripción y relación con el padre",
        "Subconcepto 1.2: descripción y relación con el padre"
      ]
    }
  ],
  "proTip": "El concepto más sorprendente o menos obvio del contenido",
  "metadata": {
    "difficulty": "Media",
    "readingTime": "3 min"
  }
}

TRANSCRIPCIÓN:
${transcript}`
}

export function buildExtractionUserPrompt(
  transcript: string,
  mode: ExtractionMode,
  outputLanguage: ResolvedExtractionOutputLanguage
) {
  switch (mode) {
    case 'executive_summary':
      return buildExecutiveSummaryUserPrompt(transcript, outputLanguage)
    case 'business_ideas':
      return buildBusinessIdeasUserPrompt(transcript, outputLanguage)
    case 'key_quotes':
      return buildKeyQuotesUserPrompt(transcript, outputLanguage)
    case 'concept_map':
      return buildConceptMapUserPrompt(transcript, outputLanguage)
    case 'action_plan':
    default:
      return buildActionPlanUserPrompt(transcript, mode, outputLanguage)
  }
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function estimateTime(wordCount: number) {
  const totalMinutes = Math.round(wordCount / 150) // ~150 wpm speech rate
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const originalTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  const savedMinutes = Math.max(totalMinutes - 3, 0)
  const savedH = Math.floor(savedMinutes / 60)
  const savedM = savedMinutes % 60
  const savedTime = savedH > 0 ? `${savedH}h ${savedM}m` : `${savedM}m`
  return { originalTime, savedTime }
}

function stripOuterCodeFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (!match) return trimmed
  return match[1].trim()
}

function extractJsonObject(text: string) {
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null
  return text.slice(firstBrace, lastBrace + 1).trim()
}

function removeTrailingCommas(text: string) {
  return text.replace(/,\s*([}\]])/g, '$1')
}

function tryParseJson(text: string): unknown | null {
  const candidate = text.trim()
  if (!candidate) return null
  try {
    return JSON.parse(candidate) as unknown
  } catch {
    return null
  }
}

function parseModelJson(inputText: string) {
  const attempts: string[] = []
  const pushAttempt = (value: string | null) => {
    if (!value) return
    const trimmed = value.trim()
    if (!trimmed) return
    if (!attempts.includes(trimmed)) {
      attempts.push(trimmed)
    }
  }

  const stripped = stripOuterCodeFence(inputText)
  pushAttempt(stripped)

  const fencedJsonMatch = inputText.match(/```json\s*([\s\S]*?)```/i)
  pushAttempt(fencedJsonMatch?.[1] ?? null)

  pushAttempt(extractJsonObject(stripped))
  pushAttempt(extractJsonObject(inputText))

  for (const attempt of attempts) {
    const direct = tryParseJson(attempt)
    if (direct !== null) {
      return direct
    }

    const withoutTrailingCommas = removeTrailingCommas(attempt)
    if (withoutTrailingCommas !== attempt) {
      const repaired = tryParseJson(withoutTrailingCommas)
      if (repaired !== null) {
        return repaired
      }
    }
  }

  return null
}

export function parseExtractionModelText(
  inputText: string,
  timeData: { originalTime: string; savedTime: string },
  mode: ExtractionMode,
  outputLanguage: ResolvedExtractionOutputLanguage = 'es'
) {
  const extracted = parseModelJson(inputText)
  if (extracted === null) {
    throw new Error('El modelo devolvió JSON inválido. Intenta de nuevo.')
  }

  const result = extracted as {
    objective?: unknown
    phases?: unknown
    proTip?: unknown
    metadata?: { readingTime?: unknown; difficulty?: unknown } | unknown
  }

  return {
    mode,
    objective: typeof result.objective === 'string' ? result.objective : '',
    phases: Array.isArray(result.phases) ? (result.phases as ExtractPhase[]) : [],
    proTip: typeof result.proTip === 'string' ? result.proTip : '',
    metadata: {
      readingTime:
        typeof (result.metadata as { readingTime?: unknown } | undefined)?.readingTime === 'string'
          ? (result.metadata as { readingTime: string }).readingTime
          : '3 min',
      difficulty:
        typeof (result.metadata as { difficulty?: unknown } | undefined)?.difficulty === 'string'
          ? (result.metadata as { difficulty: string }).difficulty
          : outputLanguage === 'en'
            ? 'Medium'
            : 'Media',
      originalTime: timeData.originalTime,
      savedTime: timeData.savedTime,
    },
  } satisfies ExtractResultPayload
}
