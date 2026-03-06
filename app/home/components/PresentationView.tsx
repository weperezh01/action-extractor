'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  ImageIcon,
  List,
  Loader2,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import type {
  BulletElementStyle,
  InteractiveTask,
  PresentationDeck,
  PresentationElement,
  PresentationSlide,
  TextElementStyle,
} from '@/app/home/lib/types'
import { SlideCanvas } from './presentation/SlideCanvas'
import { PresenterOverlay } from './presentation/PresenterOverlay'

interface Props {
  interactiveTasks: InteractiveTask[]
  extractionId: string
  canEdit: boolean
}

const VIRTUAL_W = 960
const VIRTUAL_H = 540
const MIN_SIZE = 20

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function createEmptySlide(title?: string): PresentationSlide {
  return {
    id: makeId(),
    title,
    background: '#ffffff',
    elements: [],
  }
}

function createDefaultDeck(): PresentationDeck {
  return {
    version: 1,
    theme: { background: '#ffffff', accent: '#4f46e5' },
    slides: [createEmptySlide('Slide 1')],
  }
}

function sanitizeTextStyle(value: unknown): TextElementStyle | undefined {
  if (!isRecord(value)) return undefined

  const next: TextElementStyle = {}
  if (typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)) {
    next.fontSize = clamp(Math.round(value.fontSize), 8, 220)
  }
  if (typeof value.bold === 'boolean') next.bold = value.bold
  if (typeof value.color === 'string' && value.color.trim()) next.color = value.color
  if (value.align === 'left' || value.align === 'center' || value.align === 'right') {
    next.align = value.align
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function sanitizeBulletStyle(value: unknown): BulletElementStyle | undefined {
  if (!isRecord(value)) return undefined

  const next: BulletElementStyle = {}
  if (typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)) {
    next.fontSize = clamp(Math.round(value.fontSize), 8, 220)
  }
  if (typeof value.color === 'string' && value.color.trim()) next.color = value.color
  if (typeof value.lineHeight === 'number' && Number.isFinite(value.lineHeight)) {
    next.lineHeight = clamp(value.lineHeight, 0.8, 3)
  }

  return Object.keys(next).length > 0 ? next : undefined
}

function sanitizeElement(value: unknown): PresentationElement | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null

  const x = clamp(Math.round(toNumber(value.x, 80)), 0, VIRTUAL_W - MIN_SIZE)
  const y = clamp(Math.round(toNumber(value.y, 80)), 0, VIRTUAL_H - MIN_SIZE)
  const w = clamp(Math.round(toNumber(value.w, 260)), MIN_SIZE, VIRTUAL_W - x)
  const h = clamp(Math.round(toNumber(value.h, 120)), MIN_SIZE, VIRTUAL_H - y)
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : makeId()
  const z = typeof value.z === 'number' && Number.isFinite(value.z) ? Math.round(value.z) : undefined

  if (value.type === 'text') {
    return {
      id,
      type: 'text',
      x,
      y,
      w,
      h,
      z,
      text: typeof value.text === 'string' ? value.text : '',
      style: sanitizeTextStyle(value.style),
    }
  }

  if (value.type === 'image') {
    if (typeof value.url !== 'string' || !value.url.trim()) return null
    return {
      id,
      type: 'image',
      x,
      y,
      w,
      h,
      z,
      url: value.url,
      publicId: typeof value.publicId === 'string' ? value.publicId : null,
      crop: value.crop === 'cover' ? 'cover' : 'contain',
    }
  }

  if (value.type === 'bullet') {
    const rawItems = Array.isArray(value.items) ? value.items : []
    const items = rawItems
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item)

    return {
      id,
      type: 'bullet',
      x,
      y,
      w,
      h,
      z,
      items: items.length > 0 ? items : [''],
      style: sanitizeBulletStyle(value.style),
    }
  }

  return null
}

function sanitizeSlide(value: unknown, index: number): PresentationSlide | null {
  if (!isRecord(value)) return null

  const slideId =
    typeof value.id === 'string' && value.id.trim() ? value.id : makeId()

  const rawElements = Array.isArray(value.elements) ? value.elements : []
  const elements = rawElements
    .map((element) => sanitizeElement(element))
    .filter((element): element is PresentationElement => element !== null)

  return {
    id: slideId,
    title: typeof value.title === 'string' ? value.title : `Slide ${index + 1}`,
    background: typeof value.background === 'string' && value.background.trim()
      ? value.background
      : '#ffffff',
    elements,
  }
}

