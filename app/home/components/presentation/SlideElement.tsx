'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { PresentationElement } from '@/app/home/lib/types'

interface Props {
  element: PresentationElement
  selected: boolean
  canEdit: boolean
  scale: number
  onSelect: () => void
  onUpdate: (updated: PresentationElement) => void
  onDelete: () => void
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const CANVAS_W = 960
const CANVAS_H = 540
const MIN_SIZE = 20

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function SlideElement({
  element,
  selected,
  canEdit,
  scale,
  onSelect,
  onUpdate,
  onDelete,
}: Props) {
  const [isTextEditing, setIsTextEditing] = useState(false)
  const [editingBulletIndex, setEditingBulletIndex] = useState<number | null>(null)
  const [bulletDraft, setBulletDraft] = useState('')

  const dragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  const resizeRef = useRef<{
    pointerId: number
    dir: ResizeHandle
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)

  useEffect(() => {
    if (!selected) {
      setIsTextEditing(false)
      setEditingBulletIndex(null)
      setBulletDraft('')
    }
  }, [selected])

  const safeScale = scale > 0 ? scale : 1

  function commitBulletItem(index: number, value: string) {
    if (element.type !== 'bullet') return
    const nextItems = [...element.items]
    nextItems[index] = value
    onUpdate({ ...element, items: nextItems })
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      e.preventDefault()
      const dx = (e.clientX - dragRef.current.startClientX) / safeScale
      const dy = (e.clientY - dragRef.current.startClientY) / safeScale

      const nextX = clamp(
        dragRef.current.startX + dx,
        0,
        Math.max(0, CANVAS_W - dragRef.current.startW)
      )
      const nextY = clamp(
        dragRef.current.startY + dy,
        0,
        Math.max(0, CANVAS_H - dragRef.current.startH)
      )

      onUpdate({
        ...element,
        x: Math.round(nextX),
        y: Math.round(nextY),
      })
      return
    }

    if (resizeRef.current && resizeRef.current.pointerId === e.pointerId) {
      e.preventDefault()
      const dx = (e.clientX - resizeRef.current.startClientX) / safeScale
      const dy = (e.clientY - resizeRef.current.startClientY) / safeScale

      let x = resizeRef.current.startX
      let y = resizeRef.current.startY
      let w = resizeRef.current.startW
      let h = resizeRef.current.startH

      const right = resizeRef.current.startX + resizeRef.current.startW
      const bottom = resizeRef.current.startY + resizeRef.current.startH
      const dir = resizeRef.current.dir

      if (dir.includes('w')) {
        x = clamp(resizeRef.current.startX + dx, 0, right - MIN_SIZE)
        w = right - x
      }
      if (dir.includes('e')) {
        w = clamp(resizeRef.current.startW + dx, MIN_SIZE, CANVAS_W - x)
      }
      if (dir.includes('n')) {
        y = clamp(resizeRef.current.startY + dy, 0, bottom - MIN_SIZE)
        h = bottom - y
      }
      if (dir.includes('s')) {
        h = clamp(resizeRef.current.startH + dy, MIN_SIZE, CANVAS_H - y)
      }

      x = clamp(x, 0, CANVAS_W - w)
      y = clamp(y, 0, CANVAS_H - h)

      onUpdate({
        ...element,
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(Math.max(MIN_SIZE, w)),
        h: Math.round(Math.max(MIN_SIZE, h)),
      })
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      }
    }

