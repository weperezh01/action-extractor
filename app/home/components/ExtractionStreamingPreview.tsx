'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type TypingProfile = 'default' | 'detailed'

interface ExtractionStreamingPreviewProps {
  streamPreview: string
  statusText: string
  className?: string
  animateLikeChat?: boolean
  loopDurationMs?: number
  typingStartMs?: number
  charIntervalMs?: number
  typingProfile?: TypingProfile
  isPaused?: boolean
}

function parseStreamPreview(raw: string): {
  objective: string | null
  phases: Array<{ title: string; items: string[] }>
} {
  if (!raw) return { objective: null, phases: [] }

  const objM = raw.match(/"objective"\s*:\s*"([^"]+)"/)
  const objective = objM ? objM[1].trim() || null : null

  const phasesIdx = raw.indexOf('"phases"')
  if (phasesIdx === -1) return { objective, phases: [] }
  const phasesText = raw.slice(phasesIdx)

  const phases: Array<{ title: string; items: string[] }> = []
  const titleRe = /"title"\s*:\s*"([^"]+)"/g
  let titleMatch: RegExpExecArray | null
  while ((titleMatch = titleRe.exec(phasesText)) !== null) {
    const title = titleMatch[1].trim()
    if (!title) continue

    const afterTitle = phasesText.slice(titleMatch.index + titleMatch[0].length)
    const itemsIdx = afterTitle.indexOf('"items"')
    const items: string[] = []

    if (itemsIdx !== -1) {
      const afterItems = afterTitle.slice(itemsIdx)
      const bracketIdx = afterItems.indexOf('[')
      if (bracketIdx !== -1) {
        const arrayContent = afterItems.slice(bracketIdx + 1)
        const closingBracket = arrayContent.indexOf(']')
        const content = closingBracket !== -1 ? arrayContent.slice(0, closingBracket) : arrayContent
        const itemRe = /"([^"]{4,})"/g
        let itemM: RegExpExecArray | null
        while ((itemM = itemRe.exec(content)) !== null) {
          const item = itemM[1].trim()
          if (item) items.push(item)
        }
      }
    }

    phases.push({ title, items })
  }

  return { objective, phases }
}