function sanitizeDeck(value: unknown): PresentationDeck | null {
  if (!isRecord(value)) return null

  const rawSlides = Array.isArray(value.slides) ? value.slides : []
  const slides = rawSlides
    .map((slide, index) => sanitizeSlide(slide, index))
    .filter((slide): slide is PresentationSlide => slide !== null)

  const theme = isRecord(value.theme)
    ? {
        background: typeof value.theme.background === 'string' ? value.theme.background : undefined,
        accent: typeof value.theme.accent === 'string' ? value.theme.accent : undefined,
      }
    : undefined

  return {
    version: typeof value.version === 'number' && Number.isFinite(value.version) ? value.version : 1,
    theme,
    slides: slides.length > 0 ? slides : [createEmptySlide('Slide 1')],
  }
}

function cloneElement(element: PresentationElement): PresentationElement {
  if (element.type === 'text') {
    return {
      ...element,
      id: makeId(),
      style: element.style ? { ...element.style } : undefined,
    }
  }

  if (element.type === 'image') {
    return {
      ...element,
      id: makeId(),
    }
  }

  return {
    ...element,
    id: makeId(),
    items: [...element.items],
    style: element.style ? { ...element.style } : undefined,
  }
}

function resolveSlideIndex(deck: PresentationDeck, lastSlideId: string | null) {
  if (!lastSlideId) return 0
  const foundIndex = deck.slides.findIndex((slide) => slide.id === lastSlideId)
  return foundIndex >= 0 ? foundIndex : 0
}

