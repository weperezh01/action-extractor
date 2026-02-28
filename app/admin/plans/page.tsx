'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Check, X, Plus, Pencil, Trash2, Save, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'

// ── Feature definitions ──────────────────────────────────────────────────────

export const FEATURE_KEYS = [
  { key: 'batch_extraction',    label: 'Extracción Batch (múltiples URLs)' },
  { key: 'export_integrations', label: 'Exportar (Notion, Trello, Todoist, Google Docs)' },
  { key: 'folders',             label: 'Carpetas y organización' },
  { key: 'knowledge_chat',      label: 'Chat de conocimiento IA' },
  { key: 'concept_map_mode',    label: 'Modo Mapa Conceptual' },
  { key: 'priority_support',    label: 'Soporte prioritario' },
  { key: 'api_access',          label: 'Acceso API pública' },
] as const

type FeatureKey = typeof FEATURE_KEYS[number]['key']

type Features = Record<FeatureKey, boolean>

function defaultFeatures(): Features {
  return Object.fromEntries(FEATURE_KEYS.map(({ key }) => [key, false])) as Features
}

function parseFeatures(json: string): Features {
  try {
    const parsed = JSON.parse(json) as Record<string, boolean>
    return Object.fromEntries(
      FEATURE_KEYS.map(({ key }) => [key, parsed[key] === true])
    ) as Features
  } catch {
    return defaultFeatures()
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DbPlan {
  id: string
  name: string
  display_name: string
  price_monthly_usd: number
  stripe_price_id: string | null
  extractions_per_hour: number
  features_json: string
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cls(...args: (string | false | undefined)[]) {
  return args.filter(Boolean).join(' ')
}

const SEED_IDS = ['plan_free', 'plan_pro', 'plan_business']

// ── Sub-components ───────────────────────────────────────────────────────────

function ToggleCell({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cls(
        'flex items-center justify-center w-7 h-7 rounded-lg transition-colors mx-auto',
        value
          ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400'
          : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-500'
      )}
      title={value ? 'Habilitado (click para deshabilitar)' : 'Deshabilitado (click para habilitar)'}
    >
      {value ? <Check size={13} /> : <X size={13} />}
    </button>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<DbPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Inline edit state for value ladder table
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<DbPlan> & { displayName?: string; priceMonthlyUsd?: number; extractionsPerHour?: number; stripePriceId?: string | null; isActive?: boolean; displayOrder?: number }>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // New plan form state
  const [showNewForm, setShowNewForm] = useState(false)
  const [newPlan, setNewPlan] = useState({
    name: '',
    displayName: '',
    priceMonthlyUsd: 0,
    stripePriceId: '',
    extractionsPerHour: 12,
    isActive: true,
    displayOrder: 99,
  })
  const [creatingPlan, setCreatingPlan] = useState(false)

  // Feature matrix — track pending changes per plan
  const [featureEdits, setFeatureEdits] = useState<Record<string, Features>>({})
  const [savingFeatures, setSavingFeatures] = useState<string | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/plans', { cache: 'no-store' })
      if (res.status === 401) { window.location.href = '/'; return }
      if (res.status === 403) { setError('Acceso denegado.'); return }
      if (!res.ok) { setError('No se pudo cargar la lista de planes.'); return }
      const data = (await res.json()) as { plans: DbPlan[] }
      setPlans(data.plans)
      // Init feature edits from DB
      const init: Record<string, Features> = {}
      for (const p of data.plans) { init[p.id] = parseFeatures(p.features_json) }
      setFeatureEdits(init)
    } catch {
      setError('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadPlans() }, [loadPlans])

  // ── Value ladder editing ───────────────────────────────────────────────────

  function startEdit(plan: DbPlan) {
    setEditingId(plan.id)
    setEditDraft({
      displayName: plan.display_name,
      priceMonthlyUsd: plan.price_monthly_usd,
      extractionsPerHour: plan.extractions_per_hour,
      stripePriceId: plan.stripe_price_id ?? '',
      isActive: plan.is_active,
      displayOrder: plan.display_order,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  async function saveEdit(planId: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editDraft.displayName,
          priceMonthlyUsd: editDraft.priceMonthlyUsd,
          extractionsPerHour: editDraft.extractionsPerHour,
          stripePriceId: editDraft.stripePriceId || null,
          isActive: editDraft.isActive,
          displayOrder: editDraft.displayOrder,
        }),
      })
      const data = (await res.json().catch(() => null)) as { plan?: DbPlan; error?: string } | null
      if (!res.ok) { setError(data?.error ?? 'Error al guardar.'); return }
      if (data?.plan) {
        setPlans((prev) => prev.map((p) => (p.id === planId ? data.plan! : p)))
        setNotice('Plan actualizado correctamente.')
        setTimeout(() => setNotice(null), 3000)
      }
      setEditingId(null)
    } catch {
      setError('Error de conexión.')
    } finally {
      setSaving(false)
    }
  }

  async function deletePlanById(planId: string) {
    if (!window.confirm('¿Eliminar este plan? Esta acción no se puede deshacer.')) return
    setDeletingId(planId)
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) { setError(data?.error ?? 'Error al eliminar.'); return }
      setPlans((prev) => prev.filter((p) => p.id !== planId))
      setNotice('Plan eliminado.')
      setTimeout(() => setNotice(null), 3000)
    } catch {
      setError('Error de conexión.')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Create plan ───────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!newPlan.name.trim() || !newPlan.displayName.trim()) {
      setError('El nombre interno y el nombre visible son requeridos.')
      return
    }
    setCreatingPlan(true)
    setError(null)

    // Build default features for new plan
    const defaultFeaturesObj = defaultFeatures()
    const featuresJson = JSON.stringify(defaultFeaturesObj)

    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPlan, featuresJson, stripePriceId: newPlan.stripePriceId || null }),
      })
      const data = (await res.json().catch(() => null)) as { plan?: DbPlan; error?: string } | null
      if (!res.ok) { setError(data?.error ?? 'Error al crear.'); return }
      if (data?.plan) {
        setPlans((prev) => [...prev, data.plan!].sort((a, b) => a.display_order - b.display_order))
        setFeatureEdits((prev) => ({ ...prev, [data.plan!.id]: parseFeatures(data.plan!.features_json) }))
        setNotice('Plan creado correctamente.')
        setTimeout(() => setNotice(null), 3000)
      }
      setShowNewForm(false)
      setNewPlan({ name: '', displayName: '', priceMonthlyUsd: 0, stripePriceId: '', extractionsPerHour: 12, isActive: true, displayOrder: 99 })
    } catch {
      setError('Error de conexión.')
    } finally {
      setCreatingPlan(false)
    }
  }

  // ── Feature matrix ─────────────────────────────────────────────────────────

  function toggleFeature(planId: string, key: FeatureKey) {
    setFeatureEdits((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], [key]: !prev[planId]?.[key] },
    }))
  }

  async function saveFeatures(plan: DbPlan) {
    setSavingFeatures(plan.id)
    setError(null)
    const features = featureEdits[plan.id] ?? parseFeatures(plan.features_json)
    const featuresJson = JSON.stringify(features)
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featuresJson }),
      })
      const data = (await res.json().catch(() => null)) as { plan?: DbPlan; error?: string } | null
      if (!res.ok) { setError(data?.error ?? 'Error al guardar.'); return }
      if (data?.plan) {
        setPlans((prev) => prev.map((p) => (p.id === plan.id ? data.plan! : p)))
        setNotice(`Limitaciones de "${plan.display_name}" guardadas.`)
        setTimeout(() => setNotice(null), 3000)
      }
    } catch {
      setError('Error de conexión.')
    } finally {
      setSavingFeatures(null)
    }
  }

  function resetFeatures(plan: DbPlan) {
    setFeatureEdits((prev) => ({ ...prev, [plan.id]: parseFeatures(plan.features_json) }))
  }

  function featureIsDirty(plan: DbPlan) {
    const current = featureEdits[plan.id]
    if (!current) return false
    const original = parseFeatures(plan.features_json)
    return FEATURE_KEYS.some(({ key }) => current[key] !== original[key])
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-6xl">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">Panel Admin</p>
            <h1 className="text-2xl font-bold">Gestión de Planes</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Modifica la escalera de valor y las limitaciones por plan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              ← Panel Admin
            </Link>
            <Link href="/" className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
              Volver al extractor
            </Link>
          </div>
        </div>

        {/* Notices */}
        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 flex items-center justify-between gap-2">
            {error}
            <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Tabla 1: Escalera de Valor ──────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold">Escalera de Valor</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Precio, extracciones por hora y Stripe Price ID de cada plan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewForm((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              <Plus size={14} />
              Nuevo plan
            </button>
          </div>

          {/* New plan form */}
          {showNewForm && (
            <div className="px-5 py-4 border-b border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-200">Nuevo plan</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nombre interno (slug)</label>
                  <input
                    type="text"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
                    placeholder="starter"
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nombre visible</label>
                  <input
                    type="text"
                    value={newPlan.displayName}
                    onChange={(e) => setNewPlan((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="Starter"
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Precio mensual (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={newPlan.priceMonthlyUsd}
                    onChange={(e) => setNewPlan((p) => ({ ...p, priceMonthlyUsd: Number(e.target.value) }))}
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Extracciones/hora</label>
                  <input
                    type="number"
                    min={1}
                    value={newPlan.extractionsPerHour}
                    onChange={(e) => setNewPlan((p) => ({ ...p, extractionsPerHour: Number(e.target.value) }))}
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Stripe Price ID</label>
                  <input
                    type="text"
                    value={newPlan.stripePriceId}
                    onChange={(e) => setNewPlan((p) => ({ ...p, stripePriceId: e.target.value }))}
                    placeholder="price_..."
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Orden</label>
                  <input
                    type="number"
                    min={0}
                    value={newPlan.displayOrder}
                    onChange={(e) => setNewPlan((p) => ({ ...p, displayOrder: Number(e.target.value) }))}
                    className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="flex items-end gap-1.5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer h-9">
                    <input
                      type="checkbox"
                      checked={newPlan.isActive}
                      onChange={(e) => setNewPlan((p) => ({ ...p, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-slate-700 dark:text-slate-200">Activo</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creatingPlan}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Save size={13} />
                  {creatingPlan ? 'Creando...' : 'Crear plan'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Plans table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="px-5 py-3 text-left font-semibold">Plan</th>
                  <th className="px-4 py-3 text-right font-semibold">Precio/mes</th>
                  <th className="px-4 py-3 text-right font-semibold">Extr./hora</th>
                  <th className="px-4 py-3 text-left font-semibold">Stripe Price ID</th>
                  <th className="px-4 py-3 text-center font-semibold">Orden</th>
                  <th className="px-4 py-3 text-center font-semibold">Activo</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {plans.map((plan) => {
                  const isEditing = editingId === plan.id
                  const isDeleting = deletingId === plan.id
                  const isSeed = SEED_IDS.includes(plan.id)

                  return (
                    <tr key={plan.id} className={cls('transition-colors', isEditing && 'bg-indigo-50/60 dark:bg-indigo-950/20')}>
                      {/* Name */}
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft.displayName ?? plan.display_name}
                            onChange={(e) => setEditDraft((d) => ({ ...d, displayName: e.target.value }))}
                            className="h-8 w-36 rounded border border-indigo-300 bg-white px-2 text-sm dark:border-indigo-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        ) : (
                          <div>
                            <span className="font-semibold">{plan.display_name}</span>
                            <span className="ml-2 text-xs text-slate-400 font-mono">{plan.name}</span>
                          </div>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={editDraft.priceMonthlyUsd ?? plan.price_monthly_usd}
                            onChange={(e) => setEditDraft((d) => ({ ...d, priceMonthlyUsd: Number(e.target.value) }))}
                            className="h-8 w-24 rounded border border-indigo-300 bg-white px-2 text-sm text-right dark:border-indigo-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        ) : (
                          <span className="font-semibold">
                            {plan.price_monthly_usd === 0 ? 'Gratis' : `$${plan.price_monthly_usd}`}
                          </span>
                        )}
                      </td>

                      {/* Extractions/hr */}
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            value={editDraft.extractionsPerHour ?? plan.extractions_per_hour}
                            onChange={(e) => setEditDraft((d) => ({ ...d, extractionsPerHour: Number(e.target.value) }))}
                            className="h-8 w-20 rounded border border-indigo-300 bg-white px-2 text-sm text-right dark:border-indigo-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        ) : (
                          <span className="tabular-nums">{plan.extractions_per_hour}</span>
                        )}
                      </td>

                      {/* Stripe Price ID */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft.stripePriceId ?? (plan.stripe_price_id ?? '')}
                            onChange={(e) => setEditDraft((d) => ({ ...d, stripePriceId: e.target.value }))}
                            placeholder="price_..."
                            className="h-8 w-52 rounded border border-indigo-300 bg-white px-2 text-sm font-mono dark:border-indigo-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        ) : plan.stripe_price_id ? (
                          <span className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate max-w-[200px] block" title={plan.stripe_price_id}>
                            {plan.stripe_price_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 italic text-xs">No configurado</span>
                        )}
                      </td>

                      {/* Order */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={editDraft.displayOrder ?? plan.display_order}
                            onChange={(e) => setEditDraft((d) => ({ ...d, displayOrder: Number(e.target.value) }))}
                            className="h-8 w-16 rounded border border-indigo-300 bg-white px-2 text-sm text-center dark:border-indigo-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                        ) : (
                          <span className="tabular-nums text-slate-500 dark:text-slate-400">{plan.display_order}</span>
                        )}
                      </td>

                      {/* Active */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={editDraft.isActive ?? plan.is_active}
                            onChange={(e) => setEditDraft((d) => ({ ...d, isActive: e.target.checked }))}
                            className="rounded w-4 h-4"
                          />
                        ) : plan.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check size={12} /> Sí
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <X size={12} /> No
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void saveEdit(plan.id)}
                              disabled={saving}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-60"
                            >
                              <Save size={11} />
                              {saving ? '...' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="h-7 px-2.5 rounded-md border border-slate-300 bg-white text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(plan)}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-slate-300 bg-white text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <Pencil size={11} />
                              Editar
                            </button>
                            {!isSeed && (
                              <button
                                type="button"
                                onClick={() => void deletePlanById(plan.id)}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-red-200 bg-white text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-900 dark:hover:bg-red-950/30"
                                title="Eliminar plan"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {plans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                      No hay planes configurados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Tabla 2: Limitaciones por Plan ─────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold">Limitaciones por Plan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Haz click en cada celda para habilitar o deshabilitar una feature. Guarda plan por plan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 min-w-[240px]">
                    Feature
                  </th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="px-4 py-3 text-center min-w-[120px]">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          {plan.display_name}
                        </span>
                        <div className="flex items-center gap-1">
                          {featureIsDirty(plan) && (
                            <button
                              type="button"
                              onClick={() => resetFeatures(plan)}
                              title="Revertir cambios"
                              className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void saveFeatures(plan)}
                            disabled={savingFeatures === plan.id || !featureIsDirty(plan)}
                            className={cls(
                              'h-6 px-2 rounded text-xs font-medium transition-colors',
                              featureIsDirty(plan)
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed'
                            )}
                          >
                            {savingFeatures === plan.id ? '...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                {FEATURE_KEYS.map(({ key, label }) => (
                  <tr key={key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                      {label}
                    </td>
                    {plans.map((plan) => {
                      const feats = featureEdits[plan.id] ?? parseFeatures(plan.features_json)
                      const originalFeats = parseFeatures(plan.features_json)
                      const currentVal = feats[key]
                      const originalVal = originalFeats[key]
                      const changed = currentVal !== originalVal

                      return (
                        <td key={plan.id} className={cls('px-4 py-3 text-center', changed && 'bg-amber-50/60 dark:bg-amber-900/10')}>
                          <ToggleCell
                            value={currentVal}
                            onChange={(v) => toggleFeature(plan.id, key as FeatureKey)}
                          />
                          {changed && (
                            <span className="block text-[10px] text-amber-500 mt-0.5">modificado</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            Las celdas en amarillo tienen cambios sin guardar. Cada plan tiene su propio botón "Guardar" en el encabezado de columna.
          </div>
        </section>

      </div>
    </main>
  )
}
