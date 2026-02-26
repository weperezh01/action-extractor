import Link from 'next/link'
import Image from 'next/image'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  findSharedExtractionByToken,
  listExtractionTaskAttachmentsForSharedExtraction,
  listExtractionTasksWithEventsForSharedExtraction,
} from '@/lib/db'
import type { InteractiveTask, InteractiveTaskAttachment } from '@/app/home/lib/types'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { flattenItemsAsText, normalizePlaybookPhases, type PlaybookNode } from '@/lib/playbook-tree'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'
import { SharedTaskTimeline } from './SharedTaskTimeline'
import { ShareSignupCTA } from './ShareSignupCTA'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_APP_URL = 'https://roi.welltechnologies.net'
const DEFAULT_SHARE_DESCRIPTION =
  'Shared Result – Roi Action Extractor. Convierte videos de YouTube en planes accionables.'
const DEFAULT_SOCIAL_IMAGE = '/roi-logo.png'

// React cache deduplica la consulta DB entre generateMetadata y el componente
const getSharedExtraction = cache((token: string) => findSharedExtractionByToken(token))
const getSharedTasks = cache((extractionId: string) =>
  listExtractionTasksWithEventsForSharedExtraction(extractionId)
)
const getSharedAttachments = cache((extractionId: string) =>
  listExtractionTaskAttachmentsForSharedExtraction(extractionId)
)