export function PresentationView({ interactiveTasks, extractionId, canEdit }: Props) {
  const isGuest = extractionId.startsWith('g-')
  const deckStorageKey = `presentation:deck:${extractionId}`
  const lastSlideStorageKey = `presentation:lastSlide:${extractionId}`

  const [deck, setDeck] = useState<PresentationDeck | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPresenting, setIsPresenting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setLoadError(null)

      try {
        if (isGuest) {
          const storedDeckRaw = localStorage.getItem(deckStorageKey)
          const storedLastSlideId = localStorage.getItem(lastSlideStorageKey)

          let nextDeck: PresentationDeck | null = null

          if (storedDeckRaw) {
            try {
              nextDeck = sanitizeDeck(JSON.parse(storedDeckRaw))
            } catch {
              nextDeck = null
            }
          }

          if (!nextDeck) {
            nextDeck = createDefaultDeck()
            localStorage.setItem(deckStorageKey, JSON.stringify(nextDeck))
          }

          const nextIndex = resolveSlideIndex(nextDeck, storedLastSlideId)

          if (cancelled) return
          setDeck(nextDeck)
          setCurrentSlideIndex(nextIndex)
          setSelectedElementId(null)
          setIsDirty(false)
          return
        }

        const [deckRes, stateRes] = await Promise.all([
          fetch(`/api/extractions/${extractionId}/presentation`, { cache: 'no-store' }),
          fetch(`/api/extractions/${extractionId}/presentation/state`, { cache: 'no-store' }),
        ])

        if (!deckRes.ok) {
          throw new Error(`presentation deck request failed with status ${deckRes.status}`)
        }

        const deckPayload = await deckRes.json().catch(() => ({}))
        let nextDeck = sanitizeDeck((deckPayload as { deck?: unknown }).deck)

        if (!nextDeck && canEdit) {
          const createRes = await fetch(`/api/extractions/${extractionId}/presentation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_default' }),
          })

          if (createRes.ok) {
            const createPayload = await createRes.json().catch(() => ({}))
            nextDeck = sanitizeDeck((createPayload as { deck?: unknown }).deck)
          }
        }

        if (!nextDeck) nextDeck = createDefaultDeck()

        let lastSlideId: string | null = null
        if (stateRes.ok) {
          const statePayload = await stateRes.json().catch(() => ({}))
          const rawLastSlideId = (statePayload as { lastSlideId?: unknown }).lastSlideId
          if (typeof rawLastSlideId === 'string') lastSlideId = rawLastSlideId
        }

        const nextIndex = resolveSlideIndex(nextDeck, lastSlideId)

        if (cancelled) return
        setDeck(nextDeck)
        setCurrentSlideIndex(nextIndex)
        setSelectedElementId(null)
        setIsDirty(false)
      } catch (error: unknown) {
        console.error('[ActionExtractor] presentation load error:', error)
        if (cancelled) return

        setDeck(createDefaultDeck())
        setCurrentSlideIndex(0)
        setSelectedElementId(null)
        setIsDirty(false)
        setLoadError('No se pudo cargar la presentación.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [canEdit, deckStorageKey, extractionId, isGuest, lastSlideStorageKey])

  useEffect(() => {
    if (!deck || !isDirty || !canEdit) return

    const timeoutId = window.setTimeout(async () => {
      setIsSaving(true)
      try {
        if (isGuest) {
          localStorage.setItem(deckStorageKey, JSON.stringify(deck))
        } else {
          const res = await fetch(`/api/extractions/${extractionId}/presentation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_deck', deck }),
          })

          if (!res.ok) throw new Error(`save_deck failed with status ${res.status}`)
        }

        setIsDirty(false)
      } catch (error: unknown) {
        console.error('[ActionExtractor] presentation autosave error:', error)
      } finally {
        setIsSaving(false)
      }
    }, 800)

    return () => clearTimeout(timeoutId)
  }, [canEdit, deck, deckStorageKey, extractionId, isDirty, isGuest])

  useEffect(() => {
    if (!deck) return

    const slide = deck.slides[currentSlideIndex]
    if (!slide) return

    const timeoutId = window.setTimeout(() => {
      if (isGuest) {
        localStorage.setItem(lastSlideStorageKey, slide.id)
        return
      }

      void fetch(`/api/extractions/${extractionId}/presentation/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSlideId: slide.id }),
      }).catch((error: unknown) => {
        console.error('[ActionExtractor] presentation state save error:', error)
      })
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [currentSlideIndex, deck, extractionId, isGuest, lastSlideStorageKey])

  useEffect(() => {
    if (!deck) return
    if (deck.slides.length === 0) return

    setCurrentSlideIndex((prev) => clamp(prev, 0, deck.slides.length - 1))
  }, [deck?.slides.length])

  const currentSlide = useMemo(() => {
    if (!deck) return null
    return deck.slides[currentSlideIndex] ?? null
  }, [deck, currentSlideIndex])

  const selectedElement = useMemo(() => {
    if (!currentSlide || !selectedElementId) return null
    return currentSlide.elements.find((element) => element.id === selectedElementId) ?? null
  }, [currentSlide, selectedElementId])

  const updateDeck = useCallback((updater: (prev: PresentationDeck) => PresentationDeck) => {
    setDeck((prev) => (prev ? updater(prev) : prev))
    setIsDirty(true)
  }, [])

  const updateCurrentSlide = useCallback(
    (updater: (slide: PresentationSlide) => PresentationSlide) => {
      if (!canEdit) return
      updateDeck((prev) => {
        const slide = prev.slides[currentSlideIndex]
        if (!slide) return prev

        const nextSlides = [...prev.slides]
        nextSlides[currentSlideIndex] = updater(slide)
        return { ...prev, slides: nextSlides }
      })
    },
    [canEdit, currentSlideIndex, updateDeck]
  )

  const addElement = useCallback(
    (element: PresentationElement) => {
      if (!canEdit) return
      updateCurrentSlide((slide) => ({ ...slide, elements: [...slide.elements, element] }))
      setSelectedElementId(element.id)
    },
    [canEdit, updateCurrentSlide]
  )

  const handleAddText = useCallback(() => {
    addElement({
      id: makeId(),
      type: 'text',
      x: 80,
      y: 80,
      w: 320,
      h: 110,
      text: 'Nuevo texto',
      style: { fontSize: 28, bold: false, color: '#0f172a', align: 'left' },
    })
  }, [addElement])

  const handleAddBullet = useCallback(() => {
    addElement({
      id: makeId(),
      type: 'bullet',
      x: 90,
      y: 150,
      w: 540,
      h: 260,
      items: ['Punto 1', 'Punto 2'],
      style: { fontSize: 22, color: '#0f172a', lineHeight: 1.35 },
    })
  }, [addElement])

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!canEdit) return

      setIsUploadingImage(true)
      try {
        const fd = new FormData()
        fd.append('file', file)

        const response = await fetch('/api/community/uploads/image', {
          method: 'POST',
          body: fd,
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'No se pudo subir la imagen.'
          throw new Error(message)
        }

        const attachment =
          payload && typeof payload === 'object'
            ? (payload as { attachment?: { url?: unknown; metadata?: unknown } }).attachment
            : undefined

        if (!attachment || typeof attachment.url !== 'string' || !attachment.url.trim()) {
          throw new Error('La respuesta no incluyó una URL de imagen válida.')
        }

        const publicId =
          attachment.metadata &&
          typeof attachment.metadata === 'object' &&
          !Array.isArray(attachment.metadata) &&
          typeof (attachment.metadata as { publicId?: unknown }).publicId === 'string'
            ? (attachment.metadata as { publicId: string }).publicId
            : null

        addElement({
          id: makeId(),
          type: 'image',
          x: 80,
          y: 80,
          w: 420,
          h: 300,
          url: attachment.url,
          publicId,
          crop: 'contain',
        })
      } catch (error: unknown) {
        console.error('[ActionExtractor] presentation image upload error:', error)
      } finally {
        setIsUploadingImage(false)
      }
    },
    [addElement, canEdit]
  )

  const handleSelectImageFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      void handleImageUpload(file)
      event.target.value = ''
    },
    [handleImageUpload]
  )

  const handleUpdateElement = useCallback(
    (updated: PresentationElement) => {
      if (!canEdit) return
      updateCurrentSlide((slide) => ({
        ...slide,
        elements: slide.elements.map((element) =>
          element.id === updated.id ? updated : element
        ),
      }))
    },
    [canEdit, updateCurrentSlide]
  )

  const handleDeleteElement = useCallback(
    (id: string) => {
      if (!canEdit) return
      updateCurrentSlide((slide) => ({
        ...slide,
        elements: slide.elements.filter((element) => element.id !== id),
      }))
      if (selectedElementId === id) setSelectedElementId(null)
    },
    [canEdit, selectedElementId, updateCurrentSlide]
  )

  const handleAddSlide = useCallback(() => {
    if (!canEdit || !deck) return

    const newSlide = createEmptySlide(`Slide ${deck.slides.length + 1}`)
    updateDeck((prev) => ({ ...prev, slides: [...prev.slides, newSlide] }))
    setCurrentSlideIndex(deck.slides.length)
    setSelectedElementId(null)
  }, [canEdit, deck, updateDeck])

  const handleDuplicateSlide = useCallback(() => {
    if (!canEdit || !deck) return

    let nextIndex = currentSlideIndex
    updateDeck((prev) => {
      const source = prev.slides[currentSlideIndex]
      if (!source) return prev

      const cloned: PresentationSlide = {
        ...source,
        id: makeId(),
        title: source.title ? `${source.title} (copia)` : `Slide ${currentSlideIndex + 2}`,
        elements: source.elements.map((element) => cloneElement(element)),
      }

      const insertAt = currentSlideIndex + 1
      const nextSlides = [...prev.slides]
      nextSlides.splice(insertAt, 0, cloned)
      nextIndex = insertAt

      return { ...prev, slides: nextSlides }
    })

    setCurrentSlideIndex(nextIndex)
    setSelectedElementId(null)
  }, [canEdit, currentSlideIndex, deck, updateDeck])

  const handleDeleteCurrentSlide = useCallback(() => {
    if (!canEdit || !deck) return

    let nextIndex = currentSlideIndex
    updateDeck((prev) => {
      if (prev.slides.length <= 1) {
        nextIndex = 0
        return { ...prev, slides: [createEmptySlide('Slide 1')] }
      }

      const nextSlides = prev.slides.filter((_, index) => index !== currentSlideIndex)
      nextIndex = Math.min(currentSlideIndex, nextSlides.length - 1)
      return { ...prev, slides: nextSlides }
    })

    setCurrentSlideIndex(nextIndex)
    setSelectedElementId(null)
  }, [canEdit, currentSlideIndex, deck, updateDeck])

  const handleMoveSlide = useCallback(
    (index: number, delta: -1 | 1) => {
      if (!canEdit || !deck) return

      const target = index + delta
      if (target < 0 || target >= deck.slides.length) return

      updateDeck((prev) => {
        const nextSlides = [...prev.slides]
        const [moved] = nextSlides.splice(index, 1)
        nextSlides.splice(target, 0, moved)
        return { ...prev, slides: nextSlides }
      })

      setCurrentSlideIndex(target)
      setSelectedElementId(null)
    },
    [canEdit, deck, updateDeck]
  )

  const updateSelectedElement = useCallback(
    (updater: (element: PresentationElement) => PresentationElement) => {
      if (!canEdit || !selectedElementId) return

      updateCurrentSlide((slide) => ({
        ...slide,
        elements: slide.elements.map((element) =>
          element.id === selectedElementId ? updater(element) : element
        ),
      }))
    },
    [canEdit, selectedElementId, updateCurrentSlide]
  )

  const handleExplodeBullets = useCallback(() => {
    if (!canEdit || !selectedElement || selectedElement.type !== 'bullet') return

    const source = selectedElement
    const newElements: PresentationElement[] = source.items.map((item, index) => ({
      id: makeId(),
      type: 'text',
      x: source.x,
      y: clamp(source.y + index * 40, 0, VIRTUAL_H - 36),
      w: source.w,
      h: 36,
      text: `• ${item}`,
      style: {
        fontSize: source.style?.fontSize ?? 18,
        color: source.style?.color,
      },
    }))

    updateCurrentSlide((slide) => ({
      ...slide,
      elements: [
        ...slide.elements.filter((element) => element.id !== source.id),
        ...newElements,
      ],
    }))

    setSelectedElementId(null)
  }, [canEdit, selectedElement, updateCurrentSlide])

  const handleGenerateFromTasks = useCallback(() => {
    if (!canEdit) return

    const phases = new Map<string, InteractiveTask[]>()
    interactiveTasks.forEach((task) => {
      const phaseName = task.phaseTitle?.trim() || `Fase ${task.phaseId}`
      const list = phases.get(phaseName) ?? []
      list.push(task)
      phases.set(phaseName, list)
    })

    const entries = Array.from(phases.entries())
    if (entries.length === 0) {
      setDeck(createDefaultDeck())
      setCurrentSlideIndex(0)
      setSelectedElementId(null)
      setIsDirty(true)
      return
    }

    const slides: PresentationSlide[] = entries.map(([phaseTitle, tasks]) => ({
      id: makeId(),
      title: phaseTitle,
      background: '#ffffff',
      elements: [
        {
          id: makeId(),
          type: 'text',
          x: 40,
          y: 40,
          w: 880,
          h: 80,
          text: phaseTitle,
          style: { fontSize: 36, bold: true, align: 'center' },
        },
        {
          id: makeId(),
          type: 'bullet',
          x: 80,
          y: 160,
          w: 800,
          h: 340,
          items: tasks.map((task) => task.itemText),
          style: { fontSize: 20 },
        },
      ],
    }))

    setDeck((prev) => ({
      ...(prev ?? createDefaultDeck()),
      slides,
    }))
    setIsDirty(true)
    setCurrentSlideIndex(0)
    setSelectedElementId(null)
  }, [canEdit, interactiveTasks])

  const handleGeometryChange = useCallback(
    (field: 'x' | 'y' | 'w' | 'h', rawValue: number) => {
      if (!Number.isFinite(rawValue)) return

      updateSelectedElement((element) => {
        let x = element.x
        let y = element.y
        let w = element.w
        let h = element.h

        if (field === 'x') x = clamp(Math.round(rawValue), 0, VIRTUAL_W - w)
        if (field === 'y') y = clamp(Math.round(rawValue), 0, VIRTUAL_H - h)
        if (field === 'w') w = clamp(Math.round(rawValue), MIN_SIZE, VIRTUAL_W - x)
        if (field === 'h') h = clamp(Math.round(rawValue), MIN_SIZE, VIRTUAL_H - y)

        return { ...element, x, y, w, h }
      })
    },
    [updateSelectedElement]
  )

  const bringToFront = useCallback(() => {
    if (!selectedElement || !currentSlide) return

    const maxZ = currentSlide.elements.reduce((max, element) => Math.max(max, element.z ?? 0), 0)
    updateSelectedElement((element) => ({ ...element, z: maxZ + 1 }))
  }, [currentSlide, selectedElement, updateSelectedElement])

  const sendToBack = useCallback(() => {
    if (!selectedElement || !currentSlide) return

    const minZ = currentSlide.elements.reduce((min, element) => Math.min(min, element.z ?? 0), 0)
    updateSelectedElement((element) => ({ ...element, z: minZ - 1 }))
  }, [currentSlide, selectedElement, updateSelectedElement])

  if (isLoading || !deck || !currentSlide) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
          <Loader2 size={16} className="animate-spin" />
          Cargando modo presentación...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={handleAddText}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus size={12} />
              Texto
            </button>

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingImage}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {isUploadingImage ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
              Imagen
            </button>

            <button
              type="button"
              onClick={handleAddBullet}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <List size={12} />
              Viñetas
            </button>

            <button
              type="button"
              onClick={handleGenerateFromTasks}
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
            >
              <AlignLeft size={12} />
              Generar desde tareas
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setIsPresenting(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Play size={12} />
          Presentar
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {loadError && <span className="text-rose-500">{loadError}</span>}
          {isSaving && (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Guardando...
            </span>
          )}
          {!canEdit && <span>Solo lectura</span>}
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleSelectImageFile}
          className="hidden"
        />
      </div>

      <div className="flex min-h-[640px] flex-col gap-3 lg:flex-row">
        <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900 lg:w-40">
          <div className="space-y-2 overflow-y-auto lg:max-h-[560px]">
            {deck.slides.map((slide, index) => {
              const isActive = index === currentSlideIndex
              return (
                <div key={slide.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSlideIndex(index)
                      setSelectedElementId(null)
                    }}
                    className={`w-full rounded-lg border p-1 transition-colors ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className="relative aspect-[16/9] w-full overflow-hidden rounded border border-slate-200 dark:border-slate-700"
                      style={{ background: slide.background ?? '#ffffff' }}
                    >
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="absolute inset-x-1 bottom-1 truncate text-[10px] font-medium text-slate-700 dark:text-slate-200">
                        {slide.title || `Slide ${index + 1}`}
                      </span>
                    </div>
                  </button>

                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(index, -1)}
                        disabled={index === 0}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-slate-700"
                        title="Subir"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSlide(index, 1)}
                        disabled={index === deck.slides.length - 1}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-slate-700"
                        title="Bajar"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {canEdit && (
            <div className="mt-3 grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={handleAddSlide}
                className="inline-flex h-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Agregar slide"
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={handleDuplicateSlide}
                className="inline-flex h-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Duplicar slide"
              >
                <Copy size={13} />
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrentSlide}
                className="inline-flex h-8 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/25"
                title="Eliminar slide"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950/70">
          <SlideCanvas
            slide={currentSlide}
            selectedElementId={selectedElementId}
            canEdit={canEdit}
            containerRef={canvasContainerRef}
            onSelectElement={setSelectedElementId}
            onDeselectAll={() => setSelectedElementId(null)}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
          />
        </div>

        <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 lg:w-52">
          {!selectedElement ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona un elemento para editar propiedades.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Posición y tamaño</p>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    X
                    <input
                      type="number"
                      value={selectedElement.x}
                      onChange={(e) => handleGeometryChange('x', Number(e.target.value))}
                      disabled={!canEdit}
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    Y
                    <input
                      type="number"
                      value={selectedElement.y}
                      onChange={(e) => handleGeometryChange('y', Number(e.target.value))}
                      disabled={!canEdit}
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    W
                    <input
                      type="number"
                      value={selectedElement.w}
                      onChange={(e) => handleGeometryChange('w', Number(e.target.value))}
                      disabled={!canEdit}
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">
                    H
                    <input
                      type="number"
                      value={selectedElement.h}
                      onChange={(e) => handleGeometryChange('h', Number(e.target.value))}
                      disabled={!canEdit}
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                </div>
              </div>

              {selectedElement.type === 'text' && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Texto</p>

                  <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Tamaño
                    <input
                      type="number"
                      min={8}
                      max={220}
                      value={selectedElement.style?.fontSize ?? 24}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateSelectedElement((element) =>
                          element.type === 'text'
                            ? {
                                ...element,
                                style: {
                                  ...(element.style ?? {}),
                                  fontSize: clamp(Math.round(Number(e.target.value)), 8, 220),
                                },
                              }
                            : element
                        )
                      }
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Color
                    <input
                      type="color"
                      value={selectedElement.style?.color ?? '#0f172a'}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateSelectedElement((element) =>
                          element.type === 'text'
                            ? {
                                ...element,
                                style: {
                                  ...(element.style ?? {}),
                                  color: e.target.value,
                                },
                              }
                            : element
                        )
                      }
                      className="mt-0.5 h-8 w-full rounded border border-slate-300 px-1 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      updateSelectedElement((element) =>
                        element.type === 'text'
                          ? {
                              ...element,
                              style: {
                                ...(element.style ?? {}),
                                bold: !(element.style?.bold ?? false),
                              },
                            }
                          : element
                      )
                    }
                    className={`w-full rounded border px-2 py-1 text-xs font-semibold ${
                      selectedElement.style?.bold
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Negrita
                  </button>

                  <div className="grid grid-cols-3 gap-1">
                    {(['left', 'center', 'right'] as Array<'left' | 'center' | 'right'>).map((align) => (
                      <button
                        key={align}
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          updateSelectedElement((element) =>
                            element.type === 'text'
                              ? {
                                  ...element,
                                  style: {
                                    ...(element.style ?? {}),
                                    align,
                                  },
                                }
                              : element
                          )
                        }
                        className={`rounded border px-1.5 py-1 text-xs ${
                          (selectedElement.style?.align ?? 'left') === align
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedElement.type === 'bullet' && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Viñetas</p>

                  <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Tamaño
                    <input
                      type="number"
                      min={8}
                      max={220}
                      value={selectedElement.style?.fontSize ?? 20}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateSelectedElement((element) =>
                          element.type === 'bullet'
                            ? {
                                ...element,
                                style: {
                                  ...(element.style ?? {}),
                                  fontSize: clamp(Math.round(Number(e.target.value)), 8, 220),
                                },
                              }
                            : element
                        )
                      }
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Color
                    <input
                      type="color"
                      value={selectedElement.style?.color ?? '#0f172a'}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateSelectedElement((element) =>
                          element.type === 'bullet'
                            ? {
                                ...element,
                                style: {
                                  ...(element.style ?? {}),
                                  color: e.target.value,
                                },
                              }
                            : element
                        )
                      }
                      className="mt-0.5 h-8 w-full rounded border border-slate-300 px-1 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Interlineado
                    <input
                      type="number"
                      min={0.8}
                      max={3}
                      step={0.05}
                      value={selectedElement.style?.lineHeight ?? 1.35}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateSelectedElement((element) =>
                          element.type === 'bullet'
                            ? {
                                ...element,
                                style: {
                                  ...(element.style ?? {}),
                                  lineHeight: clamp(Number(e.target.value), 0.8, 3),
                                },
                              }
                            : element
                        )
                      }
                      className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={handleExplodeBullets}
                      className="w-full rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                    >
                      Explode bullets
                    </button>
                  )}
                </div>
              )}

              {selectedElement.type === 'image' && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Imagen</p>

                  <div className="grid grid-cols-2 gap-1">
                    {(['contain', 'cover'] as Array<'contain' | 'cover'>).map((cropMode) => (
                      <button
                        key={cropMode}
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          updateSelectedElement((element) =>
                            element.type === 'image' ? { ...element, crop: cropMode } : element
                          )
                        }
                        className={`rounded border px-2 py-1 text-xs ${
                          (selectedElement.crop ?? 'contain') === cropMode
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cropMode}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canEdit && (
                <>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={bringToFront}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      Bring to front
                    </button>
                    <button
                      type="button"
                      onClick={sendToBack}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      Send to back
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteElement(selectedElement.id)}
                    className="w-full rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300"
                  >
                    Delete element
                  </button>
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      {isPresenting && (
        <PresenterOverlay
          slides={deck.slides}
          currentIndex={currentSlideIndex}
          onNavigate={(index) => setCurrentSlideIndex(index)}
          onExit={() => setIsPresenting(false)}
        />
      )}
    </div>
  )
}
