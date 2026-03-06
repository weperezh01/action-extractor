'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { PresentationSlide } from '@/app/home/lib/types'

interface Props {
  slides: PresentationSlide[]
  currentIndex: number
  onNavigate: (index: number) => void
  onExit: () => void
}

const VIRTUAL_W = 960
const VIRTUAL_H = 540

export function PresenterOverlay({ slides, currentIndex, onNavigate, onExit }: Props) {
  const [viewport, setViewport] = useState({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  })

  const safeIndex = useMemo(() => {
    if (slides.length === 0) return 0
    return Math.min(Math.max(currentIndex, 0), slides.length - 1)
  }, [currentIndex, slides.length])

  const currentSlide = slides[safeIndex]

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        if (safeIndex < slides.length - 1) onNavigate(safeIndex + 1)
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (safeIndex > 0) onNavigate(safeIndex - 1)
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onExit()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onExit, onNavigate, safeIndex, slides.length])

  if (!currentSlide) return null

  const usableWidth = Math.max(320, viewport.width - 64)
  const usableHeight = Math.max(220, viewport.height - 140)
  const scale = Math.min(usableWidth / VIRTUAL_W, usableHeight / VIRTUAL_H)
  const stageWidth = VIRTUAL_W * scale
  const stageHeight = VIRTUAL_H * scale

  const orderedElements = currentSlide.elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => (a.element.z ?? 0) - (b.element.z ?? 0) || a.index - b.index)
    .map((row) => row.element)

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className="relative overflow-hidden rounded-lg bg-white shadow-2xl"
          style={{
            width: stageWidth,
            height: stageHeight,
            background: currentSlide.background ?? '#ffffff',
          }}
        >
          {orderedElements.map((element) => {
            if (element.type === 'text') {
              return (
                <div
                  key={element.id}
                  className="absolute whitespace-pre-wrap break-words"
                  style={{
                    left: element.x * scale,
                    top: element.y * scale,
                    width: element.w * scale,
                    height: element.h * scale,
                    zIndex: element.z ?? 0,
                    color: element.style?.color ?? '#0f172a',
                    fontSize: `${(element.style?.fontSize ?? 24) * scale}px`,
                    fontWeight: element.style?.bold ? 700 : 400,
                    textAlign: (element.style?.align ?? 'left') as 'left' | 'center' | 'right',
                  }}
                >
                  {element.text}
                </div>
              )
            }

            if (element.type === 'image') {
              return (
                <img
                  key={element.id}
                  src={element.url}
                  alt="Slide"
                  className="absolute"
                  style={{
                    left: element.x * scale,
                    top: element.y * scale,
                    width: element.w * scale,
                    height: element.h * scale,
                    zIndex: element.z ?? 0,
                    objectFit: element.crop ?? 'contain',
                  }}
                  draggable={false}
                />
              )
            }

            return (
              <ul
                key={element.id}
                className="absolute list-disc overflow-hidden pl-6"
                style={{
                  left: element.x * scale,
                  top: element.y * scale,
                  width: element.w * scale,
                  height: element.h * scale,
                  zIndex: element.z ?? 0,
                  color: element.style?.color ?? '#0f172a',
                  fontSize: `${(element.style?.fontSize ?? 20) * scale}px`,
                  lineHeight: element.style?.lineHeight ?? 1.35,
                }}
              >
                {element.items.map((item, index) => (
                  <li key={`${element.id}-${index}`}>{item}</li>
                ))}
              </ul>
            )
          })}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 bg-black/70 px-4 py-3 text-white">
        <button
          type="button"
          onClick={() => safeIndex > 0 && onNavigate(safeIndex - 1)}
          disabled={safeIndex <= 0}
          className="rounded-md border border-white/30 px-3 py-1 text-sm disabled:opacity-40"
        >
          ←
        </button>

        <span className="text-sm font-medium">
          {safeIndex + 1} / {slides.length}
        </span>

        <button
          type="button"
          onClick={() => safeIndex < slides.length - 1 && onNavigate(safeIndex + 1)}
          disabled={safeIndex >= slides.length - 1}
          className="rounded-md border border-white/30 px-3 py-1 text-sm disabled:opacity-40"
        >
          →
        </button>

        <button
          type="button"
          onClick={onExit}
          className="ml-4 rounded-md border border-white/30 px-3 py-1 text-sm"
        >
          Salir (Esc)
        </button>
      </div>
    </div>
  )
}
