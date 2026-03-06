'use client'

import { HardDrive } from 'lucide-react'
import { formatStorageBytes, storageUsagePercent } from '@/lib/storage-limits'

interface StorageBarProps {
  usedBytes: number
  limitBytes: number
  /** Show compact one-liner instead of the full section layout */
  compact?: boolean
}

export function StorageBar({ usedBytes, limitBytes, compact = false }: StorageBarProps) {
  const percent = storageUsagePercent(usedBytes, limitBytes)
  const isWarning = percent >= 80
  const isCritical = percent >= 95

  const barColor = isCritical
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-indigo-500'

  const textColor = isCritical
    ? 'text-red-600 dark:text-red-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-slate-600 dark:text-slate-300'

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <HardDrive size={12} />
            Almacenamiento
          </span>
          <span className={`font-medium ${textColor}`}>
            {formatStorageBytes(usedBytes)} / {formatStorageBytes(limitBytes)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <p className={`text-sm ${textColor}`}>
          {formatStorageBytes(usedBytes)} / {formatStorageBytes(limitBytes)} usados
        </p>
        <p className={`text-sm font-semibold ${textColor}`}>
          {percent}%
        </p>
      </div>

      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {isCritical && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Almacenamiento casi lleno. Elimina archivos o actualiza tu plan.
        </p>
      )}
      {isWarning && !isCritical && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Estás usando el {percent}% de tu almacenamiento.
        </p>
      )}
    </div>
  )
}
