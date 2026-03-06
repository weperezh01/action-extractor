/**
 * Per-plan storage limits for file uploads (Cloudinary).
 * All values are in bytes.
 */

export const PLAN_STORAGE_BYTES: Record<string, number> = {
  free:     100  * 1024 * 1024,           // 100 MB
  starter:  500  * 1024 * 1024,           // 500 MB
  pro:      2    * 1024 * 1024 * 1024,    // 2 GB
  business: 10   * 1024 * 1024 * 1024,    // 10 GB
}

export function getPlanStorageLimitBytes(plan: string | null | undefined): number {
  return PLAN_STORAGE_BYTES[plan ?? 'free'] ?? PLAN_STORAGE_BYTES.free
}

export function formatStorageBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

/** Returns a human-readable percentage string (e.g. "42%"). */
export function storageUsagePercent(usedBytes: number, limitBytes: number): number {
  if (limitBytes <= 0) return 100
  return Math.min(100, Math.round((usedBytes / limitBytes) * 100))
}
