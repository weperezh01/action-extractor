'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { PresentationElement, PresentationSlide } from '@/app/home/lib/types'
import { SlideElement } from './SlideElement'

interface Props {
  slide: PresentationSlide
  selectedElementId: string | null
  canEdit: boolean
  containerRef: React.RefObject<HTMLDivElement>
  onSelectElement: (id: string) => void
  onDeselectAll: () => void
  onUpdateElement: (el: PresentationElement) => void
  onDeleteElement: (id: string) => void
}

const VIRTUAL_W = 960

export function SlideCanvas({
  slide,
  selectedElementId,
  canEdit,
  containerRef,
  onSelectElement,
  onDeselectAll,
  onUpdateElement,
  onDeleteElement,
}: Props) {
  const [containerWidth, setContainerWidth] = useState<number>(VIRTUAL_W)

  useEffect(() => {
    const target = containerRef.current
    if (!target) return

    const updateWidth = () => setContainerWidth(target.clientWidth || VIRTUAL_W)
    updateWidth()

    const ro = new ResizeObserver(() => updateWidth())
    ro.observe(target)

    return () => {
      ro.disconnect()
    }
  }, [containerRef])

  const scale = containerWidth > 0 ? containerWidth / VIRTUAL_W : 1

  const orderedElements = useMemo(
    () =>
      slide.elements
        .map((element, index) => ({ element, index }))
        .sort((a, b) => (a.element.z ?? 0) - (b.element.z ?? 0) || a.index - b.index)
        .map((row) => row.element),
    [slide.elements]
  )

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner dark:border-slate-700 dark:bg-slate-900"
      style={{ aspectRatio: '960 / 540' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onDeselectAll()
      }}
    >
      <div
        className="relative h-full w-full"
        style={{ background: slide.background ?? '#ffffff' }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onDeselectAll()
        }}
      >
        {orderedElements.map((element) => (
          <SlideElement
            key={element.id}
            element={element}
            selected={selectedElementId === element.id}
            canEdit={canEdit}
            scale={scale}
            onSelect={() => onSelectElement(element.id)}
            onUpdate={onUpdateElement}
            onDelete={() => onDeleteElement(element.id)}
          />
        ))}
      </div>
    </div>
  )
}
