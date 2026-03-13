import { logAiUsage } from '@/lib/db'

export type AiUsageLogInput = Parameters<typeof logAiUsage>[0]
export type PendingAiUsageLogInput = Omit<AiUsageLogInput, 'extractionId'>

export async function logAiUsageSafely(input: AiUsageLogInput): Promise<void> {
  try {
    await logAiUsage(input)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown ai usage logging error'
    console.error(`[ai-usage-log] Failed to persist AI usage for ${input.useType}: ${message}`)
  }
}

export function persistAiUsageLogsInBackground(
  logs: PendingAiUsageLogInput[],
  extractionId: string | null
): void {
  if (logs.length === 0) return

  void Promise.all(
    logs.map((usage) =>
      logAiUsageSafely({
        ...usage,
        extractionId,
      })
    )
  )
}
