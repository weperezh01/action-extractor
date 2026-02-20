import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findSharedExtractionByToken } from '@/lib/db'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Phase {
  id: number
  title: string
  items: string[]
}

interface Metadata {
  readingTime: string
  difficulty: string
  originalTime: string
  savedTime: string
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function formatHistoryDate(isoDate: string) {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export default async function SharePage({
  params,
}: {
  params: { token: string }
}) {
  const token = typeof params.token === 'string' ? params.token.trim() : ''
  if (!token) {
    notFound()
  }

  const extraction = await findSharedExtractionByToken(token)
  if (!extraction) {
    notFound()
  }

  const phases = safeParse<Phase[]>(extraction.phases_json, [])
  const metadata = safeParse<Metadata>(extraction.metadata_json, {
    readingTime: '3 min',
    difficulty: 'Media',
    originalTime: '0m',
    savedTime: '0m',
  })
  const mode = normalizeExtractionMode(extraction.extraction_mode)
  const modeLabel = getExtractionModeLabel(mode)
  const thumbnailUrl =
    extraction.thumbnail_url ||
    (extraction.video_id ? buildYoutubeThumbnailUrl(extraction.video_id) : null)

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Resultado Compartido
          </h1>
          <Link
            href="/"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Abrir ActionExtractor
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-white">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Video Fuente
            </p>
            <div className="flex flex-col md:flex-row gap-4">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={extraction.video_title ?? 'Miniatura del video'}
                  className="w-full md:w-56 h-32 rounded-xl object-cover border border-slate-200"
                />
              ) : (
                <div className="w-full md:w-56 h-32 rounded-xl bg-slate-100 border border-slate-200" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 text-base line-clamp-2">
                  {extraction.video_title || 'Video de YouTube'}
                </p>
                <p className="text-xs text-slate-500 mt-2 break-all">{extraction.url}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Generado: {formatHistoryDate(extraction.created_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-6 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Objetivo Estratégico
            </p>
            <p className="text-lg font-medium text-slate-800 leading-relaxed">
              {extraction.objective}
            </p>
          </div>

          <div className="px-6 pt-5 pb-2 flex flex-wrap gap-3">
            <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-emerald-100">
              Tiempo ahorrado: {metadata.savedTime}
            </span>
            <span className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-orange-100">
              Dificultad: {metadata.difficulty}
            </span>
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold border border-indigo-100">
              Modo: {modeLabel}
            </span>
          </div>

          <div className="p-6 space-y-4">
            {phases.map((phase) => (
              <section
                key={phase.id}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <header className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800">
                    {phase.id}. {phase.title}
                  </h2>
                </header>
                <ul className="p-4 space-y-2">
                  {phase.items.map((item, index) => (
                    <li key={index} className="text-sm text-slate-700 leading-relaxed">
                      - {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mx-6 mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4">
            <h3 className="font-bold text-amber-800 mb-1 text-sm">Consejo Pro</h3>
            <p className="text-sm text-amber-700 leading-relaxed italic">
              &ldquo;{extraction.pro_tip}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