export function ExtractionStreamingPreview({
  streamPreview,
  statusText,
  className = '',
  animateLikeChat = false,
  loopDurationMs = 5000,
  typingStartMs = 0,
  charIntervalMs = 12,
  typingProfile = 'default',
  isPaused = false,
}: ExtractionStreamingPreviewProps) {
  const parsed = useMemo(() => parseStreamPreview(streamPreview), [streamPreview])
  const PHASES = 3
  const skeletonTitleWidths = [42, 58, 36]
  const [loopElapsedMs, setLoopElapsedMs] = useState(0)
  const loopElapsedRef = useRef(0)
  const timingConfig = useMemo(
    () =>
      typingProfile === 'detailed'
        ? {
            emptyObjectiveMs: 220,
            objectiveBaseMs: 120,
            objectiveMaxMs: 2200,
            afterObjectivePauseMs: 320,
            emptyPhaseMs: 180,
            phaseTitleBaseMs: 90,
            phaseTitleMaxMs: 820,
            afterPhaseTitlePauseMs: 160,
            phaseItemBaseMs: 110,
            phaseItemMaxMs: 1560,
            betweenPhaseItemsPauseMs: 220,
            emptyItemsMs: 140,
            afterPhasePauseMs: 260,
          }
        : {
            emptyObjectiveMs: 180,
            objectiveBaseMs: 60,
            objectiveMaxMs: 420,
            afterObjectivePauseMs: 0,
            emptyPhaseMs: 120,
            phaseTitleBaseMs: 40,
            phaseTitleMaxMs: 180,
            afterPhaseTitlePauseMs: 0,
            phaseItemBaseMs: 50,
            phaseItemMaxMs: 260,
            betweenPhaseItemsPauseMs: 0,
            emptyItemsMs: 120,
            afterPhasePauseMs: 0,
          },
    [typingProfile]
  )

  useEffect(() => {
    if (!animateLikeChat || isPaused) return

    const resumedFromElapsedMs = loopElapsedRef.current
    const startedAt = performance.now()
    let frameId = 0

    const tick = () => {
      const nextElapsedMs = (performance.now() - startedAt + resumedFromElapsedMs) % loopDurationMs
      loopElapsedRef.current = nextElapsedMs
      setLoopElapsedMs(nextElapsedMs)
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [animateLikeChat, isPaused, loopDurationMs, streamPreview])

  const timingPlan = useMemo(() => {
    let cursor = typingStartMs
    const objectiveText = parsed.objective ?? ''
    const objectiveStart = cursor
    cursor += objectiveText
      ? Math.min(timingConfig.objectiveMaxMs, objectiveText.length * charIntervalMs + timingConfig.objectiveBaseMs)
      : timingConfig.emptyObjectiveMs
    cursor += timingConfig.afterObjectivePauseMs

    const phases = Array.from({ length: PHASES }, (_, index) => {
      const phase = parsed.phases[index]
      const titleText = phase?.title ?? ''
      const titleStart = cursor
      cursor += phase
        ? Math.min(timingConfig.phaseTitleMaxMs, titleText.length * charIntervalMs + timingConfig.phaseTitleBaseMs)
        : timingConfig.emptyPhaseMs
      cursor += timingConfig.afterPhaseTitlePauseMs

      const itemStarts = phase?.items.map((item, itemIndex, items) => {
        const start = cursor
        cursor += Math.min(timingConfig.phaseItemMaxMs, item.length * charIntervalMs + timingConfig.phaseItemBaseMs)
        if (itemIndex < items.length - 1) {
          cursor += timingConfig.betweenPhaseItemsPauseMs
        }
        return start
      }) ?? []

      if (!phase?.items.length) {
        cursor += timingConfig.emptyItemsMs
      }

      cursor += timingConfig.afterPhasePauseMs

      return { titleStart, itemStarts }
    })

    return { objectiveStart, phases }
  }, [PHASES, charIntervalMs, parsed.objective, parsed.phases, timingConfig, typingStartMs])

  const getTypedChunk = (text: string | null | undefined, startMs: number) => {
    const safeText = text ?? ''
    if (!animateLikeChat) {
      return { value: safeText, active: false }
    }

    const visibleChars = Math.max(0, Math.floor((loopElapsedMs - startMs) / charIntervalMs))
    const value = safeText.slice(0, Math.min(visibleChars, safeText.length))
    const active = visibleChars > 0 && visibleChars < safeText.length
    return { value, active }
  }

  const objectiveChunk = getTypedChunk(parsed.objective, timingPlan.objectiveStart)

  return (
    <div className={`mx-auto mt-1 mb-8 w-full max-w-3xl space-y-3 ${className}`.trim()}>
      <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/20">
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-700 dark:border-t-indigo-300" />
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{statusText}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          {objectiveChunk.value ? (
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {objectiveChunk.value}
              {objectiveChunk.active ? (
                <span className="ml-0.5 inline-block h-[0.95em] w-px animate-pulse bg-current align-[-0.12em]" />
              ) : null}
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div
                className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"
                style={{ animationDelay: '120ms' }}
              />
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {Array.from({ length: PHASES }, (_, i) => {
            const phase = parsed.phases[i]
            const phaseTiming = timingPlan.phases[i]
            const titleChunk = getTypedChunk(phase?.title, phaseTiming?.titleStart ?? 0)
            return (
              <div key={i} className="px-4 py-3">
                {titleChunk.value ? (
                  <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {titleChunk.value}
                    {titleChunk.active ? (
                      <span className="ml-0.5 inline-block h-[0.9em] w-px animate-pulse bg-current align-[-0.1em]" />
                    ) : null}
                  </p>
                ) : (
                  <div
                    className="mb-2.5 h-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"
                    style={{ width: `${skeletonTitleWidths[i]}%`, animationDelay: `${i * 130}ms` }}
                  />
                )}

                {phase?.items.length ? (
                  <ul className="space-y-1">
                    {phase.items.map((item, j) => {
                      const itemChunk = getTypedChunk(item, phaseTiming?.itemStarts[j] ?? 0)

                      if (!itemChunk.value) {
                        return (
                          <li key={j} className="flex items-start gap-1.5">
                            <span className="mt-0.5 shrink-0 text-indigo-400">•</span>
                            <div
                              className="mt-1 h-2 w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-800"
                              style={{ width: `${[100, 85, 70][j % 3]}%` }}
                            />
                          </li>
                        )
                      }

                      return (
                        <li
                          key={j}
                          className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
                        >
                          <span className="mt-0.5 shrink-0 text-indigo-400">•</span>
                          <span>
                            {itemChunk.value}
                            {itemChunk.active ? (
                              <span className="ml-0.5 inline-block h-[0.9em] w-px animate-pulse bg-current align-[-0.1em]" />
                            ) : null}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="space-y-1.5">
                    {[100, 85, 70].map((w, j) => (
                      <div
                        key={j}
                        className="h-2 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800"
                        style={{ width: `${w}%`, animationDelay: `${(i * 3 + j) * 75}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
