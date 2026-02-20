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
  objective: string
  phases: ExtractPhase[]
  proTip: string
  metadata: ExtractMetadata
}

export const EXTRACTION_MODEL = 'claude-sonnet-4-6'
export const EXTRACTION_PROMPT_VERSION = 'action-plan-v1'

export const EXTRACTION_SYSTEM_PROMPT = `Eres un estratega de negocios experto. Tu función es analizar transcripciones de videos/podcasts y extraer ÚNICAMENTE las acciones concretas y ejecutables, eliminando todo relleno, anécdotas y motivación genérica.

REGLAS ESTRICTAS:
- Cada acción debe ser específica, medible y comenzar con verbo de acción (Define, Crea, Identifica, Implementa, Establece, Documenta, etc.)
- Elimina toda anécdota, motivación o consejo vago
- Genera entre 4 y 6 fases, cada una con 3 a 5 items
- La dificultad refleja recursos y habilidades requeridas: "Fácil", "Media" o "Difícil"
- El consejo pro debe ser la táctica más contraintuitiva o menos obvia del contenido`

export function buildExtractionUserPrompt(transcript: string) {
  return `Analiza la transcripción y responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

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

export function parseExtractionModelText(inputText: string, timeData: { originalTime: string; savedTime: string }) {
  const cleaned = inputText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let extracted: unknown
  try {
    extracted = JSON.parse(cleaned)
  } catch {
    throw new Error('El modelo devolvió JSON inválido. Intenta de nuevo.')
  }

  const result = extracted as {
    objective?: unknown
    phases?: unknown
    proTip?: unknown
    metadata?: { readingTime?: unknown; difficulty?: unknown } | unknown
  }

  return {
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
          : 'Media',
      originalTime: timeData.originalTime,
      savedTime: timeData.savedTime,
    },
  } satisfies ExtractResultPayload
}