function resolveAppUrl() {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.ACTION_EXTRACTOR_APP_URL ?? DEFAULT_APP_URL
  const trimmed = candidate.trim()
  if (!trimmed) return DEFAULT_APP_URL
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function toAbsoluteUrl(value: string, appUrl: string) {
  if (!value) return null
  try {
    return new URL(value, `${appUrl}/`).toString()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { token: string }
}): Promise<Metadata> {
  const token = typeof params.token === 'string' ? params.token.trim() : ''
  if (!token) return {}

  const extraction = await getSharedExtraction(token)
  if (!extraction) return {}

  const appUrl = resolveAppUrl()
  const shareUrl = `${appUrl}/share/${token}`
  const modeLabel = getExtractionModeLabel(normalizeExtractionMode(extraction.extraction_mode))
  const title = extraction.video_title
    ? `${modeLabel} | ${extraction.video_title} | Shared Result – Roi Action Extractor`
    : `${modeLabel} | Shared Result – Roi Action Extractor`
  const description = extraction.objective
    ? truncateText(extraction.objective, 220)
    : DEFAULT_SHARE_DESCRIPTION
  const rawImageUrl =
    extraction.thumbnail_url ||
    (extraction.video_id ? buildYoutubeThumbnailUrl(extraction.video_id) : '')
  const imageUrl = toAbsoluteUrl(rawImageUrl || DEFAULT_SOCIAL_IMAGE, appUrl)

  return {
    title,
    description,
    alternates: {
      canonical: shareUrl,
    },
    openGraph: {
      title,
      description,
      url: shareUrl,
      type: 'website',
      siteName: 'Roi Action Extractor',
      locale: 'es_ES',
      ...(imageUrl
        ? {
            images: [
              {
                url: imageUrl,
                alt: extraction.video_title
                  ? `Miniatura del video: ${extraction.video_title}`
                  : 'Roi Action Extractor shared result',
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  }
}

interface Phase {
  id: number
  title: string
  items: PlaybookNode[]
}

interface ExtractionMetadata {
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
    hour12: true,
  }).format(parsed)
}

function mapSharedTasksToInteractiveTasks(
  tasks: Awaited<ReturnType<typeof listExtractionTasksWithEventsForSharedExtraction>>
): InteractiveTask[] {
  return tasks.map((task) => ({
    id: task.id,
    extractionId: task.extraction_id,
    phaseId: task.phase_id,
    phaseTitle: task.phase_title,
    itemIndex: task.item_index,
    itemText: task.item_text,
    nodeId: task.node_id,
    parentNodeId: task.parent_node_id,
    depth: task.depth,
    positionPath: task.position_path,
    checked: task.checked,
    status: task.status,
    dueAt: task.due_at,
    completedAt: task.completed_at,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    events: task.events.map((event) => ({
      id: event.id,
      taskId: event.task_id,
      eventType: event.event_type,
      content: event.content,
      metadataJson: event.metadata_json,
      createdAt: event.created_at,
      userName: event.user_name ?? null,
      userEmail: event.user_email ?? null,
    })),
  }))
}

function mapSharedAttachmentsToInteractiveAttachments(
  attachments: Awaited<ReturnType<typeof listExtractionTaskAttachmentsForSharedExtraction>>
): InteractiveTaskAttachment[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    taskId: attachment.task_id,
    extractionId: attachment.extraction_id,
    attachmentType: attachment.attachment_type,
    storageProvider: attachment.storage_provider,
    url: attachment.url,
    thumbnailUrl: attachment.thumbnail_url,
    title: attachment.title,
    mimeType: attachment.mime_type,
    sizeBytes: attachment.size_bytes,
    metadataJson: attachment.metadata_json,
    createdAt: attachment.created_at,
    updatedAt: attachment.updated_at,
    userName: attachment.user_name ?? null,
    userEmail: attachment.user_email ?? null,
  }))
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

  const extraction = await getSharedExtraction(token)
  if (!extraction) {
    notFound()
  }

  const phases = normalizePlaybookPhases(safeParse<unknown>(extraction.phases_json, []))
  const tasks = await getSharedTasks(extraction.id)
  const attachments = await getSharedAttachments(extraction.id)
  const interactiveTasks = mapSharedTasksToInteractiveTasks(tasks)
  const interactiveAttachments = mapSharedAttachmentsToInteractiveAttachments(attachments)
  const metadata = safeParse<ExtractionMetadata>(extraction.metadata_json, {
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
  const googleStartHref = `/api/auth/google/start?${new URLSearchParams({
    next: `/share/${token}`,
  }).toString()}`

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.16),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.1),transparent_40%)]" />

        <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 md:pt-10">
          <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-4 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col">
              <Link
                href="/"
                className="text-lg font-black tracking-tight text-slate-900 transition-colors hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-300"
              >
                Roi Action Extractor
              </Link>
              <p className="text-sm text-slate-500 dark:text-slate-400">Resultado compartido</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link
                href="/privacy-policy"
                className="text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Privacy
              </Link>
              <Link
                href="/terms-of-use"
                className="text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Terms
              </Link>
              <Link
                href="/"
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Abrir la app
              </Link>
            </div>
          </header>

          <section className="mb-8 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-5 shadow-lg shadow-indigo-100/40 dark:border-indigo-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-none">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  Registro en 1 clic
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  Entra con Google y empieza a analizar tus videos ahora
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Sin esperar verificación por correo. Acceso inmediato a tu dashboard.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={googleStartHref}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
                >
                  Continuar con Google
                </Link>
                <Link
                  href="#signup-cta"
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  Crear cuenta gratis
                </Link>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="border-b border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  Resultado Compartido
                </h1>
                <Link
                  href="#signup-cta"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
                >
                  Crear cuenta gratis
                </Link>
              </div>

              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Video Fuente</p>
              <div className="flex flex-col gap-4 md:flex-row">
                {thumbnailUrl ? (
                  <div className="relative h-36 w-full md:w-60">
                    <Image
                      src={thumbnailUrl}
                      alt={extraction.video_title ?? 'Miniatura del video'}
                      fill
                      sizes="(min-width: 768px) 240px, 100vw"
                      className="rounded-xl border border-slate-200 object-cover dark:border-slate-700"
                    />
                  </div>
                ) : (
                  <div className="h-36 w-full rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 md:w-60" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {extraction.video_title || 'Video de YouTube'}
                  </p>
                  <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">{extraction.url}</p>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Generado: {formatHistoryDate(extraction.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/70 md:p-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                Objetivo Estratégico
              </p>
              <p className="text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                {extraction.objective}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-2 pt-5 md:px-7">
              <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                Tiempo ahorrado: {metadata.savedTime}
              </span>
              <span className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
                Dificultad: {metadata.difficulty}
              </span>
              <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
                Modo: {modeLabel}
              </span>
            </div>

            <div className="space-y-4 p-6 md:p-7">
              {phases.map((phase) => (
                <section key={phase.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <header className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <h2 className="font-bold text-slate-800 dark:text-slate-100">
                      {phase.id}. {phase.title}
                    </h2>
                  </header>
                  <ul className="space-y-2 p-4">
                    {flattenItemsAsText(phase.items).map((item, index) => (
                      <li key={index} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        - {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {interactiveTasks.length > 0 && (
              <SharedTaskTimeline
                extractionId={extraction.id}
                shareToken={token}
                tasks={interactiveTasks}
                attachments={interactiveAttachments}
              />
            )}

            <div className="mx-6 mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20 md:mx-7 md:mb-7">
              <h3 className="mb-1 text-sm font-bold text-amber-800 dark:text-amber-200">Consejo Pro</h3>
              <p className="text-sm italic leading-relaxed text-amber-700 dark:text-amber-300">
                &ldquo;{extraction.pro_tip}&rdquo;
              </p>
            </div>
          </section>

          <div className="my-8 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-700" />

          <ShareSignupCTA />
        </div>
      </div>
    </main>
  )
}
