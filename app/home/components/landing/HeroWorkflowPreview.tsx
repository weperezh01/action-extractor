'use client'

import { type CSSProperties, type TouchEvent, useEffect, useMemo, useRef, useState } from 'react'
import { t, type Lang } from '@/app/home/lib/i18n'
import { ExtractionStreamingPreview } from '@/app/home/components/ExtractionStreamingPreview'
import { DEFAULT_EXTRACTION_MODE, getExtractionModeLabel } from '@/lib/extraction-modes'
import {
  ArrowRight,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  GanttChart,
  GitBranch,
  KanbanSquare,
  LayoutList,
  Network,
  Pause,
  Paperclip,
  Play,
  Presentation,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react'

type HeroWorkflowPreviewProps = {
  lang: Lang
  mode?: 'main' | 'secondary' | 'both'
}

const HERO_WORKFLOW_PAUSE_EVENT = 'hero-workflow-pause-change'

function readSharedHeroPauseState() {
  if (typeof window === 'undefined') return false

  return Boolean((window as Window & { __heroWorkflowPaused?: boolean }).__heroWorkflowPaused)
}

function writeSharedHeroPauseState(nextValue: boolean) {
  if (typeof window === 'undefined') return

  ;(window as Window & { __heroWorkflowPaused?: boolean }).__heroWorkflowPaused = nextValue
  window.dispatchEvent(new CustomEvent(HERO_WORKFLOW_PAUSE_EVENT, { detail: nextValue }))
}

const ACTIONABLE_STRUCTURES = [
  { key: 'list', label: 'List', Icon: LayoutList },
  { key: 'kanban', label: 'Kanban', Icon: KanbanSquare },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { key: 'gantt', label: 'Gantt', Icon: GanttChart },
  { key: 'cpm', label: 'CPM', Icon: GitBranch },
  { key: 'mindmap', label: 'Mind map', Icon: Brain },
  { key: 'hierarchy', label: 'Hierarchy', Icon: Network },
  { key: 'flowchart', label: 'Flowchart', Icon: Workflow },
  { key: 'presentation', label: 'Slides', Icon: Presentation },
] as const

type ActionableStructureKey = (typeof ACTIONABLE_STRUCTURES)[number]['key']

type SummaryCardKind = 'action-plan' | 'executive-summary' | 'business-ideas' | 'key-quotes'

type SummaryCard = {
  key: SummaryCardKind
  title: string
  description: string
  highlights: string[]
  bullets?: string[]
  accent: string
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max)
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

function getSummaryCardIcon(kind: SummaryCardKind) {
  switch (kind) {
    case 'action-plan':
      return CheckCircle2
    case 'executive-summary':
      return FileText
    case 'business-ideas':
      return Brain
    case 'key-quotes':
      return Sparkles
  }
}

function StructurePreviewMini({ kind }: { kind: ActionableStructureKey }) {
  if (kind === 'list') {
    return (
      <div className="relative h-[74px] w-[168px] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.84))] px-2.5 py-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">Action list</p>
            <p className="text-[8px] font-semibold text-slate-600">Next execution steps</p>
          </div>
          <span className="rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.08em] text-cyan-700">
            4 items
          </span>
        </div>

        <div className="overflow-hidden rounded-[12px] border border-slate-200/90 bg-white/90 shadow-[0_10px_18px_-18px_rgba(15,23,42,0.45)]">
          {[
            {
              tone: 'bg-cyan-50/70',
              accent: 'bg-cyan-500 text-cyan-700',
              checkbox: 'bg-cyan-500 border-cyan-500',
              lines: ['w-[72%]', 'w-[40%]'],
              meta: 'Today',
              metaTone: 'text-cyan-700',
            },
            {
              tone: 'bg-white',
              accent: 'bg-slate-200 text-slate-500',
              checkbox: 'bg-white border-slate-300',
              lines: ['w-[78%]', 'w-[34%]'],
              meta: 'Owner',
              metaTone: 'text-amber-700',
            },
            {
              tone: 'bg-white',
              accent: 'bg-slate-200 text-slate-500',
              checkbox: 'bg-white border-slate-300',
              lines: ['w-[64%]', 'w-[32%]'],
              meta: 'Q3',
              metaTone: 'text-emerald-700',
            },
            {
              tone: 'bg-white',
              accent: 'bg-slate-200 text-slate-500',
              checkbox: 'bg-white border-slate-300',
              lines: ['w-[69%]', 'w-[38%]'],
              meta: 'Done',
              metaTone: 'text-violet-700',
            },
          ].map((item, index) => (
            <div
              key={index}
              className={`grid grid-cols-[14px_14px_minmax(0,1fr)_auto] items-center gap-1.5 px-2 py-1.5 ${
                index < 3 ? 'border-b border-slate-100' : ''
              } ${item.tone}`}
            >
              <span
                className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[6px] font-black ${item.accent}`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>

              <span
                className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${item.checkbox}`}
              >
                {index === 0 ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
              </span>

              <div className="min-w-0 flex-1 space-y-1">
                {item.lines.map((line) => (
                  <span key={line} className={`block h-1 rounded-full bg-slate-300 ${line}`} />
                ))}
              </div>

              <span className={`shrink-0 text-[6px] font-bold uppercase tracking-[0.06em] ${item.metaTone}`}>
                {item.meta}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (kind === 'kanban') {
    return (
      <div className="grid h-[74px] w-[168px] grid-cols-3 gap-1.5 overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.84))] p-1.5">
        {[
          {
            column: 'Todo',
            tone: 'border-slate-200 bg-white/80',
            badge: 'bg-slate-200 text-slate-600',
            cards: [
              { size: 'h-6', accent: 'bg-cyan-400', lines: ['w-4/5', 'w-3/5'] },
              { size: 'h-5', accent: 'bg-amber-400', lines: ['w-3/4'] },
            ],
          },
          {
            column: 'Doing',
            tone: 'border-indigo-200 bg-indigo-50/70',
            badge: 'bg-indigo-200 text-indigo-700',
            cards: [
              { size: 'h-7', accent: 'bg-indigo-500', lines: ['w-4/5', 'w-2/3'] },
              { size: 'h-5', accent: 'bg-emerald-400', lines: ['w-3/5'] },
            ],
          },
          {
            column: 'Done',
            tone: 'border-emerald-200 bg-emerald-50/60',
            badge: 'bg-emerald-200 text-emerald-700',
            cards: [
              { size: 'h-5', accent: 'bg-emerald-500', lines: ['w-2/3'] },
            ],
          },
        ].map((column) => (
          <div key={column.column} className={`rounded-xl border p-1.5 ${column.tone}`}>
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className="truncate text-[7px] font-black uppercase tracking-[0.08em] text-slate-500">
                {column.column}
              </span>
              <span className={`inline-flex min-w-[14px] items-center justify-center rounded-full px-1 py-0.5 text-[6px] font-black ${column.badge}`}>
                {column.cards.length}
              </span>
            </div>

            <div className="space-y-1">
              {column.cards.map((card, index) => (
                <div
                  key={`${column.column}-${index}`}
                  className={`${card.size} rounded-md border border-slate-200/80 bg-white px-1.5 py-1 shadow-[0_8px_16px_-14px_rgba(15,23,42,0.45)]`}
                >
                  <div className="flex items-start gap-1">
                    <span className={`mt-[1px] h-2.5 w-1 shrink-0 rounded-full ${card.accent}`} />
                    <div className="min-w-0 flex-1 space-y-1">
                      {card.lines.map((line) => (
                        <span key={line} className={`block h-1 rounded-full bg-slate-300 ${line}`} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (kind === 'calendar') {
    return (
      <div className="relative h-[74px] w-[168px] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.84))] px-2.5 py-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">Calendar</p>
            <p className="text-[8px] font-semibold text-slate-600">Sprint timeline</p>
          </div>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.08em] text-indigo-700">
            Jun
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[6px] font-black uppercase tracking-[0.06em] text-slate-400">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {[
            { day: '10' },
            { day: '11' },
            { day: '12', event: 'bg-cyan-400', tone: 'border-cyan-200 bg-cyan-50' },
            { day: '13' },
            { day: '14', event: 'bg-amber-400', tone: 'border-amber-200 bg-amber-50' },
            { day: '15' },
            { day: '16' },
            { day: '17' },
            { day: '18', event: 'bg-indigo-500', tone: 'border-indigo-200 bg-indigo-50' },
            { day: '19' },
            { day: '20', today: true },
            { day: '21' },
            { day: '22', event: 'bg-emerald-400', tone: 'border-emerald-200 bg-emerald-50' },
            { day: '23' },
          ].map((cell) => (
            <div
              key={cell.day}
              className={`relative flex h-[18px] items-start justify-center rounded-[6px] border pt-[2px] text-[7px] font-semibold text-slate-500 ${
                cell.today
                  ? 'border-slate-300 bg-white text-slate-700 shadow-[0_6px_14px_-12px_rgba(15,23,42,0.45)]'
                  : cell.tone ?? 'border-slate-200 bg-slate-50'
              }`}
            >
              <span>{cell.day}</span>
              {cell.event ? (
                <span className={`absolute bottom-[2px] left-1/2 h-1 w-[70%] -translate-x-1/2 rounded-full ${cell.event}`} />
              ) : null}
              {cell.today ? (
                <span className="absolute right-[2px] top-[2px] h-1.5 w-1.5 rounded-full bg-slate-700" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (kind === 'gantt') {
    return (
      <div className="relative h-[74px] w-[168px] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.84))] px-2.5 py-2">
        <div className="grid grid-cols-[24px_repeat(5,minmax(0,1fr))] items-center gap-x-1 text-[7px] font-bold uppercase tracking-[0.08em] text-slate-400">
          <span />
          {['W1', 'W2', 'W3', 'W4', 'W5'].map((week) => (
            <span key={week} className="text-center">
              {week}
            </span>
          ))}
        </div>

        <div className="mt-2 space-y-2">
          {[
            {
              label: 'A',
              track: 'border-cyan-100 bg-slate-100',
              bar: 'bg-cyan-400',
              progress: 'bg-cyan-600',
              left: '2%',
              width: '56%',
              progressWidth: '34%',
            },
            {
              label: 'B',
              track: 'border-emerald-100 bg-slate-100',
              bar: 'bg-emerald-300',
              progress: 'bg-emerald-500',
              left: '22%',
              width: '42%',
              progressWidth: '18%',
            },
            {
              label: 'C',
              track: 'border-violet-100 bg-slate-100',
              bar: 'bg-violet-300',
              progress: 'bg-violet-500',
              left: '48%',
              width: '30%',
              progressWidth: '9%',
            },
          ].map((row) => (
            <div key={row.label} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-x-1.5">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[7px] font-black text-slate-600">
                {row.label}
              </span>
              <div className={`relative h-4 overflow-hidden rounded-full border ${row.track}`}>
                <div className="absolute inset-0 grid grid-cols-5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span key={index} className="border-r border-slate-200/80 last:border-r-0" />
                  ))}
                </div>
                <span
                  className={`absolute inset-y-[2px] rounded-full ${row.bar}`}
                  style={{ left: row.left, width: row.width }}
                />
                <span
                  className={`absolute inset-y-[2px] rounded-full ${row.progress}`}
                  style={{ left: row.left, width: row.progressWidth }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (kind === 'cpm') {
    return (
      <div className="relative h-[74px] w-[168px] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.84))]">
        <svg viewBox="0 0 168 74" className="h-full w-full" aria-hidden="true">
          <defs>
            <marker id="cpm-arrow-neutral" markerWidth="4" markerHeight="4" refX="3.4" refY="2" orient="auto">
              <path d="M0 0 L4 2 L0 4 Z" fill="#94a3b8" />
            </marker>
            <marker id="cpm-arrow-critical" markerWidth="4" markerHeight="4" refX="3.4" refY="2" orient="auto">
              <path d="M0 0 L4 2 L0 4 Z" fill="#ef4444" />
            </marker>
          </defs>

          <path d="M36 37 C42 37 42 24 48 20" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" markerEnd="url(#cpm-arrow-critical)" />
          <path d="M78 20 H92" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" markerEnd="url(#cpm-arrow-critical)" />
          <path d="M122 20 C128 20 128 33 132 37" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" markerEnd="url(#cpm-arrow-critical)" />

          <path d="M36 37 C42 37 42 50 48 54" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" markerEnd="url(#cpm-arrow-neutral)" />
          <path d="M78 54 H92" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" markerEnd="url(#cpm-arrow-neutral)" />
          <path d="M122 54 C128 54 128 41 132 37" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" markerEnd="url(#cpm-arrow-neutral)" />

          <rect x="8" y="27" width="28" height="20" rx="6" fill="#fff1f2" stroke="#fca5a5" strokeWidth="1.2" />
          <line x1="8" y1="36.5" x2="36" y2="36.5" stroke="#fecdd3" strokeWidth="1" />
          <text x="22" y="34" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b91c1c">A</text>
          <text x="22" y="43.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ef4444">3d</text>

          <rect x="48" y="10" width="30" height="20" rx="6" fill="#fff1f2" stroke="#fca5a5" strokeWidth="1.2" />
          <line x1="48" y1="19.5" x2="78" y2="19.5" stroke="#fecdd3" strokeWidth="1" />
          <text x="63" y="17" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b91c1c">B</text>
          <text x="63" y="26.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ef4444">5d</text>

          <rect x="48" y="44" width="30" height="20" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="48" y1="53.5" x2="78" y2="53.5" stroke="#e2e8f0" strokeWidth="1" />
          <text x="63" y="51" textAnchor="middle" fontSize="8" fontWeight="700" fill="#475569">C</text>
          <text x="63" y="60.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#64748b">2d</text>

          <rect x="92" y="10" width="30" height="20" rx="6" fill="#fff1f2" stroke="#fca5a5" strokeWidth="1.2" />
          <line x1="92" y1="19.5" x2="122" y2="19.5" stroke="#fecdd3" strokeWidth="1" />
          <text x="107" y="17" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b91c1c">D</text>
          <text x="107" y="26.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ef4444">4d</text>

          <rect x="92" y="44" width="30" height="20" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
          <line x1="92" y1="53.5" x2="122" y2="53.5" stroke="#e2e8f0" strokeWidth="1" />
          <text x="107" y="51" textAnchor="middle" fontSize="8" fontWeight="700" fill="#475569">E</text>
          <text x="107" y="60.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#64748b">1d</text>

          <rect x="132" y="27" width="28" height="20" rx="6" fill="#fff1f2" stroke="#fca5a5" strokeWidth="1.2" />
          <line x1="132" y1="36.5" x2="160" y2="36.5" stroke="#fecdd3" strokeWidth="1" />
          <text x="146" y="34" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b91c1c">F</text>
          <text x="146" y="43.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#ef4444">2d</text>
        </svg>
      </div>
    )
  }

  if (kind === 'mindmap') {
    return (
      <div className="relative h-[74px] w-[168px] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,rgba(238,242,255,0.96),rgba(255,255,255,0.7)_52%,rgba(255,255,255,0)_78%),linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0.82))]">
        <svg viewBox="0 0 168 74" className="h-full w-full" aria-hidden="true">
          <circle cx="84" cy="37" r="22" fill="rgba(99,102,241,0.08)" />
          <circle cx="84" cy="37" r="17.5" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.6" />
          <line x1="73" y1="33" x2="95" y2="33" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="70" y1="39" x2="91" y2="39" stroke="#a5b4fc" strokeWidth="2.2" strokeLinecap="round" />

          <path d="M67 31 C56 26 47 20 37 16" fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M67 41 C55 45 47 50 36 56" fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M101 31 C113 26 121 21 132 17" fill="none" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M101 41 C113 45 122 50 133 56" fill="none" stroke="#8b5cf6" strokeWidth="2.4" strokeLinecap="round" />

          <path d="M37 16 C28 13 22 11 15 10" fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M37 16 C29 20 23 24 17 28" fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M36 56 C28 52 23 49 17 46" fill="none" stroke="#6ee7b7" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M36 56 C28 61 23 64 17 66" fill="none" stroke="#6ee7b7" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M132 17 C140 13 146 10 153 9" fill="none" stroke="#fcd34d" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M132 17 C140 21 146 24 152 28" fill="none" stroke="#fcd34d" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M133 56 C141 52 147 49 153 45" fill="none" stroke="#c4b5fd" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M133 56 C141 60 147 63 154 66" fill="none" stroke="#c4b5fd" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="21" y="10" width="24" height="11" rx="5.5" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.3" />
          <line x1="27" y1="15.5" x2="39" y2="15.5" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="18" y="23" width="26" height="11" rx="5.5" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.3" />
          <line x1="24" y1="28.5" x2="37" y2="28.5" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="17" y="41" width="26" height="11" rx="5.5" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1.3" />
          <line x1="23" y1="46.5" x2="36" y2="46.5" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="18" y="60" width="24" height="10" rx="5" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1.3" />
          <line x1="24" y1="65" x2="36" y2="65" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="123" y="9" width="24" height="11" rx="5.5" fill="#ffffff" stroke="#fde68a" strokeWidth="1.3" />
          <line x1="129" y1="14.5" x2="141" y2="14.5" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="124" y="23" width="24" height="11" rx="5.5" fill="#ffffff" stroke="#fde68a" strokeWidth="1.3" />
          <line x1="130" y1="28.5" x2="142" y2="28.5" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="125" y="40" width="24" height="11" rx="5.5" fill="#ffffff" stroke="#ddd6fe" strokeWidth="1.3" />
          <line x1="131" y1="45.5" x2="143" y2="45.5" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="126" y="60" width="24" height="10" rx="5" fill="#ffffff" stroke="#ddd6fe" strokeWidth="1.3" />
          <line x1="132" y1="65" x2="144" y2="65" stroke="#8b5cf6" strokeWidth="1.6" strokeLinecap="round" />

          <circle cx="15" cy="10" r="2.6" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1.1" />
          <circle cx="17" cy="28" r="2.6" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1.1" />
          <circle cx="17" cy="46" r="2.6" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="1.1" />
          <circle cx="17" cy="66" r="2.6" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="1.1" />
          <circle cx="153" cy="9" r="2.6" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1.1" />
          <circle cx="152" cy="28" r="2.6" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1.1" />
          <circle cx="153" cy="45" r="2.6" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="1.1" />
          <circle cx="154" cy="66" r="2.6" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="1.1" />
        </svg>
      </div>
    )
  }

  if (kind === 'hierarchy') {
    return (
      <div className="relative h-[74px] w-[168px] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.82))]">
        <svg viewBox="0 0 168 74" className="h-full w-full" aria-hidden="true">
          <circle cx="84" cy="12" r="17" fill="rgba(99,102,241,0.08)" />
          <rect x="58" y="6" width="52" height="14" rx="7" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.5" />
          <line x1="70" y1="13" x2="98" y2="13" stroke="#6366f1" strokeWidth="1.9" strokeLinecap="round" />

          <path d="M84 20 L84 30" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M32 30 H136" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M32 30 V36" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M84 30 V36" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M136 30 V36" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" />

          <rect x="12" y="36" width="40" height="13" rx="6.5" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.3" />
          <line x1="22" y1="42.5" x2="42" y2="42.5" stroke="#0ea5e9" strokeWidth="1.7" strokeLinecap="round" />

          <rect x="64" y="34" width="40" height="15" rx="7.5" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.4" />
          <line x1="74" y1="41.5" x2="94" y2="41.5" stroke="#6366f1" strokeWidth="1.9" strokeLinecap="round" />

          <rect x="116" y="36" width="40" height="13" rx="6.5" fill="#ffffff" stroke="#fde68a" strokeWidth="1.3" />
          <line x1="126" y1="42.5" x2="146" y2="42.5" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" />

          <path d="M32 49 V55" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M32 55 H20" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M32 55 H44" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeLinecap="round" />

          <path d="M136 49 V55" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M136 55 H124" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M136 55 H148" fill="none" stroke="#cbd5e1" strokeWidth="1.4" strokeLinecap="round" />

          <rect x="8" y="56" width="24" height="10" rx="5" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.2" />
          <line x1="14" y1="61" x2="26" y2="61" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />

          <rect x="32" y="56" width="24" height="10" rx="5" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.2" />
          <line x1="38" y1="61" x2="50" y2="61" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />

          <rect x="112" y="56" width="24" height="10" rx="5" fill="#ffffff" stroke="#fde68a" strokeWidth="1.2" />
          <line x1="118" y1="61" x2="130" y2="61" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />

          <rect x="136" y="56" width="24" height="10" rx="5" fill="#ffffff" stroke="#fde68a" strokeWidth="1.2" />
          <line x1="142" y1="61" x2="154" y2="61" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />

          <circle cx="32" cy="30" r="2.2" fill="#7dd3fc" />
          <circle cx="84" cy="30" r="2.2" fill="#a5b4fc" />
          <circle cx="136" cy="30" r="2.2" fill="#fcd34d" />
        </svg>
      </div>
    )
  }

  if (kind === 'flowchart') {
    return (
      <div className="relative h-[74px] w-[168px] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.82))]">
        <svg viewBox="0 0 168 74" className="h-full w-full" aria-hidden="true">
          <rect x="8" y="14" width="28" height="12" rx="6" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.3" />
          <line x1="15" y1="20" x2="29" y2="20" stroke="#0ea5e9" strokeWidth="1.6" strokeLinecap="round" />

          <path d="M36 20 H56" fill="none" stroke="#94a3b8" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M52 18 L56 20 L52 22" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          <rect x="56" y="12" width="36" height="16" rx="6" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.4" />
          <line x1="65" y1="20" x2="83" y2="20" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />

          <path d="M92 20 H108" fill="none" stroke="#94a3b8" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M104 18 L108 20 L104 22" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          <polygon points="120,10 136,20 120,30 104,20" fill="#fff7ed" stroke="#fdba74" strokeWidth="1.4" />
          <line x1="114" y1="20" x2="126" y2="20" stroke="#ea580c" strokeWidth="1.7" strokeLinecap="round" />

          <path d="M120 30 V41" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M120 41 H72" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M72 41 V49" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M120 41 H148" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M148 41 V49" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" />

          <rect x="50" y="49" width="44" height="13" rx="5.5" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1.3" />
          <line x1="60" y1="55.5" x2="82" y2="55.5" stroke="#10b981" strokeWidth="1.7" strokeLinecap="round" />

          <rect x="132" y="49" width="28" height="13" rx="6.5" fill="#ffffff" stroke="#ddd6fe" strokeWidth="1.3" />
          <line x1="139" y1="55.5" x2="153" y2="55.5" stroke="#8b5cf6" strokeWidth="1.7" strokeLinecap="round" />

          <circle cx="120" cy="20" r="2.1" fill="#fed7aa" />
          <circle cx="72" cy="41" r="1.9" fill="#86efac" />
          <circle cx="148" cy="41" r="1.9" fill="#c4b5fd" />
        </svg>
      </div>
    )
  }

  if (kind === 'presentation') {
    return (
      <div className="relative h-[74px] w-[168px] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.84))]">
        <svg viewBox="0 0 168 74" className="h-full w-full" aria-hidden="true">
          <rect x="10" y="8" width="108" height="58" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.4" />
          <rect x="18" y="15" width="46" height="6" rx="3" fill="#0f172a" opacity="0.9" />
          <rect x="18" y="25" width="30" height="4" rx="2" fill="#94a3b8" opacity="0.8" />

          <rect x="18" y="35" width="40" height="21" rx="6" fill="#eef2ff" stroke="#c7d2fe" strokeWidth="1.1" />
          <circle cx="31" cy="45" r="5.5" fill="#c4b5fd" />
          <path d="M24 53 C28 46 34 43 41 41 C46 40 50 42 54 46" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />

          <rect x="66" y="35" width="42" height="5" rx="2.5" fill="#0f172a" opacity="0.88" />
          <rect x="66" y="44" width="33" height="4" rx="2" fill="#94a3b8" opacity="0.9" />
          <rect x="66" y="51" width="28" height="4" rx="2" fill="#cbd5e1" />

          <rect x="124" y="11" width="34" height="16" rx="5.5" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.2" />
          <rect x="130" y="15" width="18" height="2.8" rx="1.4" fill="#0ea5e9" />
          <rect x="130" y="20" width="13" height="2.5" rx="1.25" fill="#7dd3fc" />

          <rect x="124" y="31" width="34" height="16" rx="5.5" fill="#ffffff" stroke="#ddd6fe" strokeWidth="1.2" />
          <rect x="130" y="35" width="18" height="2.8" rx="1.4" fill="#8b5cf6" />
          <rect x="130" y="40" width="14" height="2.5" rx="1.25" fill="#c4b5fd" />

          <rect x="124" y="51" width="34" height="12" rx="5" fill="#ffffff" stroke="#fde68a" strokeWidth="1.2" />
          <rect x="130" y="55" width="16" height="2.8" rx="1.4" fill="#f59e0b" />

          <path d="M118 19 H124" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M118 39 H124" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M118 57 H124" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />

          <circle cx="14" cy="14" r="1.5" fill="#e2e8f0" />
          <circle cx="19" cy="14" r="1.5" fill="#e2e8f0" />
          <circle cx="24" cy="14" r="1.5" fill="#e2e8f0" />
        </svg>
      </div>
    )
  }

  return (
    <div className="relative h-[74px] w-[168px]">
      <span className="absolute left-[8%] top-[18%] h-12 w-[58%] rounded-lg border border-indigo-200 bg-white shadow-[0_12px_30px_-26px_rgba(79,70,229,0.4)]" />
      <span className="absolute right-[8%] top-[10%] h-10 w-[26%] rounded-lg border border-slate-200 bg-slate-50" />
      <span className="absolute right-[12%] bottom-[10%] h-10 w-[30%] rounded-lg border border-slate-200 bg-slate-50" />
      <span className="absolute left-[12%] top-[26%] h-2 w-[40%] rounded-full bg-slate-200" />
      <span className="absolute left-[12%] top-[36%] h-2 w-[28%] rounded-full bg-slate-100" />
      <span className="absolute left-[12%] top-[48%] h-2 w-[34%] rounded-full bg-slate-100" />
    </div>
  )
}

function ToolBadge({ kind, label }: { kind: 'notion' | 'trello'; label: string }) {
  const isNotion = kind === 'notion'

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm ${
        isNotion
          ? 'border-zinc-300 bg-white text-zinc-800 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-100'
          : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-200'
      }`}
    >
      {isNotion ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-900 text-[11px] font-black text-zinc-900 dark:border-white dark:text-white">
          N
        </span>
      ) : (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-600 p-1.5 dark:bg-sky-500">
          <span className="grid h-full w-full grid-cols-2 gap-1">
            <span className="rounded-sm bg-white" />
            <span className="rounded-sm bg-white/75" />
          </span>
        </span>
      )}
      {label}
    </div>
  )
}

function SummarySlideVisual({
  card,
  progress,
  exportLine,
  exportReady,
}: {
  card: SummaryCard
  progress: number
  exportLine: string
  exportReady: string
}) {
  if (card.key === 'action-plan') {
    return (
      <div className="summary-visual-stack">
        <div className="summary-visual-card rounded-[24px] border border-white/75 bg-white/88 p-4 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-zinc-950/72">
          <div className="space-y-3">
            {card.highlights.map((item, index) => {
              const itemProgress = clamp(progress * 1.2 - index * 0.16)

              return (
                <div
                  key={item}
                  className="summary-step-card rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-3 dark:border-white/10 dark:bg-white/5"
                  style={{
                    opacity: 0.36 + itemProgress * 0.64,
                    transform: `translateY(${(1 - itemProgress) * 10}px)`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-[11px] font-black text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                      0{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{item}</p>
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                          {Math.round(48 + itemProgress * 45)}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/10">
                        <span
                          className="summary-progress-beam block h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-indigo-500"
                          style={{ width: `${44 + itemProgress * 46}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="summary-export-panel rounded-[24px] border border-white/70 bg-white/84 p-4 dark:border-white/10 dark:bg-zinc-950/68">
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{exportLine}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ToolBadge kind="notion" label="Notion" />
            <ToolBadge kind="trello" label="Trello" />
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300">
              {exportReady}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (card.key === 'executive-summary') {
    return (
      <div className="summary-visual-stack">
        <div className="summary-visual-card rounded-[24px] border border-white/75 bg-white/88 p-4 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-zinc-950/72">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              TL;DR
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300">
              2m
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {[82, 68, 58, 74].map((width, index) => {
              const lineProgress = clamp(progress * 1.12 - index * 0.12)

              return (
                <span
                  key={width}
                  className="block h-2.5 rounded-full bg-zinc-200/90 dark:bg-white/10"
                  style={{ width: `${width * (0.68 + lineProgress * 0.32)}%` }}
                />
              )
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {card.highlights.map((item, index) => {
            const chipProgress = clamp(progress * 1.08 - index * 0.18)

            return (
              <div
                key={item}
                className="summary-brief-card rounded-[20px] border border-white/75 bg-white/80 p-3 dark:border-white/10 dark:bg-zinc-950/65"
                style={{
                  opacity: 0.42 + chipProgress * 0.58,
                  transform: `translateY(${(1 - chipProgress) * 12}px)`,
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                  0{index + 1}
                </span>
                <p className="mt-2 text-sm font-bold text-zinc-900 dark:text-white">{item}</p>
                <span className="mt-3 block h-1.5 w-full rounded-full bg-zinc-200/80 dark:bg-white/10">
                  <span
                    className="summary-progress-beam block h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                    style={{ width: `${40 + chipProgress * 54}%` }}
                  />
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (card.key === 'business-ideas') {
    return (
      <div className="summary-visual-stack">
        <div className="grid gap-3 sm:grid-cols-3">
          {card.highlights.map((item, index) => {
            const cardProgress = clamp(progress * 1.18 - index * 0.16)

            return (
              <div
                key={item}
                className="summary-idea-card rounded-[22px] border border-white/75 bg-white/84 p-3 shadow-[0_22px_50px_-36px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-zinc-950/68"
                style={{
                  opacity: 0.36 + cardProgress * 0.64,
                  transform: `translateY(${(1 - cardProgress) * 14}px)`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-amber-100 text-[10px] font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    0{index + 1}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
                    P1
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold text-zinc-900 dark:text-white">{item}</p>
                <div className="mt-4 space-y-2">
                  <span className="block h-2 w-4/5 rounded-full bg-zinc-200/80 dark:bg-white/10" />
                  <span
                    className="summary-progress-beam block h-1.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500"
                    style={{ width: `${42 + cardProgress * 46}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="summary-visual-card rounded-[24px] border border-white/75 bg-white/88 p-4 dark:border-white/10 dark:bg-zinc-950/72">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-zinc-900 dark:text-white">Top 3</p>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              Score
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/10">
            <span
              className="summary-progress-beam block h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500"
              style={{ width: `${28 + progress * 66}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="summary-visual-stack">
      <div className="summary-visual-card rounded-[24px] border border-white/75 bg-white/88 p-5 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-zinc-950/72">
        <span className="text-[34px] font-black leading-none text-violet-300 dark:text-violet-400/70">"</span>
        <div className="mt-3 space-y-2">
          {[88, 74, 64].map((width, index) => {
            const lineProgress = clamp(progress * 1.08 - index * 0.14)

            return (
              <span
                key={width}
                className="block h-2.5 rounded-full bg-zinc-200/90 dark:bg-white/10"
                style={{ width: `${width * (0.7 + lineProgress * 0.3)}%` }}
              />
            )
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {card.highlights.map((item, index) => {
            const tagProgress = clamp(progress * 1.14 - index * 0.15)

            return (
              <span
                key={item}
                className="summary-quote-chip rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/30 dark:text-violet-300"
                style={{
                  opacity: 0.38 + tagProgress * 0.62,
                  transform: `translateY(${(1 - tagProgress) * 10}px)`,
                }}
              >
                {item}
              </span>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2].map((item, index) => {
          const quoteProgress = clamp(progress * 1.16 - index * 0.18)

          return (
            <div
              key={item}
              className="summary-quote-card rounded-[20px] border border-white/75 bg-white/80 p-3 dark:border-white/10 dark:bg-zinc-950/65"
              style={{
                opacity: 0.4 + quoteProgress * 0.6,
                transform: `translateY(${(1 - quoteProgress) * 12}px)`,
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                Q0{item}
              </span>
              <div className="mt-3 space-y-2">
                <span className="block h-2 w-5/6 rounded-full bg-zinc-200/80 dark:bg-white/10" />
                <span className="block h-2 w-2/3 rounded-full bg-zinc-200/70 dark:bg-white/10" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HeroWorkflowPreview({ lang, mode = 'both' }: HeroWorkflowPreviewProps) {
  const heroFlowDurationMs = 40_000
  const heroInputDurationMs = 48_000
  const streamTypingStartMs = 2_200
  const streamCharIntervalMs = 24
  const processingStageVisibleStartPercent = 12
  const processingStageVisibleEndPercent = 40
  const processingStageExitPercent = 44
  const paperStageHiddenEndPercent = 44
  const paperStageEnterPercent = 46
  const paperStageZoomAnchorPercent = 50
  const paperStageZoomEndPercent = 60
  const paperStageExitPercent = 64
  const structureSequenceStartPercent = 66
  const structureSequenceStartMs = heroFlowDurationMs * (structureSequenceStartPercent / 100)
  const structureOverviewIntroMs = 480
  const structureFocusTransitionMs = 420
  const structureFocusHoldMs = 650
  const structureFocusMs = structureFocusTransitionMs + structureFocusHoldMs
  const structureResetMs = 300
  const structureActiveScale = 3
  const structureSlotMs = structureFocusMs + structureResetMs
  const structureSequenceBodyMs = ACTIONABLE_STRUCTURES.length * structureSlotMs
  const showMainPanel = mode !== 'secondary'
  const showSecondaryPanel = mode !== 'main'
  const [loopElapsedMs, setLoopElapsedMs] = useState(0)
  const [summaryLoopElapsedMs, setSummaryLoopElapsedMs] = useState(0)
  const [isAnimationPaused, setIsAnimationPaused] = useState(false)
  const [showAnimationDebugger, setShowAnimationDebugger] = useState(false)
  const loopElapsedRef = useRef(0)
  const summaryLoopElapsedRef = useRef(0)
  const animationStyle = {
    ['--hero-flow-duration' as string]: `${heroFlowDurationMs}ms`,
    ['--hero-input-duration' as string]: `${heroInputDurationMs}ms`,
  } as CSSProperties

  useEffect(() => {
    const syncPauseState = () => {
      setIsAnimationPaused(readSharedHeroPauseState())
    }

    syncPauseState()

    if (typeof window === 'undefined') return

    window.addEventListener(HERO_WORKFLOW_PAUSE_EVENT, syncPauseState)

    return () => {
      window.removeEventListener(HERO_WORKFLOW_PAUSE_EVENT, syncPauseState)
    }
  }, [])

  useEffect(() => {
    const enableDebugger =
      process.env.NODE_ENV !== 'production' ||
      new URLSearchParams(window.location.search).get('debugAnimations') === '1'

    setShowAnimationDebugger(enableDebugger)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !showAnimationDebugger) return

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.altKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        writeSharedHeroPauseState(!readSharedHeroPauseState())
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showAnimationDebugger])

  useEffect(() => {
    if (isAnimationPaused) return

    const resumedFromElapsedMs = loopElapsedRef.current
    const startedAt = performance.now()
    let frameId = 0

    const tick = () => {
      const nextElapsedMs = (performance.now() - startedAt + resumedFromElapsedMs) % heroFlowDurationMs
      loopElapsedRef.current = nextElapsedMs
      setLoopElapsedMs(nextElapsedMs)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [heroFlowDurationMs, isAnimationPaused])

  const structureFocusState = useMemo(() => {
    const elapsedSinceStart = loopElapsedMs - structureSequenceStartMs

    if (elapsedSinceStart < structureOverviewIntroMs) {
      return { activeIndex: null as number | null, isFocusActive: false }
    }

    const elapsedSinceSequence = elapsedSinceStart - structureOverviewIntroMs

    if (elapsedSinceSequence < 0 || elapsedSinceSequence >= structureSequenceBodyMs) {
      return { activeIndex: null as number | null, isFocusActive: false }
    }

    const activeIndex = Math.floor(elapsedSinceSequence / structureSlotMs)
    const slotElapsedMs = elapsedSinceSequence - activeIndex * structureSlotMs

    return {
      activeIndex,
      isFocusActive: slotElapsedMs < structureFocusMs,
    }
  }, [
    loopElapsedMs,
    structureFocusMs,
    structureOverviewIntroMs,
    structureSequenceBodyMs,
    structureSequenceStartMs,
    structureSlotMs,
  ])

  const processingStageVisibleStartMs = heroFlowDurationMs * (processingStageVisibleStartPercent / 100)
  const processingStageVisibleEndMs = heroFlowDurationMs * (processingStageVisibleEndPercent / 100)
  const processingStageExitEndMs = heroFlowDurationMs * (processingStageExitPercent / 100)
  const paperStageEnterMs = heroFlowDurationMs * (paperStageEnterPercent / 100)
  const paperStageZoomAnchorMs = heroFlowDurationMs * (paperStageZoomAnchorPercent / 100)
  const paperStageZoomEndMs = heroFlowDurationMs * (paperStageZoomEndPercent / 100)
  const paperStageExitEndMs = heroFlowDurationMs * (paperStageExitPercent / 100)
  const stageFadeMs = 280

  const heroStageStyles = useMemo(() => {
    let processingOpacity = 0
    let processingTranslateY = 10
    let processingScale = 0.985

    if (loopElapsedMs >= processingStageVisibleStartMs && loopElapsedMs < processingStageVisibleEndMs) {
      const enterProgress = clamp((loopElapsedMs - processingStageVisibleStartMs) / stageFadeMs)
      processingOpacity = enterProgress
      processingTranslateY = lerp(10, 0, enterProgress)
      processingScale = lerp(0.985, 1, enterProgress)
    } else if (loopElapsedMs >= processingStageVisibleEndMs && loopElapsedMs < processingStageExitEndMs) {
      const exitProgress = clamp(
        (loopElapsedMs - processingStageVisibleEndMs) /
          Math.max(processingStageExitEndMs - processingStageVisibleEndMs, 1),
      )
      processingOpacity = 1 - exitProgress
      processingTranslateY = lerp(0, -4, exitProgress)
      processingScale = lerp(1, 0.99, exitProgress)
    }

    let paperOpacity = 0
    let paperTranslateY = 12
    let paperScale = 0.985

    if (loopElapsedMs >= paperStageEnterMs && loopElapsedMs < paperStageZoomEndMs) {
      const enterProgress = clamp((loopElapsedMs - paperStageEnterMs) / stageFadeMs)
      paperOpacity = enterProgress
      paperTranslateY = lerp(12, 0, enterProgress)
      paperScale = lerp(0.985, 1, enterProgress)
    } else if (loopElapsedMs >= paperStageZoomEndMs && loopElapsedMs < paperStageExitEndMs) {
      const exitProgress = clamp(
        (loopElapsedMs - paperStageZoomEndMs) / Math.max(paperStageExitEndMs - paperStageZoomEndMs, 1),
      )
      paperOpacity = 1 - exitProgress
      paperTranslateY = lerp(0, -6, exitProgress)
      paperScale = lerp(1, 0.99, exitProgress)
    }

    let paperPageTranslateY = 28
    let paperPageScale = 0.48

    if (loopElapsedMs >= paperStageEnterMs && loopElapsedMs < paperStageZoomAnchorMs) {
      const enterProgress = clamp(
        (loopElapsedMs - paperStageEnterMs) / Math.max(paperStageZoomAnchorMs - paperStageEnterMs, 1),
      )
      paperPageTranslateY = lerp(28, 24, enterProgress)
      paperPageScale = lerp(0.48, 0.5, enterProgress)
    } else if (loopElapsedMs >= paperStageZoomAnchorMs && loopElapsedMs < paperStageZoomEndMs) {
      const zoomProgress = clamp(
        (loopElapsedMs - paperStageZoomAnchorMs) / Math.max(paperStageZoomEndMs - paperStageZoomAnchorMs, 1),
      )
      paperPageTranslateY = lerp(24, -118, zoomProgress)
      paperPageScale = lerp(0.5, 1, zoomProgress)
    } else if (loopElapsedMs >= paperStageZoomEndMs && loopElapsedMs < paperStageExitEndMs) {
      const exitProgress = clamp(
        (loopElapsedMs - paperStageZoomEndMs) / Math.max(paperStageExitEndMs - paperStageZoomEndMs, 1),
      )
      paperPageTranslateY = lerp(-118, -124, exitProgress)
      paperPageScale = lerp(1, 1.02, exitProgress)
    } else if (loopElapsedMs >= paperStageExitEndMs) {
      paperPageTranslateY = -124
      paperPageScale = 1.02
    }

    let structureOpacity = 0
    let structureTranslateY = 12
    let structureScale = 0.985

    if (loopElapsedMs >= structureSequenceStartMs) {
      const enterProgress = clamp((loopElapsedMs - structureSequenceStartMs) / stageFadeMs)
      structureOpacity = enterProgress
      structureTranslateY = lerp(12, 0, enterProgress)
      structureScale = lerp(0.985, 1, enterProgress)
    }

    return {
      processing: {
        opacity: processingOpacity,
        transform: `translateY(${processingTranslateY}px) scale(${processingScale})`,
      } as CSSProperties,
      paper: {
        opacity: paperOpacity,
        transform: `translateY(${paperTranslateY}px) scale(${paperScale})`,
      } as CSSProperties,
      paperPage: {
        transform: `translateY(${paperPageTranslateY}px) scale(${paperPageScale})`,
      } as CSSProperties,
      structure: {
        opacity: structureOpacity,
        transform: `translateY(${structureTranslateY}px) scale(${structureScale})`,
      } as CSSProperties,
    }
  }, [
    heroFlowDurationMs,
    loopElapsedMs,
    paperStageEnterMs,
    paperStageExitEndMs,
    paperStageZoomAnchorMs,
    paperStageZoomEndMs,
    processingStageExitEndMs,
    processingStageVisibleEndMs,
    processingStageVisibleStartMs,
    stageFadeMs,
    structureSequenceStartMs,
  ])
  const copy =
    lang === 'es'
      ? {
          badge: 'Flujo animado del resultado',
          loop: 'Demo narrativa con pausas extendidas',
          inputLabel: 'Notes Aide Action Extractor',
          actionCta: 'Extraer',
          recognized: 'URL reconocida',
          pdfReady: 'PDF cargado',
          pdfUploading: 'Subiendo PDF grande...',
          structureTitle: 'Define actionable structure',
          structureSubtitle: 'Preview the same playbook in every execution view.',
          structureCount: '9 views',
          secondaryTitle: 'Resultados accionables',
          secondarySubtitle: 'Una salida llena el contenedor y se desliza hacia la siguiente.',
          secondaryLive: 'Vista activa',
          secondaryAuto: 'Auto',
          secondaryManual: 'Manual',
          secondaryControlsHint: 'Puedes detenerlo, ir atrás o adelante y, en móvil, deslizar con el dedo. Si no interactúas, vuelve a avanzar solo.',
          secondaryPrevious: 'Ver slide anterior',
          secondaryNext: 'Ver slide siguiente',
          secondaryPause: 'Detener desplazamiento automático',
          secondaryResume: 'Reanudar desplazamiento automático',
          exportReady: '1-click integrated export',
          exportLine: 'El plan de acción queda listo para ejecutar en Notion y Trello.',
          primaryTag: 'Principal',
          sourceUrl: 'https://youtube.com/watch?v=notes-aide-demo',
          pdfFileName: 'board-strategy-report-q4-2026.pdf',
          pdfCharCount: '128.4k chars',
          streamPreview:
            '{"objective":"Convertir el episodio en un plan de ejecucion claro para el siguiente sprint.","phases":[{"title":"Capturar la idea central","items":["Identificar el resultado principal prometido en el video.","Extraer los argumentos que sostienen la recomendacion."]},{"title":"Traducir a ejecucion","items":["Definir la primera accion operativa para el equipo."]}]}',
          sheet: {
            timeLabel: 'Time',
            difficultyLabel: 'Difficulty',
            modeLabel: 'Mode',
            objectiveLabel: 'Result objective',
            breakdownLabel: 'Action breakdown',
            savedTime: '37 min',
            difficulty: 'High',
            modeValue: 'Action Plan',
            sourceSectionLabel: 'Analyzed content',
            sourceDisplayTitle: 'Board Strategy Briefing: priorities, risks and execution windows',
            objective:
              'Turn the source into a clear playbook with priorities, execution order, and the next move ready for the team.',
            breakdownItems: [
              {
                title: 'Launch alignment sprint',
                helper: '3 subitems · owner assigned',
                subitems: [
                  'Align owner, KPI, and due date',
                  'Define weekly review cadence',
                  'Create the Notion and Trello structure',
                ],
              },
              {
                title: 'Capture the executive summary',
                helper: 'Decision-ready notes',
              },
              {
                title: 'Test new monetization angles',
                helper: '2 experiments queued',
              },
            ],
          },
          cards: [
            {
              key: 'action-plan',
              title: 'Action Plan',
              description: 'Fases accionables con prioridades, tiempos y siguientes pasos listos para ejecutar.',
              bullets: ['Objetivo claro', 'Prioridades semanales', 'Próximo paso definido'],
              highlights: ['Objetivo claro', 'Prioridades semanales', 'Próximo paso definido'],
              accent:
                'border-cyan-200/80 bg-cyan-50/80 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-950/30 dark:text-cyan-200',
            },
            {
              key: 'executive-summary',
              title: 'Executive Summary',
              description: 'Contexto ejecutivo para entender el contenido y tomar decisiones sin releer todo.',
              highlights: ['Resumen decisivo', 'Puntos clave', 'Siguiente decisión'],
              accent:
                'border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200',
            },
            {
              key: 'business-ideas',
              title: 'Business Ideas',
              description: 'Oportunidades, experimentos y ángulos de monetización extraídos del material.',
              highlights: ['Oportunidades', 'Experimentos', 'Monetización'],
              accent:
                'border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200',
            },
            {
              key: 'key-quotes',
              title: 'Key Quotes',
              description: 'Citas clave ordenadas para reutilizar en contenido, estrategia y alineación interna.',
              highlights: ['Frases reutilizables', 'Mensajes clave', 'Alineación'],
              accent:
                'border-violet-200/80 bg-violet-50/80 text-violet-700 dark:border-violet-500/20 dark:bg-violet-950/30 dark:text-violet-200',
            },
          ],
        }
      : {
          badge: 'Animated output flow',
          loop: 'Narrative demo with extended pacing',
          inputLabel: 'Notes Aide Action Extractor',
          actionCta: 'Extract',
          recognized: 'URL recognized',
          pdfReady: 'PDF uploaded',
          pdfUploading: 'Uploading large PDF...',
          structureTitle: 'Define actionable structure',
          structureSubtitle: 'Preview the same playbook in every execution view.',
          structureCount: '9 views',
          secondaryTitle: 'Actionable outputs',
          secondarySubtitle: 'One output fills the frame and slides into the next.',
          secondaryLive: 'Live view',
          secondaryAuto: 'Auto',
          secondaryManual: 'Manual',
          secondaryControlsHint: 'You can stop it, go backward or forward, swipe on mobile, and it will resume automatically after inactivity.',
          secondaryPrevious: 'View previous slide',
          secondaryNext: 'View next slide',
          secondaryPause: 'Pause automatic sliding',
          secondaryResume: 'Resume automatic sliding',
          exportReady: '1-click integrated export',
          exportLine: 'The action plan is ready to execute in Notion and Trello.',
          primaryTag: 'Primary',
          sourceUrl: 'https://youtube.com/watch?v=notes-aide-demo',
          pdfFileName: 'board-strategy-report-q4-2026.pdf',
          pdfCharCount: '128.4k chars',
          streamPreview:
            '{"objective":"Turn the episode into a clear execution plan for the next sprint.","phases":[{"title":"Capture the core idea","items":["Identify the main outcome promised in the video.","Extract the arguments that support the recommendation."]},{"title":"Translate into execution","items":["Define the first operational action for the team."]}]}',
          sheet: {
            timeLabel: 'Time',
            difficultyLabel: 'Difficulty',
            modeLabel: 'Mode',
            objectiveLabel: 'Result objective',
            breakdownLabel: 'Action breakdown',
            savedTime: '37 min',
            difficulty: 'High',
            modeValue: 'Action Plan',
            sourceSectionLabel: 'Analyzed content',
            sourceDisplayTitle: 'Board Strategy Briefing: priorities, risks and execution windows',
            objective:
              'Turn the source into a clear playbook with priorities, execution order, and the next move ready for the team.',
            breakdownItems: [
              {
                title: 'Launch alignment sprint',
                helper: '3 subitems · owner assigned',
                subitems: [
                  'Align owner, KPI, and due date',
                  'Define weekly review cadence',
                  'Create the Notion and Trello structure',
                ],
              },
              {
                title: 'Capture the executive summary',
                helper: 'Decision-ready notes',
              },
              {
                title: 'Test new monetization angles',
                helper: '2 experiments queued',
              },
            ],
          },
          cards: [
            {
              key: 'action-plan',
              title: 'Action Plan',
              description: 'Actionable phases with priorities, timing, and next steps ready to execute.',
              bullets: ['Clear objective', 'Weekly priorities', 'Next step assigned'],
              highlights: ['Clear objective', 'Weekly priorities', 'Next step assigned'],
              accent:
                'border-cyan-200/80 bg-cyan-50/80 text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-950/30 dark:text-cyan-200',
            },
            {
              key: 'executive-summary',
              title: 'Executive Summary',
              description: 'Decision-ready context so leaders can act without re-reading the full source.',
              highlights: ['Decision ready', 'Key context', 'Next decision'],
              accent:
                'border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200',
            },
            {
              key: 'business-ideas',
              title: 'Business Ideas',
              description: 'Experiments, market angles, and monetization opportunities extracted from the material.',
              highlights: ['Opportunities', 'Experiments', 'Monetization'],
              accent:
                'border-amber-200/80 bg-amber-50/80 text-amber-700 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200',
            },
            {
              key: 'key-quotes',
              title: 'Key Quotes',
              description: 'High-signal quotes organized for reuse across content, strategy, and team alignment.',
              highlights: ['Reusable quotes', 'Core messages', 'Team alignment'],
              accent:
                'border-violet-200/80 bg-violet-50/80 text-violet-700 dark:border-violet-500/20 dark:bg-violet-950/30 dark:text-violet-200',
            },
          ],
        }

  const summarySlides = copy.cards as SummaryCard[]
  const summarySlideCount = summarySlides.length
  const summarySlideActiveMs = 4_200
  const summarySlideTransitionMs = 920
  const summarySlideSlotMs = summarySlideActiveMs + summarySlideTransitionMs
  const summarySlideTimelineMs = summarySlideCount * summarySlideSlotMs
  const summaryAutoResumeDelayMs = 12_000
  const summarySwipeThresholdPx = 56
  const summaryVisibleIndexFallback = 0
  const [primaryBreakdownItem, ...secondaryBreakdownItems] = copy.sheet.breakdownItems
  const processingStatus = `${t(lang, 'app.extracting')} (${getExtractionModeLabel(DEFAULT_EXTRACTION_MODE)})...`
  const [isSummaryManualControl, setIsSummaryManualControl] = useState(false)
  const [manualSummaryIndex, setManualSummaryIndex] = useState(summaryVisibleIndexFallback)
  const [summaryDragOffsetPx, setSummaryDragOffsetPx] = useState(0)
  const summaryAutoResumeTimeoutRef = useRef<number | null>(null)
  const summarySwipeGestureRef = useRef<{
    startX: number
    startY: number
    deltaX: number
    axis: 'x' | 'y' | null
    activatedManualControl: boolean
  } | null>(null)

  const clearSummaryAutoResumeTimeout = () => {
    if (typeof window === 'undefined') return
    if (summaryAutoResumeTimeoutRef.current === null) return

    window.clearTimeout(summaryAutoResumeTimeoutRef.current)
    summaryAutoResumeTimeoutRef.current = null
  }

  const normalizeSummaryIndex = (index: number) => {
    if (summarySlideCount <= 0) return summaryVisibleIndexFallback
    return (index + summarySlideCount) % summarySlideCount
  }

  const canUseSummarySwipe = () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 900px) and (pointer: coarse)').matches
  }

  const resetSummarySwipeGesture = (resetDragState = true) => {
    summarySwipeGestureRef.current = null
    if (resetDragState) {
      setSummaryDragOffsetPx(0)
    }
  }

  const syncSummaryLoopToIndex = (index: number) => {
    const normalizedIndex = normalizeSummaryIndex(index)
    const nextElapsedMs = normalizedIndex * summarySlideSlotMs
    summaryLoopElapsedRef.current = nextElapsedMs
    setSummaryLoopElapsedMs(nextElapsedMs)
    return normalizedIndex
  }

  const resumeSummaryAutoplay = (index = manualSummaryIndex) => {
    clearSummaryAutoResumeTimeout()
    const normalizedIndex = syncSummaryLoopToIndex(index)
    setManualSummaryIndex(normalizedIndex)
    setIsSummaryManualControl(false)
  }

  const scheduleSummaryAutoResume = (index: number) => {
    if (typeof window === 'undefined') return

    clearSummaryAutoResumeTimeout()
    summaryAutoResumeTimeoutRef.current = window.setTimeout(() => {
      resumeSummaryAutoplay(index)
    }, summaryAutoResumeDelayMs)
  }

  const activateSummaryManualControl = (index: number) => {
    const normalizedIndex = syncSummaryLoopToIndex(index)
    setManualSummaryIndex(normalizedIndex)
    setIsSummaryManualControl(true)
    scheduleSummaryAutoResume(normalizedIndex)
  }

  const handleSummaryManualPause = () => {
    const currentIndex = isSummaryManualControl ? manualSummaryIndex : summarySlideStateAuto.centerIndex
    activateSummaryManualControl(currentIndex)
  }

  const handleSummaryStep = (direction: -1 | 1) => {
    const currentIndex = isSummaryManualControl ? manualSummaryIndex : summarySlideStateAuto.centerIndex
    activateSummaryManualControl(currentIndex + direction)
  }

  const handleSummarySelect = (index: number) => {
    activateSummaryManualControl(index)
  }

  useEffect(() => {
    return () => {
      clearSummaryAutoResumeTimeout()
      resetSummarySwipeGesture(false)
    }
  }, [])

  useEffect(() => {
    if (summarySlideCount <= 0) {
      clearSummaryAutoResumeTimeout()
      resetSummarySwipeGesture()
      setIsSummaryManualControl(false)
      setManualSummaryIndex(summaryVisibleIndexFallback)
      return
    }

    setManualSummaryIndex((currentIndex) => normalizeSummaryIndex(currentIndex))
  }, [summarySlideCount])

  useEffect(() => {
    if (
      !showSecondaryPanel ||
      isAnimationPaused ||
      isSummaryManualControl ||
      summarySlideTimelineMs <= 0
    ) return

    const resumedFromElapsedMs = summaryLoopElapsedRef.current
    const startedAt = performance.now()
    let frameId = 0

    const tick = () => {
      const nextElapsedMs =
        (performance.now() - startedAt + resumedFromElapsedMs) % summarySlideTimelineMs
      summaryLoopElapsedRef.current = nextElapsedMs
      setSummaryLoopElapsedMs(nextElapsedMs)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [isAnimationPaused, isSummaryManualControl, showSecondaryPanel, summarySlideTimelineMs])

  const summarySlideStateAuto = useMemo(() => {
    if (summarySlideCount === 0) {
      return {
        activeIndex: 0,
        centerIndex: summaryVisibleIndexFallback,
        nextIndex: 0,
        previousIndex: 0,
        slotElapsedMs: 0,
        activeProgress: 0,
        transitionProgress: 0,
        isTransitioning: false,
      }
    }

    const activeIndex = Math.floor(summaryLoopElapsedMs / summarySlideSlotMs) % summarySlideCount
    const slotElapsedMs = summaryLoopElapsedMs - activeIndex * summarySlideSlotMs
    const isTransitioning = slotElapsedMs >= summarySlideActiveMs
    const transitionProgress = isTransitioning
      ? clamp((slotElapsedMs - summarySlideActiveMs) / summarySlideTransitionMs)
      : 0
    const activeProgress = clamp(slotElapsedMs / summarySlideActiveMs)
    const nextIndex = (activeIndex + 1) % summarySlideCount
    const previousIndex = (activeIndex - 1 + summarySlideCount) % summarySlideCount

    return {
      activeIndex,
      centerIndex: isTransitioning ? nextIndex : activeIndex,
      nextIndex,
      previousIndex,
      slotElapsedMs,
      activeProgress,
      transitionProgress,
      isTransitioning,
    }
  }, [
    summarySlideActiveMs,
    summarySlideCount,
    summarySlideSlotMs,
    summarySlideTransitionMs,
    summaryLoopElapsedMs,
  ])

  const summarySlideState = useMemo(() => {
    if (!isSummaryManualControl) return summarySlideStateAuto

    const activeIndex = normalizeSummaryIndex(manualSummaryIndex)

    return {
      activeIndex,
      centerIndex: activeIndex,
      nextIndex: normalizeSummaryIndex(activeIndex + 1),
      previousIndex: normalizeSummaryIndex(activeIndex - 1),
      slotElapsedMs: summarySlideActiveMs,
      activeProgress: 1,
      transitionProgress: 0,
      isTransitioning: false,
    }
  }, [
    isSummaryManualControl,
    manualSummaryIndex,
    summarySlideActiveMs,
    summarySlideStateAuto,
  ])

  const handleSummaryTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!canUseSummarySwipe() || event.touches.length !== 1) return

    const touch = event.touches[0]
    summarySwipeGestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      axis: null,
      activatedManualControl: false,
    }
  }

  const handleSummaryTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const gesture = summarySwipeGestureRef.current
    if (!gesture || !canUseSummarySwipe() || event.touches.length !== 1) return

    const touch = event.touches[0]
    const deltaX = touch.clientX - gesture.startX
    const deltaY = touch.clientY - gesture.startY
    gesture.deltaX = deltaX

    if (!gesture.axis) {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return
      gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
    }

    if (gesture.axis !== 'x') return

    event.preventDefault()

    if (!gesture.activatedManualControl) {
      handleSummaryManualPause()
      gesture.activatedManualControl = true
    }

    setSummaryDragOffsetPx(Math.max(Math.min(deltaX, 96), -96))
  }

  const finishSummaryTouchGesture = () => {
    const gesture = summarySwipeGestureRef.current
    if (!gesture) return

    const currentIndex = isSummaryManualControl ? manualSummaryIndex : summarySlideState.centerIndex
    const nextDirection =
      Math.abs(gesture.deltaX) >= summarySwipeThresholdPx
        ? gesture.deltaX < 0
          ? 1
          : -1
        : 0

    resetSummarySwipeGesture()

    if (gesture.axis !== 'x') return

    if (nextDirection === 0) {
      activateSummaryManualControl(currentIndex)
      return
    }

    activateSummaryManualControl(currentIndex + nextDirection)
  }

  const summarySlideMotions = useMemo(() => {
    return summarySlides.map((slide, index) => {
      const isLeaving = summarySlideState.isTransitioning && index === summarySlideState.activeIndex
      const isEntering = summarySlideState.isTransitioning && index === summarySlideState.nextIndex
      const isCentered = index === summarySlideState.centerIndex
      const isPrevious = index === summarySlideState.previousIndex
      const transitionProgress = summarySlideState.transitionProgress

      let translateX = 132
      let opacity = 0
      let scale = 0.96
      let zIndex = 1

      if (isLeaving) {
        translateX = lerp(0, -108, transitionProgress)
        opacity = lerp(1, 0.24, transitionProgress)
        scale = lerp(1, 0.978, transitionProgress)
        zIndex = 2
      } else if (isEntering) {
        translateX = lerp(108, 0, transitionProgress)
        opacity = lerp(0.28, 1, transitionProgress)
        scale = lerp(0.978, 1, transitionProgress)
        zIndex = 3
      } else if (!summarySlideState.isTransitioning && index === summarySlideState.activeIndex) {
        translateX = 0
        opacity = 1
        scale = 1
        zIndex = 3
      } else if (isPrevious) {
        translateX = -108
        opacity = 0.2
        scale = 0.972
        zIndex = 1
      } else if (index === summarySlideState.nextIndex) {
        translateX = 108
        opacity = 0.28
        scale = 0.978
        zIndex = 2
      }

      const focusProgress = isCentered
        ? summarySlideState.isTransitioning && isEntering
          ? transitionProgress * 0.34
          : summarySlideState.activeProgress
        : 0

      return {
        slide,
        index,
        isCentered,
        opacity,
        zIndex,
        focusProgress,
        style: {
          transform: `translate3d(calc(${translateX}% + ${summaryDragOffsetPx}px), 0, 0) scale(${scale})`,
          opacity,
          zIndex,
        } as CSSProperties,
        bodyStyle: {
          opacity: clamp(opacity + (isCentered ? 0.12 : 0)),
          transform: `translateY(${(1 - opacity) * 18}px) scale(${0.96 + opacity * 0.04})`,
        } as CSSProperties,
        visualStyle: {
          opacity: clamp(opacity + 0.08),
          transform: `translateY(${(1 - opacity) * 24}px) scale(${0.94 + opacity * 0.06})`,
        } as CSSProperties,
      }
    })
  }, [summaryDragOffsetPx, summarySlideState, summarySlides])

  const rootClassName = [
    showSecondaryPanel && !showMainPanel ? 'flex h-full w-full flex-col justify-center' : 'w-full space-y-6',
    isAnimationPaused ? 'animation-paused' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClassName} style={animationStyle}>
      {showMainPanel ? (
      <div className="flex h-full min-h-full flex-col rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-[0_20px_44px_-28px_rgba(15,23,42,0.5)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-black/30 md:p-7">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-900/20 dark:text-cyan-300">
            <Sparkles size={12} />
            {copy.badge}
          </span>
        </div>

        <div className="mt-5 flex flex-1 flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <p className="text-center text-[10px] font-bold tracking-[0.08em] text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
            {copy.inputLabel}
          </p>

          <div className="input-stage mt-3 relative min-h-[64px]">
            <div className="input-variant input-variant-youtube absolute inset-0">
              <div className="input-shell rounded-full border border-zinc-200 bg-white px-3 py-2 dark:border-white/15 dark:bg-zinc-950">
                <div className="flex items-center gap-2">
                  <div className="ml-2 shrink-0 text-zinc-400 dark:text-zinc-500">
                    <Play size={17} />
                  </div>

                  <div className="min-w-0 flex-1 overflow-hidden px-2">
                    <span className="typing-text block h-12 overflow-hidden py-3 text-base text-zinc-800 dark:text-zinc-100">
                      {copy.sourceUrl}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="upload-button shrink-0 rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <Paperclip size={16} />
                  </button>

                  <button
                    type="button"
                    className="action-button inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-violet-600 px-5 text-sm font-semibold text-white transition-colors duration-200"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    {copy.actionCta}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="input-variant input-variant-pdf absolute inset-0">
              <div className="input-shell rounded-full border border-zinc-200 bg-white px-3 py-2 dark:border-white/15 dark:bg-zinc-950">
                <div className="flex items-center gap-2">
                  <div className="ml-2 shrink-0 text-zinc-400 dark:text-zinc-500">
                    <FileText size={17} />
                  </div>

                  <div className="relative h-12 min-w-0 flex-1 overflow-hidden px-2">
                    <div className="pdf-uploading-state absolute inset-0 flex items-center gap-2 overflow-hidden">
                      <span className="pdf-inline-spinner h-4 w-4 shrink-0 rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-200" />
                      <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">{copy.pdfUploading}</span>
                    </div>

                    <div className="pdf-file-state absolute inset-0 flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {copy.pdfFileName}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">{copy.pdfCharCount}</span>
                      <button
                        type="button"
                        className="ml-auto shrink-0 rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="upload-button upload-button-pdf shrink-0 rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <span className="pdf-button-spinner h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-200" />
                    <Paperclip className="pdf-button-clip" size={16} />
                  </button>

                  <button
                    type="button"
                    className="action-button inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-violet-600 px-5 text-sm font-semibold text-white transition-colors duration-200"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    {copy.actionCta}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="recognition-chip recognition-chip-youtube inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-950/30 dark:text-cyan-300">
              {copy.recognized}
            </span>
            <span className="recognition-chip recognition-chip-pdf inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300">
              {copy.pdfReady}
            </span>
          </div>

          <div className="hero-generation-stage relative mt-4 flex-1 min-h-[320px] sm:min-h-[352px] lg:min-h-[390px]">
            <div className="processing-stream absolute inset-0" style={heroStageStyles.processing}>
              <ExtractionStreamingPreview
                streamPreview={copy.streamPreview}
                statusText={processingStatus}
                animateLikeChat
                loopDurationMs={heroFlowDurationMs}
                typingStartMs={streamTypingStartMs}
                charIntervalMs={streamCharIntervalMs}
                typingProfile="detailed"
                isPaused={isAnimationPaused}
                className="mb-0 mt-0 max-w-none"
              />
            </div>

            <div className="paper-sheet-stage absolute inset-0" style={heroStageStyles.paper}>
              <div className="paper-sheet-shell relative h-full min-h-[300px] overflow-hidden rounded-[26px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.5),rgba(2,6,23,0.75))] sm:min-h-[332px]">
                <div aria-hidden="true" className="paper-sheet-camera absolute inset-0 flex items-start justify-center px-3 py-3 sm:px-4 sm:py-4">
                  <div
                    className="paper-sheet-page w-[390px] shrink-0 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.45)] sm:w-[420px]"
                    style={heroStageStyles.paperPage}
                  >
                  <div className="border-b border-slate-200/80 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        Notes Aide Playbook
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 px-4 py-4">
                    <div className="paper-sheet-header border-b border-slate-200/70 pb-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-emerald-200/80 bg-emerald-50/70 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                          {copy.sheet.timeLabel}: {copy.sheet.savedTime}
                        </span>
                        <span className="rounded-md border border-orange-200/80 bg-orange-50/70 px-2 py-1 text-[10px] font-semibold text-orange-700">
                          {copy.sheet.difficultyLabel}: {copy.sheet.difficulty}
                        </span>
                        <span className="rounded-md border border-indigo-200/80 bg-indigo-50/70 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                          {copy.sheet.modeLabel}: {copy.sheet.modeValue}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {copy.sheet.sourceSectionLabel}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-700">
                        {copy.sheet.sourceDisplayTitle}
                      </p>
                    </div>

                    <div className="paper-sheet-objective-section border-b border-slate-200/70 pb-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {copy.sheet.objectiveLabel}
                      </p>
                      <p className="mt-1 line-clamp-4 text-[12px] leading-5 text-slate-700">
                        {copy.sheet.objective}
                      </p>
                    </div>

                    <div className="paper-sheet-breakdown-section rounded-[18px] border border-slate-200/80 bg-slate-50/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {copy.sheet.breakdownLabel}
                        </p>
                        <span className="paper-sheet-breakdown-badge rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                          Live breakdown
                        </span>
                      </div>

                      <div className="mt-2.5 space-y-2">
                        <div className="paper-sheet-breakdown-item-primary overflow-hidden rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.28)]">
                          <div className="flex items-start gap-2.5">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">
                              01
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold text-slate-700">
                                    {primaryBreakdownItem.title}
                                  </p>
                                  <p className="text-[10px] text-slate-500">{primaryBreakdownItem.helper}</p>
                                </div>
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                                  Open
                                </span>
                              </div>

                              <ul className="paper-sheet-subitems mt-2 space-y-1.5">
                                {primaryBreakdownItem.subitems?.map((item) => (
                                  <li key={item} className="paper-sheet-subitem flex items-start gap-2 text-[10px] leading-4 text-slate-600">
                                    <span className="mt-[4px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        {secondaryBreakdownItems.map((item, index) => (
                          <div
                            key={item.title}
                            className={`paper-sheet-breakdown-secondary paper-sheet-breakdown-secondary-${index + 1} rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2.5`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                                {String(index + 2).padStart(2, '0')}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold text-slate-700">{item.title}</p>
                                <p className="text-[10px] text-slate-500">{item.helper}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2.5">
                      <div className="rounded-[18px] border border-slate-200/80 bg-white/85 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Execution notes</p>
                        <div className="mt-2 space-y-1.5">
                          <span className="paper-sheet-line paper-sheet-line-1 block h-2 rounded-full bg-slate-200/80" />
                          <span className="paper-sheet-line paper-sheet-line-2 block h-2 rounded-full bg-slate-200/70" />
                          <span className="paper-sheet-line paper-sheet-line-3 block h-2 rounded-full bg-slate-200/60" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-[18px] border border-slate-200/80 bg-white/85 px-3 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Owners</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="h-6 w-6 rounded-full bg-cyan-100" />
                            <span className="paper-sheet-line block h-2 flex-1 rounded-full bg-slate-200/75" />
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-slate-200/80 bg-white/85 px-3 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Timeline</p>
                          <div className="mt-2 space-y-1.5">
                            <span className="paper-sheet-line block h-2 w-4/5 rounded-full bg-slate-200/75" />
                            <span className="paper-sheet-line block h-2 w-3/5 rounded-full bg-slate-200/65" />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Signals captured</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <span className="paper-sheet-pill rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-slate-500">
                            Priority
                          </span>
                          <span className="paper-sheet-pill rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-slate-500">
                            Risk
                          </span>
                          <span className="paper-sheet-pill rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-slate-500">
                            Owner
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
                <div className="paper-sheet-vignette pointer-events-none absolute inset-0" />
              </div>
            </div>

            <div className="structure-views-stage absolute inset-0" style={heroStageStyles.structure}>
              <div className="structure-views-shell h-full min-h-[300px] rounded-[26px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.55),rgba(2,6,23,0.82))] sm:min-h-[332px] sm:p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {copy.structureTitle}
                    </p>
                    <p className="mt-0.5 hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                      {copy.structureSubtitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
                    {copy.structureCount}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {ACTIONABLE_STRUCTURES.map(({ key, label, Icon }, index) => {
                    const isActive =
                      structureFocusState.isFocusActive && structureFocusState.activeIndex === index
                    const isDimmed =
                      structureFocusState.isFocusActive &&
                      structureFocusState.activeIndex !== null &&
                      structureFocusState.activeIndex !== index

                    return (
                      <article
                        key={key}
                        className={`structure-view-card rounded-2xl border border-slate-200/80 bg-white/92 p-1.5 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-950/65 ${
                          isActive ? 'structure-view-card-active' : ''
                        } ${isDimmed ? 'structure-view-card-dimmed' : ''}`}
                        style={{
                          zIndex: isActive ? 14 : 1,
                          opacity: isDimmed ? 0.18 : 1,
                          transform: isActive
                            ? `scale(${structureActiveScale}) translateY(-8px)`
                            : 'scale(1) translateY(0)',
                          boxShadow: isActive
                            ? '0 34px 80px -34px rgba(79,70,229,0.58)'
                            : '0 16px 30px -24px rgba(15,23,42,0.35)',
                          borderColor: isActive ? 'rgba(129, 140, 248, 0.78)' : undefined,
                        }}
                      >
                        <div className="mb-1.5 flex items-center gap-1">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            <Icon size={9} />
                          </span>
                          <span className="truncate text-[8px] font-bold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
                            {label}
                          </span>
                        </div>
                        <div className="structure-view-card-preview relative h-[42px] overflow-hidden sm:h-[48px]">
                          <div className="pointer-events-none absolute left-1/2 top-1/2 origin-center -translate-x-1/2 -translate-y-1/2 scale-[0.66] sm:scale-[0.78]">
                            <StructurePreviewMini kind={key} />
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {showSecondaryPanel ? (
      <div className="flex h-full w-full flex-col rounded-3xl border border-zinc-200/80 bg-white/90 p-4 shadow-[0_20px_44px_-30px_rgba(15,23,42,0.28)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/75 dark:shadow-black/20 md:p-5 lg:min-h-[min(44rem,calc(100svh-9rem))] lg:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {copy.secondaryTitle}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
              {copy.secondarySubtitle}
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {copy.secondaryControlsHint}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200">
              {isSummaryManualControl ? copy.secondaryManual : copy.secondaryAuto}
            </span>

            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-zinc-950/60">
              <button
                type="button"
                onClick={() => handleSummaryStep(-1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-offset-zinc-950"
                aria-label={copy.secondaryPrevious}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isSummaryManualControl) {
                    resumeSummaryAutoplay()
                    return
                  }

                  handleSummaryManualPause()
                }}
                className="inline-flex h-9 min-w-[3rem] items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 px-3 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-950"
                aria-label={isSummaryManualControl ? copy.secondaryResume : copy.secondaryPause}
              >
                {isSummaryManualControl ? <Play size={14} /> : <Pause size={14} />}
              </button>

              <button
                type="button"
                onClick={() => handleSummaryStep(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-offset-zinc-950"
                aria-label={copy.secondaryNext}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <span className="shrink-0 rounded-full border border-zinc-200 bg-white/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200">
              {String(summarySlideState.centerIndex + 1).padStart(2, '0')} / {String(summarySlideCount).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div
          className="summary-carousel-shell relative flex-1 overflow-hidden rounded-[30px] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0.94))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.56),rgba(2,6,23,0.78))] sm:min-h-[360px] sm:p-3 lg:min-h-0"
          onMouseEnter={handleSummaryManualPause}
          onFocusCapture={handleSummaryManualPause}
          onTouchStart={handleSummaryTouchStart}
          onTouchMove={handleSummaryTouchMove}
          onTouchEnd={finishSummaryTouchGesture}
          onTouchCancel={resetSummarySwipeGesture}
        >
          {summarySlideMotions.map(({ slide, index, isCentered, style, bodyStyle, visualStyle, focusProgress }) => {
            const Icon = getSummaryCardIcon(slide.key)
            const slideHighlights = slide.bullets ?? slide.highlights

            return (
              <article
                key={slide.key}
                className={`summary-slide absolute inset-0 p-2 sm:p-3 ${slide.accent} ${isCentered ? 'summary-slide-emphasized' : ''}`}
                style={style}
                aria-hidden={!isCentered}
              >
                <div className="summary-slide-frame flex h-full min-h-[320px] flex-col gap-5 overflow-hidden rounded-[28px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,250,252,0.82))] p-4 shadow-[0_26px_60px_-42px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))] sm:p-5 lg:min-h-[340px] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:gap-6 lg:p-6">
                  <div className="summary-slide-body flex min-w-0 flex-1 flex-col" style={bodyStyle}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/75 bg-white/85 text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-950/55 dark:text-zinc-200">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                            {String(index + 1).padStart(2, '0')}
                          </p>
                          <h3 className="truncate text-lg font-black text-zinc-900 dark:text-white sm:text-[1.35rem]">
                            {slide.title}
                          </h3>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-full border border-white/70 bg-white/82 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700 dark:border-white/10 dark:bg-zinc-950/55 dark:text-zinc-200">
                        {slide.key === 'action-plan' ? copy.primaryTag : copy.secondaryLive}
                      </span>
                    </div>

                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-200 sm:text-[15px]">
                      {slide.description}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {slideHighlights.map((item, itemIndex) => {
                        const itemProgress = clamp(focusProgress * 1.18 - itemIndex * 0.14)

                        return (
                          <span
                            key={item}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/84 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-200"
                            style={{
                              opacity: 0.42 + itemProgress * 0.58,
                              transform: `translateY(${(1 - itemProgress) * 10}px)`,
                            }}
                          >
                            <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                            {item}
                          </span>
                        )
                      })}
                    </div>

                    <div className="mt-auto pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                          {copy.secondaryLive}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                          {String(index + 1).padStart(2, '0')} / {String(summarySlideCount).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60 dark:bg-white/10">
                        <span
                          className="summary-progress-beam block h-full rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-500"
                          style={{ width: `${18 + focusProgress * 82}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="summary-slide-visual flex min-w-0 flex-1 items-stretch" style={visualStyle}>
                    <SummarySlideVisual
                      card={slide}
                      progress={focusProgress}
                      exportLine={copy.exportLine}
                      exportReady={copy.exportReady}
                    />
                  </div>
                </div>
              </article>
            )
          })}

          <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-2">
            {summarySlides.map((slide, index) => {
              const isActive = index === summarySlideState.centerIndex

              return (
                <button
                  type="button"
                  key={slide.key}
                  onClick={() => handleSummarySelect(index)}
                  className="block h-2 rounded-full bg-zinc-300/90 dark:bg-white/20"
                  aria-label={`${slide.title} ${String(index + 1).padStart(2, '0')}`}
                  style={{
                    width: isActive ? '2.5rem' : '0.6rem',
                    opacity: isActive ? 1 : 0.42,
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
      ) : null}

      <style jsx>{`
        .typing-text {
          display: inline-block;
          max-width: 0;
          overflow: hidden;
          white-space: nowrap;
          border-right: 1px solid currentColor;
          animation:
            typingLoop var(--hero-flow-duration) steps(40, end) infinite,
            caretBlink 1s step-end infinite;
        }

        .animation-paused .typing-text,
        .animation-paused .input-shell,
        .animation-paused .action-button,
        .animation-paused .input-variant,
        .animation-paused .recognition-chip,
        .animation-paused .pdf-uploading-state,
        .animation-paused .pdf-file-state,
        .animation-paused .pdf-inline-spinner,
        .animation-paused .pdf-button-spinner,
        .animation-paused .pdf-button-clip,
        .animation-paused .processing-stream,
        .animation-paused .paper-sheet-stage,
        .animation-paused .structure-views-stage,
        .animation-paused .paper-sheet-page,
        .animation-paused .paper-sheet-breakdown-section,
        .animation-paused .paper-sheet-breakdown-badge,
        .animation-paused .paper-sheet-breakdown-item-primary,
        .animation-paused .paper-sheet-breakdown-secondary,
        .animation-paused .paper-sheet-subitems,
        .animation-paused .paper-sheet-subitem,
        .animation-paused .paper-sheet-line,
        .animation-paused .paper-sheet-pill,
        .animation-paused .summary-progress-beam,
        .animation-paused .summary-slide-emphasized .summary-visual-card,
        .animation-paused .summary-slide-emphasized .summary-brief-card,
        .animation-paused .summary-slide-emphasized .summary-idea-card,
        .animation-paused .summary-slide-emphasized .summary-quote-card,
        .animation-paused .summary-slide-emphasized .summary-step-card,
        .animation-paused .summary-slide-emphasized .summary-export-panel,
        .animation-paused .summary-slide-emphasized .summary-quote-chip,
        .animation-paused :global(.animate-spin),
        .animation-paused :global(.animate-pulse) {
          animation-play-state: paused !important;
        }

        .input-shell {
          position: relative;
          animation: inputShell var(--hero-flow-duration) infinite;
        }

        .action-button {
          animation: actionButton var(--hero-flow-duration) infinite;
        }

        .input-variant {
          animation: inputVariantSwap var(--hero-input-duration) infinite;
        }

        .input-variant-pdf {
          opacity: 0;
          animation-name: inputVariantSwapAlt;
        }

        .recognition-chip-youtube {
          animation-name: recognitionChipYoutube;
          animation-duration: var(--hero-input-duration);
        }

        .recognition-chip-pdf {
          opacity: 0;
          animation-name: recognitionChipPdf;
          animation-duration: var(--hero-input-duration);
        }

        .pdf-uploading-state,
        .pdf-file-state {
          animation-duration: var(--hero-flow-duration);
          animation-iteration-count: infinite;
          animation-timing-function: ease;
        }

        .pdf-uploading-state {
          animation-name: pdfUploadingState;
        }

        .pdf-file-state {
          opacity: 0;
          transform: translateY(6px);
          animation-name: pdfFileState;
        }

        .pdf-inline-spinner,
        .pdf-button-spinner {
          animation:
            spinnerRotate 0.9s linear infinite,
            pdfSpinnerVisibility var(--hero-flow-duration) infinite;
        }

        .upload-button-pdf {
          position: relative;
        }

        .pdf-button-spinner,
        .pdf-button-clip {
          position: absolute;
          top: 50%;
          left: 50%;
        }

        .pdf-button-spinner {
          margin-left: -0.5rem;
          margin-top: -0.5rem;
        }

        .pdf-button-clip {
          transform: translate(-50%, -50%);
        }

        .pdf-button-clip {
          animation: pdfClipVisibility var(--hero-flow-duration) infinite;
        }

        .recognition-chip,
        .paper-sheet-stage,
        .structure-views-stage,
        .processing-stream {
          opacity: 0;
          transform: translateY(8px);
        }

        .recognition-chip {
          animation-iteration-count: infinite;
          animation-timing-function: ease;
        }

        .processing-stream {
          z-index: 0;
        }

        .paper-sheet-stage {
          z-index: 1;
        }

        .structure-views-stage {
          z-index: 2;
        }

        .structure-view-card {
          position: relative;
          transform-origin: center center;
          transition:
            transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 320ms ease,
            box-shadow 360ms ease,
            border-color 360ms ease,
            background-color 360ms ease;
          will-change: transform, opacity, box-shadow;
        }

        .paper-sheet-page {
          transform-origin: top center;
        }

        .paper-sheet-vignette {
          background:
            radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0) 0, rgba(255, 255, 255, 0) 36%, rgba(148, 163, 184, 0.12) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(148, 163, 184, 0.08) 100%);
        }

        .structure-view-card-preview {
          transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease;
          transform-origin: center center;
        }

        .structure-view-card-active {
          background: rgba(255, 255, 255, 0.98);
        }

        .structure-view-card-active .structure-view-card-preview {
          transform: scale(1.06);
        }

        .structure-view-card-dimmed .structure-view-card-preview {
          opacity: 0.74;
        }

        .paper-sheet-breakdown-section {
          transform-origin: center top;
          animation: paperSheetBreakdownFocus var(--hero-flow-duration) infinite;
        }

        .paper-sheet-breakdown-badge,
        .paper-sheet-breakdown-secondary,
        .paper-sheet-line,
        .paper-sheet-pill {
          animation-duration: var(--hero-flow-duration);
          animation-iteration-count: infinite;
          animation-timing-function: ease;
        }

        .paper-sheet-breakdown-badge {
          animation-name: paperSheetBadgePulse;
        }

        .paper-sheet-breakdown-item-primary {
          animation: paperSheetPrimaryItem var(--hero-flow-duration) infinite;
        }

        .paper-sheet-subitems {
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transform: translateY(-4px);
          animation: paperSheetSubitems var(--hero-flow-duration) infinite;
        }

        .paper-sheet-subitem {
          opacity: 0;
          transform: translateX(-6px);
          animation-duration: var(--hero-flow-duration);
          animation-iteration-count: infinite;
          animation-timing-function: ease;
        }

        .paper-sheet-subitem:nth-child(1) {
          animation-name: paperSheetSubitem1;
        }

        .paper-sheet-subitem:nth-child(2) {
          animation-name: paperSheetSubitem2;
        }

        .paper-sheet-subitem:nth-child(3) {
          animation-name: paperSheetSubitem3;
        }

        .paper-sheet-breakdown-secondary-1 {
          animation-name: paperSheetSecondary1;
        }

        .paper-sheet-breakdown-secondary-2 {
          animation-name: paperSheetSecondary2;
        }

        .paper-sheet-line-1 {
          animation-name: paperSheetLine1;
        }

        .paper-sheet-line-2 {
          animation-name: paperSheetLine2;
        }

        .paper-sheet-line-3 {
          animation-name: paperSheetLine3;
        }

        .summary-carousel-shell {
          min-height: clamp(32rem, 94vw, 36rem);
          touch-action: pan-y;
        }

        .summary-slide,
        .summary-slide-body,
        .summary-slide-visual,
        .summary-visual-card,
        .summary-step-card,
        .summary-brief-card,
        .summary-idea-card,
        .summary-quote-card,
        .summary-export-panel,
        .summary-quote-chip,
        .summary-progress-beam {
          will-change: transform, opacity;
        }

        .summary-slide-frame {
          height: 100%;
        }

        .summary-slide-visual {
          min-height: 0;
        }

        .summary-visual-stack {
          display: flex;
          min-height: 0;
          width: 100%;
          flex: 1;
          flex-direction: column;
          gap: 0.75rem;
        }

        .summary-progress-beam {
          transform-origin: left center;
        }

        .summary-slide-emphasized .summary-visual-card,
        .summary-slide-emphasized .summary-step-card,
        .summary-slide-emphasized .summary-brief-card,
        .summary-slide-emphasized .summary-idea-card,
        .summary-slide-emphasized .summary-quote-card,
        .summary-slide-emphasized .summary-export-panel {
          animation: summaryFloat 3.8s ease-in-out infinite;
        }

        .summary-slide-emphasized .summary-step-card:nth-child(2),
        .summary-slide-emphasized .summary-brief-card:nth-child(2),
        .summary-slide-emphasized .summary-idea-card:nth-child(2),
        .summary-slide-emphasized .summary-quote-card:nth-child(2) {
          animation-delay: 120ms;
        }

        .summary-slide-emphasized .summary-step-card:nth-child(3),
        .summary-slide-emphasized .summary-brief-card:nth-child(3),
        .summary-slide-emphasized .summary-idea-card:nth-child(3) {
          animation-delay: 240ms;
        }

        .summary-slide-emphasized .summary-progress-beam {
          animation: summaryBeam 2.9s ease-in-out infinite;
        }

        .summary-slide-emphasized .summary-quote-chip {
          animation: summaryChipPulse 2.8s ease-in-out infinite;
        }

        @media (min-width: 640px) {
          .summary-carousel-shell {
            min-height: clamp(24rem, 40vw, 27rem);
          }
        }

        @media (min-width: 1024px) {
          .summary-carousel-shell {
            min-height: clamp(22rem, 28vw, 24.5rem);
          }
        }

        @keyframes typingLoop {
          0%,
          4% {
            max-width: 0;
          }
          18%,
          100% {
            max-width: 38ch;
          }
        }

        @keyframes caretBlink {
          0%,
          49% {
            border-right-color: currentColor;
          }
          50%,
          100% {
            border-right-color: transparent;
          }
        }

        @keyframes inputShell {
          0%,
          16% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 0 rgba(6, 182, 212, 0);
          }
          18%,
          26% {
            transform: translateY(0) scale(1.01);
            box-shadow: 0 0 0 8px rgba(6, 182, 212, 0.08);
          }
          34%,
          52% {
            transform: translateY(-1px) scale(0.97);
            box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.06);
          }
          100% {
            transform: translateY(0) scale(0.985);
            box-shadow: 0 0 0 0 rgba(6, 182, 212, 0);
          }
        }

        @keyframes actionButton {
          0%,
          17%,
          100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 14px 28px -18px rgba(124, 58, 237, 0.45);
          }
          22% {
            transform: translateY(2px) scale(0.96);
            box-shadow: 0 8px 16px -18px rgba(91, 33, 182, 0.35);
          }
          28%,
          34% {
            transform: translateY(0) scale(1);
            box-shadow: 0 18px 32px -18px rgba(139, 92, 246, 0.5);
          }
        }

        @keyframes recognitionChip {
          0%,
          14% {
            opacity: 0;
            transform: translateY(8px);
          }
          18%,
          30% {
            opacity: 1;
            transform: translateY(0);
          }
          40%,
          100% {
            opacity: 0;
            transform: translateY(-4px);
          }
        }

        @keyframes recognitionChipYoutube {
          0%,
          14% {
            opacity: 0;
            transform: translateY(8px);
          }
          18%,
          30% {
            opacity: 1;
            transform: translateY(0);
          }
          40%,
          48% {
            opacity: 0;
            transform: translateY(-4px);
          }
          100% {
            opacity: 0;
            transform: translateY(-4px);
          }
        }

        @keyframes recognitionChipPdf {
          0%,
          50% {
            opacity: 0;
            transform: translateY(8px);
          }
          64%,
          80% {
            opacity: 1;
            transform: translateY(0);
          }
          90%,
          100% {
            opacity: 0;
            transform: translateY(-4px);
          }
        }

        @keyframes inputVariantSwap {
          0%,
          47% {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
          }
          49%,
          100% {
            opacity: 0;
            transform: translateY(6px) scale(0.985);
            pointer-events: none;
          }
        }

        @keyframes inputVariantSwapAlt {
          0%,
          49% {
            opacity: 0;
            transform: translateY(6px) scale(0.985);
            pointer-events: none;
          }
          52%,
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
          }
        }

        @keyframes pdfUploadingState {
          0%,
          18% {
            opacity: 1;
            transform: translateY(0);
          }
          28%,
          100% {
            opacity: 0;
            transform: translateY(-4px);
          }
        }

        @keyframes pdfFileState {
          0%,
          18% {
            opacity: 0;
            transform: translateY(6px);
          }
          28%,
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pdfSpinnerVisibility {
          0%,
          18% {
            opacity: 1;
          }
          28%,
          100% {
            opacity: 0;
          }
        }

        @keyframes pdfClipVisibility {
          0%,
          18% {
            opacity: 0;
          }
          28%,
          100% {
            opacity: 1;
          }
        }

        @keyframes spinnerRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes processingStreamReveal {
          0%,
          10% {
            opacity: 0;
            transform: translateY(10px);
          }
          ${processingStageVisibleStartPercent}%,
          ${processingStageVisibleEndPercent}% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          ${processingStageExitPercent}%,
          100% {
            opacity: 0;
            transform: translateY(-4px) scale(0.99);
          }
        }

        @keyframes paperSheetReveal {
          0%,
          ${paperStageHiddenEndPercent}% {
            opacity: 0;
            transform: translateY(12px) scale(0.985);
          }
          ${paperStageEnterPercent}%,
          ${paperStageZoomEndPercent}% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          ${paperStageExitPercent}%,
          100% {
            opacity: 0;
            transform: translateY(-6px) scale(0.99);
          }
        }

        @keyframes paperSheetPageZoom {
          0%,
          ${paperStageHiddenEndPercent}% {
            transform: translateY(28px) scale(0.48);
          }
          ${paperStageZoomAnchorPercent}% {
            transform: translateY(24px) scale(0.5);
          }
          ${paperStageZoomEndPercent}% {
            transform: translateY(-118px) scale(1);
          }
          ${paperStageExitPercent}%,
          100% {
            transform: translateY(-124px) scale(1.02);
          }
        }

        @keyframes structureViewsReveal {
          0%,
          ${structureSequenceStartPercent - 0.1}% {
            opacity: 0;
            transform: translateY(12px) scale(0.985);
          }
          ${structureSequenceStartPercent}%,
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes paperSheetBreakdownFocus {
          0%,
          40% {
            border-color: rgba(226, 232, 240, 0.8);
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
            background: rgba(248, 250, 252, 0.8);
          }
          48%,
          60% {
            border-color: rgba(165, 180, 252, 0.9);
            box-shadow: 0 0 0 1px rgba(165, 180, 252, 0.45), 0 18px 40px -28px rgba(79, 70, 229, 0.55);
            background: rgba(238, 242, 255, 0.85);
          }
          100% {
            border-color: rgba(199, 210, 254, 0.85);
            box-shadow: 0 0 0 1px rgba(199, 210, 254, 0.35), 0 14px 34px -28px rgba(79, 70, 229, 0.45);
            background: rgba(238, 242, 255, 0.82);
          }
        }

        @keyframes paperSheetBadgePulse {
          0%,
          44% {
            opacity: 0.75;
            transform: scale(1);
          }
          52%,
          60% {
            opacity: 1;
            transform: scale(1.04);
          }
          100% {
            opacity: 0.95;
            transform: scale(1);
          }
        }

        @keyframes paperSheetPrimaryItem {
          0%,
          44% {
            box-shadow: 0 8px 22px -26px rgba(15, 23, 42, 0.18);
            border-color: rgba(226, 232, 240, 0.8);
            background: rgba(255, 255, 255, 0.94);
          }
          52%,
          60% {
            box-shadow: 0 24px 44px -28px rgba(79, 70, 229, 0.42);
            border-color: rgba(165, 180, 252, 0.9);
            background: rgba(255, 255, 255, 1);
          }
          100% {
            box-shadow: 0 18px 36px -28px rgba(79, 70, 229, 0.35);
            border-color: rgba(199, 210, 254, 0.82);
            background: rgba(255, 255, 255, 1);
          }
        }

        @keyframes paperSheetSubitems {
          0%,
          46% {
            max-height: 0;
            opacity: 0;
            transform: translateY(-4px);
          }
          52%,
          60% {
            max-height: 104px;
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            max-height: 104px;
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes paperSheetSubitem1 {
          0%,
          52% {
            opacity: 0;
            transform: translateX(-6px);
          }
          56%,
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes paperSheetSubitem2 {
          0%,
          53% {
            opacity: 0;
            transform: translateX(-6px);
          }
          57%,
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes paperSheetSubitem3 {
          0%,
          54% {
            opacity: 0;
            transform: translateX(-6px);
          }
          58%,
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes paperSheetSecondary1 {
          0%,
          48% {
            opacity: 0.84;
            transform: translateY(0);
          }
          54%,
          60% {
            opacity: 1;
            transform: translateY(1px);
          }
          100% {
            opacity: 1;
            transform: translateY(1px);
          }
        }

        @keyframes paperSheetSecondary2 {
          0%,
          50% {
            opacity: 0.82;
            transform: translateY(0);
          }
          56%,
          60% {
            opacity: 1;
            transform: translateY(2px);
          }
          100% {
            opacity: 1;
            transform: translateY(2px);
          }
        }

        @keyframes paperSheetLine1 {
          0%,
          44% {
            opacity: 0.65;
            width: 74%;
          }
          52%,
          60% {
            opacity: 1;
            width: 92%;
          }
          100% {
            opacity: 0.9;
            width: 92%;
          }
        }

        @keyframes paperSheetLine2 {
          0%,
          46% {
            opacity: 0.62;
            width: 56%;
          }
          54%,
          60% {
            opacity: 0.92;
            width: 78%;
          }
          100% {
            opacity: 0.85;
            width: 78%;
          }
        }

        @keyframes paperSheetLine3 {
          0%,
          48% {
            opacity: 0.58;
            width: 48%;
          }
          56%,
          60% {
            opacity: 0.88;
            width: 68%;
          }
          100% {
            opacity: 0.8;
            width: 68%;
          }
        }

        @keyframes summaryFloat {
          0%,
          100% {
            filter: brightness(1);
            box-shadow: 0 18px 42px -34px rgba(15, 23, 42, 0.24);
          }
          50% {
            filter: brightness(1.03);
            box-shadow: 0 24px 52px -34px rgba(15, 23, 42, 0.34);
          }
        }

        @keyframes summaryBeam {
          0%,
          100% {
            filter: saturate(1);
            transform: scaleX(0.96);
          }
          50% {
            filter: saturate(1.18);
            transform: scaleX(1);
          }
        }

        @keyframes summaryChipPulse {
          0%,
          100% {
            filter: saturate(1) brightness(1);
          }
          50% {
            filter: saturate(1.08) brightness(1.04);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .input-variant,
          .typing-text,
          .input-shell,
          .action-button,
          .recognition-chip,
          .pdf-uploading-state,
          .pdf-file-state,
          .pdf-inline-spinner,
          .pdf-button-spinner,
          .pdf-button-clip,
          .processing-stream,
          .paper-sheet-stage,
          .structure-views-stage,
          .paper-sheet-page,
          .paper-sheet-breakdown-section,
          .paper-sheet-breakdown-badge,
          .paper-sheet-breakdown-item-primary,
          .paper-sheet-breakdown-secondary,
          .paper-sheet-subitems,
          .paper-sheet-subitem,
          .paper-sheet-line,
          .paper-sheet-pill,
          .summary-progress-beam,
          .summary-slide-emphasized .summary-visual-card,
          .summary-slide-emphasized .summary-step-card,
          .summary-slide-emphasized .summary-brief-card,
          .summary-slide-emphasized .summary-idea-card,
          .summary-slide-emphasized .summary-quote-card,
          .summary-slide-emphasized .summary-export-panel,
          .summary-slide-emphasized .summary-quote-chip {
            animation: none !important;
          }

          .typing-text {
            max-width: 38ch;
          }

          .recognition-chip,
          .processing-stream,
          .paper-sheet-stage,
          .structure-views-stage,
          .paper-sheet-breakdown-section,
          .paper-sheet-breakdown-badge,
          .paper-sheet-breakdown-secondary,
          .paper-sheet-subitems,
          .paper-sheet-subitem {
            opacity: 1;
            transform: none;
          }

          .paper-sheet-subitems {
            max-height: 104px;
          }

          .input-variant-pdf,
          .recognition-chip-pdf,
          .pdf-button-spinner {
            opacity: 0;
          }

          .summary-progress-beam {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  )
}
