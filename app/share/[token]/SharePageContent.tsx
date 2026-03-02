'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLang } from '@/app/home/hooks/useLang'
import { t } from '@/app/home/lib/i18n'
import { getExtractionModeLabel, normalizeExtractionMode } from '@/lib/extraction-modes'
import { flattenItemsAsText, normalizePlaybookPhases, type PlaybookNode } from '@/lib/playbook-tree'
import { buildYoutubeThumbnailUrl } from '@/lib/video-preview'
import { SharedTaskTimeline } from './SharedTaskTimeline'
import { ShareSignupCTA } from './ShareSignupCTA'
import type { InteractiveTask, InteractiveTaskAttachment } from '@/app/home/lib/types'

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

interface ShareExtractionData {
  id: string
  video_title: string | null
  url: string | null
  video_id: string | null
  objective: string | null
  phases_json: string
  metadata_json: string
  extraction_mode: string | null
  thumbnail_url: string | null
  pro_tip: string | null
  created_at: string
}

interface SharePageContentProps {
  extraction: ShareExtractionData
  token: string
  tasks: InteractiveTask[]
  attachments: InteractiveTaskAttachment[]
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

export function SharePageContent({ extraction, token, tasks, attachments }: SharePageContentProps) {
  const { lang } = useLang()

  const phases = normalizePlaybookPhases(safeParse<unknown>(extraction.phases_json, []))
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
              <p className="text-sm text-slate-500 dark:text-slate-400">{t(lang, 'share.sharedResult')}</p>
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
                {t(lang, 'share.openApp')}
              </Link>
            </div>
          </header>

          <section className="mb-8 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 p-5 shadow-lg shadow-indigo-100/40 dark:border-indigo-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-none">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  {t(lang, 'share.oneClickReg')}
                </p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {t(lang, 'share.signInGoogle')}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {t(lang, 'share.noEmailVerif')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={googleStartHref}
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
                >
                  {t(lang, 'share.continueGoogle')}
                </Link>
                <Link
                  href="#signup-cta"
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  {t(lang, 'share.createFree')}
                </Link>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <div className="border-b border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {t(lang, 'share.sharedResultTitle')}
                </h1>
                <Link
                  href="#signup-cta"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
                >
                  {t(lang, 'share.createFree')}
                </Link>
              </div>

              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{t(lang, 'share.sourceVideo')}</p>
              <div className="flex flex-col gap-4 md:flex-row">
                {thumbnailUrl ? (
                  <div className="relative h-36 w-full md:w-60">
                    <Image
                      src={thumbnailUrl}
                      alt={extraction.video_title ?? t(lang, 'share.videoThumbnail')}
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
                    {extraction.video_title || t(lang, 'share.youtubeVideo')}
                  </p>
                  <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">{extraction.url}</p>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {t(lang, 'share.generatedOn')} {formatHistoryDate(extraction.created_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/70 md:p-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                {t(lang, 'share.strategicObjective')}
              </p>
              <p className="text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                {extraction.objective}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-2 pt-5 md:px-7">
              <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                {t(lang, 'share.timeSaved')} {metadata.savedTime}
              </span>
              <span className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
                {t(lang, 'share.difficulty')} {metadata.difficulty}
              </span>
              <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300">
                {t(lang, 'share.mode')} {modeLabel}
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

            {tasks.length > 0 && (
              <SharedTaskTimeline
                extractionId={extraction.id}
                shareToken={token}
                tasks={tasks}
                attachments={attachments}
              />
            )}

            <div className="mx-6 mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20 md:mx-7 md:mb-7">
              <h3 className="mb-1 text-sm font-bold text-amber-800 dark:text-amber-200">{t(lang, 'share.proTip')}</h3>
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
