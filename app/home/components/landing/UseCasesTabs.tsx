'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Briefcase, GraduationCap, Kanban, Mic2 } from 'lucide-react'
import type { Lang } from '@/app/home/lib/i18n'

type UseCasesTabsProps = {
  lang: Lang
}

type UseCaseItem = {
  id: string
  label: string
  eyebrow: string
  icon: LucideIcon
  problem: string
  solution: string
}

const DEFAULT_CASE_ID = 'consultants'

function readUseCaseFromHash(validIds: string[]) {
  if (typeof window === 'undefined') return null
  const currentHash = window.location.hash.replace('#', '')
  const selected = currentHash.startsWith('use-case-') ? currentHash.replace('use-case-', '') : null
  return selected && validIds.includes(selected) ? selected : null
}

export function UseCasesTabs({ lang }: UseCasesTabsProps) {
  const items = useMemo<UseCaseItem[]>(
    () =>
      lang === 'es'
        ? [
            {
              id: 'consultants',
              label: 'Consultants',
              eyebrow: 'Entrega más rápido',
              icon: Briefcase,
              problem:
                'Pasas demasiado tiempo transformando videos, reuniones y contenido largo en recomendaciones claras para el cliente.',
              solution:
                'Notes Aide resume el material, lo convierte en un plan accionable y lo deja listo para compartir o exportar sin rehacer el trabajo a mano.',
            },
            {
              id: 'professors',
              label: 'Professors',
              eyebrow: 'Material más digerible',
              icon: GraduationCap,
              problem:
                'Las clases grabadas y lecturas extensas generan demasiada fricción cuando necesitas destacar conceptos, tareas y conclusiones clave.',
              solution:
                'Genera resúmenes ejecutivos, ideas clave y citas destacadas para preparar clases, guías de estudio y seguimiento académico con menos esfuerzo.',
            },
            {
              id: 'content-creators',
              label: 'Content Creators',
              eyebrow: 'Recicla mejor tu contenido',
              icon: Mic2,
              problem:
                'Cada video, entrevista o podcast contiene muchas ideas útiles, pero convertirlas en posts, hooks o ángulos accionables consume horas.',
              solution:
                'Extrae business ideas, quotes y resúmenes listos para reutilizar en newsletters, carruseles, guiones y calendarios editoriales.',
            },
            {
              id: 'project-managers',
              label: 'Project Managers',
              eyebrow: 'De insights a ejecución',
              icon: Kanban,
              problem:
                'Después de una grabación o documento largo, el equipo sigue sin saber qué hacer primero, quién es responsable y cómo moverlo al tablero.',
              solution:
                'Convierte el contenido en planes con prioridades y exporta directo a herramientas como Notion o Trello para activar la ejecución sin fricción.',
            },
          ]
        : [
            {
              id: 'consultants',
              label: 'Consultants',
              eyebrow: 'Ship faster',
              icon: Briefcase,
              problem:
                'Too much of your time goes into turning long videos, client calls, and research into clear recommendations.',
              solution:
                'Notes Aide condenses the source, turns it into an actionable plan, and makes it ready to share or export without manual rework.',
            },
            {
              id: 'professors',
              label: 'Professors',
              eyebrow: 'Make material digestible',
              icon: GraduationCap,
              problem:
                'Recorded lectures and long readings create too much friction when you need to highlight concepts, assignments, and key conclusions.',
              solution:
                'Generate executive summaries, key ideas, and memorable quotes for lesson prep, study guides, and academic follow-up in less time.',
            },
            {
              id: 'content-creators',
              label: 'Content Creators',
              eyebrow: 'Repurpose content faster',
              icon: Mic2,
              problem:
                'Every video, interview, or podcast contains multiple usable angles, but turning them into posts, hooks, or frameworks takes hours.',
              solution:
                'Extract business ideas, quotes, and summaries that are ready to reuse across newsletters, scripts, social posts, and editorial calendars.',
            },
            {
              id: 'project-managers',
              label: 'Project Managers',
              eyebrow: 'Move from insight to execution',
              icon: Kanban,
              problem:
                'After a long recording or document, teams still do not know what to do first, who owns it, or how to move it into the board.',
              solution:
                'Turn source material into prioritized plans and export straight into tools like Notion or Trello so execution starts without cleanup work.',
            },
          ],
    [lang],
  )

  const [activeId, setActiveId] = useState(DEFAULT_CASE_ID)

  useEffect(() => {
    const validIds = items.map((item) => item.id)
    const syncFromHash = () => {
      const hashValue = readUseCaseFromHash(validIds)
      if (hashValue) setActiveId(hashValue)
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)

    return () => {
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [items])

  const activeItem = items.find((item) => item.id === activeId) ?? items[0]

  const selectUseCase = (id: string) => {
    setActiveId(id)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#use-case-${id}`)
    }
  }

  return (
    <div className="mt-10 md:mt-12">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = item.id === activeItem.id

          return (
            <button
              key={item.id}
              id={`use-case-${item.id}`}
              type="button"
              onClick={() => selectUseCase(item.id)}
              className={`rounded-2xl border px-4 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950 ${
                isActive
                  ? 'border-cyan-300 bg-white shadow-[0_18px_40px_-30px_rgba(6,182,212,0.8)] dark:border-cyan-500/40 dark:bg-zinc-900'
                  : 'border-zinc-200/80 bg-white/80 hover:-translate-y-0.5 hover:border-zinc-300 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:border-white/20'
              }`}
              aria-pressed={isActive}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-zinc-900 dark:text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.eyebrow}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-zinc-900/80 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
              {activeItem.eyebrow}
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              {activeItem.label}
            </h3>
          </div>
          <span className="inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-300">
            {lang === 'es' ? 'Caso de uso activo' : 'Active use case'}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-zinc-950/60">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {lang === 'es' ? 'El problema' : 'The problem'}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
              {activeItem.problem}
            </p>
          </article>

          <article className="rounded-2xl border border-cyan-200/80 bg-cyan-50/80 p-5 dark:border-cyan-500/20 dark:bg-cyan-950/20">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
              {lang === 'es' ? 'La solución' : 'The solution'}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
              {activeItem.solution}
            </p>
          </article>
        </div>
      </div>
    </div>
  )
}
