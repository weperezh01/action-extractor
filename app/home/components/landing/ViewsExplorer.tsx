'use client'

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Brain,
  CalendarDays,
  GanttChart,
  GitBranch,
  KanbanSquare,
  LayoutList,
  Network,
  Presentation,
  Workflow,
} from 'lucide-react'
import type { Lang } from '@/app/home/lib/i18n'

type ViewsExplorerProps = {
  lang: Lang
}

type ViewItem = {
  id: string
  label: string
  eyebrow: string
  icon: LucideIcon
  summary: string
  bestFor: string
  whyItMatters: string
  tags: string[]
  iconTone: string
  panelTone: string
}

const DEFAULT_VIEW_ID = 'list'

export function ViewsExplorer({ lang }: ViewsExplorerProps) {
  const items = useMemo<ViewItem[]>(
    () =>
      lang === 'es'
        ? [
            {
              id: 'list',
              label: 'Lista',
              eyebrow: 'Secuencia operativa',
              icon: LayoutList,
              summary:
                'Convierte la extracción en una lista ordenada de tareas con prioridad, contexto y próximos pasos claros.',
              bestFor:
                'Equipos que necesitan ejecutar de inmediato, revisar pendientes y mover acciones sin cambiar de formato.',
              whyItMatters:
                'Es la vista más directa cuando lo importante es pasar del contenido a un checklist accionable en segundos.',
              tags: ['Tareas', 'Prioridades', 'Owners', 'Due dates'],
              iconTone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
              panelTone: 'border-sky-200/80 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-950/20',
            },
            {
              id: 'kanban',
              label: 'Kanban',
              eyebrow: 'Trabajo por etapas',
              icon: KanbanSquare,
              summary:
                'Agrupa las acciones por estado para ver qué está pendiente, qué avanza y qué ya se completó.',
              bestFor:
                'Seguimiento semanal, rituales de equipo y coordinación entre personas o áreas con distintas responsabilidades.',
              whyItMatters:
                'Hace visible el cuello de botella y permite mover trabajo por columnas sin perder el contexto de la extracción.',
              tags: ['Todo', 'Doing', 'Done', 'WIP'],
              iconTone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
              panelTone: 'border-indigo-200/80 bg-indigo-50/70 dark:border-indigo-500/20 dark:bg-indigo-950/20',
            },
            {
              id: 'calendar',
              label: 'Calendario',
              eyebrow: 'Tiempo y fechas',
              icon: CalendarDays,
              summary:
                'Ubica entregables y acciones sobre un calendario para entender cuándo ocurren, qué coincide y qué vence primero.',
              bestFor:
                'Reuniones, contenidos, hitos, clases, campañas y cualquier flujo que dependa de fechas concretas.',
              whyItMatters:
                'Ayuda a aterrizar la extracción en el tiempo real del equipo y evita que todo quede como backlog abstracto.',
              tags: ['Fechas', 'Eventos', 'Agenda', 'Plazos'],
              iconTone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
              panelTone: 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-950/20',
            },
            {
              id: 'gantt',
              label: 'Gantt',
              eyebrow: 'Cronograma visual',
              icon: GanttChart,
              summary:
                'Distribuye fases y tareas a lo largo del tiempo para ver duración, solapes, progreso e hitos importantes.',
              bestFor:
                'Proyectos con varias etapas, seguimiento por semanas y necesidad de comunicar un plan completo de una sola vista.',
              whyItMatters:
                'Permite estimar carga, detectar solapamientos y mostrar de forma clara cómo se mueve el proyecto en el tiempo.',
              tags: ['Timeline', 'Duración', 'Progreso', 'Hitos'],
              iconTone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
              panelTone: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-950/20',
            },
            {
              id: 'cpm',
              label: 'CPM',
              eyebrow: 'Dependencias críticas',
              icon: GitBranch,
              summary:
                'Muestra la red de actividades y resalta el camino crítico que no puede retrasarse sin afectar el resultado final.',
              bestFor:
                'Operaciones complejas donde una tarea bloquea la siguiente y el tiempo disponible es especialmente sensible.',
              whyItMatters:
                'Sirve para detectar qué pasos sostienen el calendario, dónde hay riesgo y qué trabajo merece mayor protección.',
              tags: ['Critical path', 'Dependencies', 'Bottlenecks', 'Risk'],
              iconTone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
              panelTone: 'border-rose-200/80 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-950/20',
            },
            {
              id: 'mindmap',
              label: 'Mapa mental',
              eyebrow: 'Exploración de ideas',
              icon: Brain,
              summary:
                'Organiza conceptos, temas y subtemas alrededor de un nodo central para expandir y relacionar ideas con más claridad.',
              bestFor:
                'Brainstorming, síntesis de investigación, clases, notas extensas y descubrimiento de patrones dentro del contenido.',
              whyItMatters:
                'Convierte información densa en una estructura mental rápida de recorrer y fácil de explicar a otros.',
              tags: ['Topics', 'Branches', 'Clusters', 'Insights'],
              iconTone: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
              panelTone: 'border-fuchsia-200/80 bg-fuchsia-50/70 dark:border-fuchsia-500/20 dark:bg-fuchsia-950/20',
            },
            {
              id: 'hierarchy',
              label: 'Jerarquía',
              eyebrow: 'Relación padre-hijo',
              icon: Network,
              summary:
                'Ordena el material en niveles jerárquicos para mostrar categorías, subcategorías, bloques y responsables.',
              bestFor:
                'Organigramas, taxonomías, frameworks, estructuras de cuentas o sistemas con niveles muy definidos.',
              whyItMatters:
                'Aclara qué depende de qué y qué vive dentro de cada bloque sin mezclar capas ni responsabilidades.',
              tags: ['Levels', 'Parents', 'Children', 'Ownership'],
              iconTone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
              panelTone: 'border-cyan-200/80 bg-cyan-50/70 dark:border-cyan-500/20 dark:bg-cyan-950/20',
            },
            {
              id: 'flowchart',
              label: 'Flowchart',
              eyebrow: 'Decisiones y procesos',
              icon: Workflow,
              summary:
                'Convierte la extracción en un flujo paso a paso con decisiones, bifurcaciones y rutas operativas posibles.',
              bestFor:
                'SOPs, playbooks, soporte, ventas, onboarding y cualquier proceso que dependa de condiciones o reglas.',
              whyItMatters:
                'Hace evidente la lógica operativa detrás del contenido y reduce ambigüedad cuando varias personas deben ejecutar.',
              tags: ['Steps', 'Decisions', 'Paths', 'Logic'],
              iconTone: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
              panelTone: 'border-teal-200/80 bg-teal-50/70 dark:border-teal-500/20 dark:bg-teal-950/20',
            },
            {
              id: 'presentation',
              label: 'Slides',
              eyebrow: 'Narrativa ejecutiva',
              icon: Presentation,
              summary:
                'Empaqueta la extracción como una secuencia de diapositivas para presentar hallazgos, decisiones y próximos pasos.',
              bestFor:
                'Debriefs, reportes, presentaciones a clientes, liderazgo o sesiones de alineación interna.',
              whyItMatters:
                'Es ideal cuando necesitas explicar el contexto, vender la idea y dejar una historia clara para compartir.',
              tags: ['Summary', 'Storyline', 'Presentation', 'Share'],
              iconTone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
              panelTone: 'border-violet-200/80 bg-violet-50/70 dark:border-violet-500/20 dark:bg-violet-950/20',
            },
          ]
        : [
            {
              id: 'list',
              label: 'List',
              eyebrow: 'Operational sequence',
              icon: LayoutList,
              summary:
                'Turns the extraction into an ordered task list with priority, context, and clear next steps.',
              bestFor:
                'Teams that need to execute immediately, review open work, and move actions without changing formats.',
              whyItMatters:
                'It is the fastest path when the goal is to move from source material to an actionable checklist in seconds.',
              tags: ['Tasks', 'Priorities', 'Owners', 'Due dates'],
              iconTone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
              panelTone: 'border-sky-200/80 bg-sky-50/70 dark:border-sky-500/20 dark:bg-sky-950/20',
            },
            {
              id: 'kanban',
              label: 'Kanban',
              eyebrow: 'Work by stage',
              icon: KanbanSquare,
              summary:
                'Groups actions by status so you can see what is queued, in progress, or already completed.',
              bestFor:
                'Weekly tracking, team rituals, and coordination across people or functions with different responsibilities.',
              whyItMatters:
                'It exposes bottlenecks and makes it easy to move work across columns without losing the extraction context.',
              tags: ['Todo', 'Doing', 'Done', 'WIP'],
              iconTone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
              panelTone: 'border-indigo-200/80 bg-indigo-50/70 dark:border-indigo-500/20 dark:bg-indigo-950/20',
            },
            {
              id: 'calendar',
              label: 'Calendar',
              eyebrow: 'Time and dates',
              icon: CalendarDays,
              summary:
                'Places deliverables and actions on a calendar so you can understand timing, overlap, and deadlines.',
              bestFor:
                'Meetings, content, milestones, classes, campaigns, and any workflow that depends on specific dates.',
              whyItMatters:
                'It grounds the extraction in real team time and keeps the result from staying as an abstract backlog.',
              tags: ['Dates', 'Events', 'Agenda', 'Deadlines'],
              iconTone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
              panelTone: 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-950/20',
            },
            {
              id: 'gantt',
              label: 'Gantt',
              eyebrow: 'Visual timeline',
              icon: GanttChart,
              summary:
                'Spreads phases and tasks across time so you can see duration, overlaps, progress, and milestones.',
              bestFor:
                'Projects with multiple stages, week-based tracking, and a need to communicate one complete plan at a glance.',
              whyItMatters:
                'It helps estimate workload, detect overlap, and show how the project moves over time in a single frame.',
              tags: ['Timeline', 'Duration', 'Progress', 'Milestones'],
              iconTone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
              panelTone: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-950/20',
            },
            {
              id: 'cpm',
              label: 'CPM',
              eyebrow: 'Critical dependencies',
              icon: GitBranch,
              summary:
                'Shows the activity network and highlights the critical path that cannot slip without affecting the outcome.',
              bestFor:
                'Complex operations where one task blocks the next and the available time is especially sensitive.',
              whyItMatters:
                'It reveals which steps hold the schedule together, where the risk sits, and what deserves extra protection.',
              tags: ['Critical path', 'Dependencies', 'Bottlenecks', 'Risk'],
              iconTone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
              panelTone: 'border-rose-200/80 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-950/20',
            },
            {
              id: 'mindmap',
              label: 'Mind map',
              eyebrow: 'Idea exploration',
              icon: Brain,
              summary:
                'Organizes concepts, themes, and subthemes around a central node so ideas can expand with more clarity.',
              bestFor:
                'Brainstorming, research synthesis, classes, long-form notes, and pattern discovery inside dense material.',
              whyItMatters:
                'It turns dense information into a mental structure that is fast to scan and easy to explain to other people.',
              tags: ['Topics', 'Branches', 'Clusters', 'Insights'],
              iconTone: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
              panelTone: 'border-fuchsia-200/80 bg-fuchsia-50/70 dark:border-fuchsia-500/20 dark:bg-fuchsia-950/20',
            },
            {
              id: 'hierarchy',
              label: 'Hierarchy',
              eyebrow: 'Parent-child structure',
              icon: Network,
              summary:
                'Arranges the material into levels so categories, subcategories, blocks, and ownership become clear.',
              bestFor:
                'Org charts, taxonomies, frameworks, account structures, or systems that need clear levels.',
              whyItMatters:
                'It clarifies what depends on what and what lives inside each block without mixing structural layers.',
              tags: ['Levels', 'Parents', 'Children', 'Ownership'],
              iconTone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
              panelTone: 'border-cyan-200/80 bg-cyan-50/70 dark:border-cyan-500/20 dark:bg-cyan-950/20',
            },
            {
              id: 'flowchart',
              label: 'Flowchart',
              eyebrow: 'Decisions and process',
              icon: Workflow,
              summary:
                'Turns the extraction into a step-by-step flow with decisions, branches, and operational paths.',
              bestFor:
                'SOPs, playbooks, support, sales, onboarding, and any process that depends on conditions or rules.',
              whyItMatters:
                'It makes the operating logic visible and reduces ambiguity when multiple people need to execute the same process.',
              tags: ['Steps', 'Decisions', 'Paths', 'Logic'],
              iconTone: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
              panelTone: 'border-teal-200/80 bg-teal-50/70 dark:border-teal-500/20 dark:bg-teal-950/20',
            },
            {
              id: 'presentation',
              label: 'Slides',
              eyebrow: 'Executive narrative',
              icon: Presentation,
              summary:
                'Packages the extraction as a slide sequence to present findings, decisions, and next actions.',
              bestFor:
                'Debriefs, client presentations, leadership updates, internal alignment, and shareable summaries.',
              whyItMatters:
                'It is the right view when you need to explain the context, sell the idea, and leave behind a clear story.',
              tags: ['Summary', 'Storyline', 'Presentation', 'Share'],
              iconTone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
              panelTone: 'border-violet-200/80 bg-violet-50/70 dark:border-violet-500/20 dark:bg-violet-950/20',
            },
          ],
    [lang],
  )

  const [activeId, setActiveId] = useState(DEFAULT_VIEW_ID)
  const activeItem = items.find((item) => item.id === activeId) ?? items[0]
  const activeIndex = items.findIndex((item) => item.id === activeItem.id) + 1
  const ActiveIcon = activeItem.icon

  return (
    <div className="mt-10 md:mt-12">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const Icon = item.icon
          const isActive = item.id === activeItem.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={`rounded-2xl border px-4 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950 ${
                isActive
                  ? 'border-cyan-300 bg-white shadow-[0_18px_40px_-30px_rgba(6,182,212,0.8)] dark:border-cyan-500/40 dark:bg-zinc-900'
                  : 'border-zinc-200/80 bg-white/80 hover:-translate-y-0.5 hover:border-zinc-300 dark:border-white/10 dark:bg-zinc-900/70 dark:hover:border-white/20'
              }`}
              aria-pressed={isActive}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconTone}`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <p className="mt-1 text-sm font-black text-zinc-900 dark:text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {item.eyebrow}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-zinc-900/80 md:p-8">
        <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${activeItem.iconTone}`}
              >
                <ActiveIcon size={20} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
                  {activeItem.eyebrow}
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                  {activeItem.label}
                </h3>
              </div>
              <span className="inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:bg-zinc-950/70 dark:text-zinc-300">
                {lang === 'es' ? `Vista ${activeIndex} de 9` : `View ${activeIndex} of 9`}
              </span>
            </div>

            <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
              {activeItem.summary}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-zinc-950/60">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  {lang === 'es' ? 'Qué te entrega' : 'What it gives you'}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                  {activeItem.summary}
                </p>
              </article>

              <article className={`rounded-2xl border p-5 ${activeItem.panelTone}`}>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-700 dark:text-zinc-200">
                  {lang === 'es' ? 'Cuándo conviene usarla' : 'Best used when'}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                  {activeItem.bestFor}
                </p>
              </article>
            </div>
          </div>

          <aside className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-zinc-950/60">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {lang === 'es' ? 'Por qué esta vista funciona' : 'Why this view works'}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
              {activeItem.whyItMatters}
            </p>

            <div className="mt-6">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {lang === 'es' ? 'Lo verás como' : 'You will see it as'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeItem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