    if (resizeRef.current?.pointerId === e.pointerId) {
      resizeRef.current = null
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      }
    }
  }

  function handleBodyPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    onSelect()

    if (!canEdit) return
    if (e.button !== 0) return

    const target = e.target as HTMLElement
    if (target.closest('[data-pe-handle]') || target.closest('[data-pe-no-drag]')) return

    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: element.x,
      startY: element.y,
      startW: element.w,
      startH: element.h,
    }

    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleResizePointerDown(dir: ResizeHandle, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    onSelect()

    if (!canEdit) return
    if (e.button !== 0) return

    resizeRef.current = {
      pointerId: e.pointerId,
      dir,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: element.x,
      startY: element.y,
      startW: element.w,
      startH: element.h,
    }

    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const sharedTextStyle =
    element.type === 'text'
      ? {
          color: element.style?.color ?? '#0f172a',
          fontSize: `${(element.style?.fontSize ?? 24) * safeScale}px`,
          fontWeight: element.style?.bold ? 700 : 400,
          textAlign: (element.style?.align ?? 'left') as 'left' | 'center' | 'right',
        }
      : undefined

  const sharedBulletStyle =
    element.type === 'bullet'
      ? {
          color: element.style?.color ?? '#0f172a',
          fontSize: `${(element.style?.fontSize ?? 20) * safeScale}px`,
          lineHeight: element.style?.lineHeight ?? 1.35,
        }
      : undefined

  return (
    <div
      className={`absolute rounded-sm ${selected ? 'ring-2 ring-indigo-500' : ''}`}
      style={{
        left: element.x * safeScale,
        top: element.y * safeScale,
        width: Math.max(MIN_SIZE, element.w) * safeScale,
        height: Math.max(MIN_SIZE, element.h) * safeScale,
        zIndex: element.z ?? 0,
        touchAction: 'none',
      }}
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {element.type === 'text' && (
        <>
          {selected && canEdit && isTextEditing ? (
            <textarea
              data-pe-no-drag
              autoFocus
              value={element.text}
              onChange={(e) => onUpdate({ ...element, text: e.target.value })}
              onBlur={() => setIsTextEditing(false)}
              className="h-full w-full resize-none border-0 bg-transparent p-1.5 outline-none"
              style={sharedTextStyle}
            />
          ) : (
            <div
              className="h-full w-full cursor-text whitespace-pre-wrap break-words p-1.5"
              onDoubleClick={() => {
                if (selected && canEdit) setIsTextEditing(true)
              }}
              style={sharedTextStyle}
            >
              {element.text || (canEdit ? 'Doble clic para editar texto' : '')}
            </div>
          )}
        </>
      )}

      {element.type === 'image' && (
        <img
          src={element.url}
          alt="Slide image"
          className="h-full w-full select-none"
          style={{ objectFit: element.crop ?? 'contain' }}
          draggable={false}
        />
      )}

      {element.type === 'bullet' && (
        <ul
          className="h-full w-full list-disc overflow-auto p-2 pl-6"
          style={sharedBulletStyle}
        >
          {element.items.map((item, index) => (
            <li key={`${element.id}-bullet-${index}`} className="mb-1">
              {selected && canEdit && editingBulletIndex === index ? (
                <input
                  data-pe-no-drag
                  autoFocus
                  value={bulletDraft}
                  onChange={(e) => setBulletDraft(e.target.value)}
                  onBlur={() => {
                    commitBulletItem(index, bulletDraft)
                    setEditingBulletIndex(null)
                    setBulletDraft('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitBulletItem(index, bulletDraft)
                      const nextItems = [...element.items]
                      nextItems.splice(index + 1, 0, '')
                      onUpdate({ ...element, items: nextItems })
                      setEditingBulletIndex(index + 1)
                      setBulletDraft('')
                    }

                    if (e.key === 'Backspace' && bulletDraft.length === 0) {
                      e.preventDefault()
                      if (element.items.length <= 1) return
                      const nextItems = element.items.filter((_, i) => i !== index)
                      onUpdate({ ...element, items: nextItems })
                      const nextIndex = Math.max(0, index - 1)
                      setEditingBulletIndex(nextIndex)
                      setBulletDraft(nextItems[nextIndex] ?? '')
                    }
                  }}
                  className="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-inherit outline-none dark:border-slate-700 dark:bg-slate-900"
                />
              ) : (
                <button
                  data-pe-no-drag
                  type="button"
                  className="w-full cursor-text text-left"
                  onClick={() => {
                    if (!selected || !canEdit) return
                    setEditingBulletIndex(index)
                    setBulletDraft(item)
                  }}
                >
                  {item || (canEdit ? 'Click para editar' : '')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {selected && canEdit && (
        <>
          <button
            data-pe-no-drag
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white"
            title="Eliminar elemento"
          >
            ×
          </button>

          {([
            { dir: 'nw', cls: '-left-1.5 -top-1.5 cursor-nwse-resize' },
            { dir: 'n', cls: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize' },
            { dir: 'ne', cls: '-right-1.5 -top-1.5 cursor-nesw-resize' },
            { dir: 'e', cls: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
            { dir: 'se', cls: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
            { dir: 's', cls: 'left-1/2 -bottom-1.5 -translate-x-1/2 cursor-ns-resize' },
            { dir: 'sw', cls: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
            { dir: 'w', cls: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
          ] as Array<{ dir: ResizeHandle; cls: string }>).map((h) => (
            <div
              key={`${element.id}-${h.dir}`}
              data-pe-handle
              className={`absolute h-3 w-3 rounded-full border border-indigo-700 bg-white ${h.cls}`}
              onPointerDown={(e) => handleResizePointerDown(h.dir, e)}
            />
          ))}
        </>
      )}
    </div>
  )
}
