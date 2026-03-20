import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import {
  DEFAULT_BUSINESS_ASSUMPTIONS,
  calculateGrossMarginPct,
  calculateMaxVariableCostAllowed,
  calculateMonthlyRunRate,
  calculatePaymentFeeMonthlyUsd,
  calculateProjectedPlanCapCost,
  calculateRecommendedChatTokensPerDay,
  calculateRecommendedExtractionsPerDay,
  calculateRecommendedStorageLimitBytes,
  calculateRequiredPriceForMargin,
  calculateSharedFixedCostAllocationPerUser,
  calculateUpgradePressureScore,
  classifyProfitabilityStatus,
  deriveScenarioRecommendation,
  getTotalSharedFixedCostUsd,
  normalizeMarginPct,
  normalizeBusinessAssumptions,
  roundUpPriceUsd,
  type BusinessAssumptions,
  type ProfitabilityStatus,
  type ScenarioRecommendation,
  type SharedCostAllocationStrategy,
} from '@/lib/profitability'
import {
  ensureDbReady,
  getAppSetting,
  pool,
  upsertAppSetting,
  type AdminAiCostModelDetail,
  type AdminAiCostStats,
  type AdminCreditStats,
  type AdminInvestorCostDriver,
  type AdminInvestorMetricsPack,
  type AdminInvestorPlanSnapshot,
  type AdminRecentTransaction,
  type AdminPlanProfitabilityStat,
  type AdminPlanScenarioSnapshot,
  type AdminUsageStats,
  type AdminUserAiCostDetail,
  type AdminUserCreditRow,
  type AdminUserProfitabilitySnapshot,
  type DailyExtractionSnapshot,
  type DbCreditTransaction,
  type DbPlan,
  type DbUser,
  type DbUserPlan,
  type ExtractionCostBreakdown,
  type UserAiDailyStat,
  type AdminUserMonthlyStats,
} from '@/lib/db'

const BUSINESS_ASSUMPTIONS_SETTING_KEY = 'business_assumptions_v1'

interface DbUserRow {
  id: string
  name: string
  email: string
  password_hash: string
  email_verified_at: Date | string | null
  blocked_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

interface DbPlanRow {
  id: string
  name: string
  display_name: string
  price_monthly_usd: string | number
  stripe_price_id: string | null
  extractions_per_hour: string | number
  extractions_per_day: string | number | null
  chat_tokens_per_day: string | number | null
  storage_limit_bytes: string | number | null
  target_gross_margin_pct: string | number | null
  profitability_alert_enabled: boolean | null
  estimated_monthly_fixed_cost_usd: string | number | null
  features_json: string
  is_active: boolean
  display_order: string | number
  created_at: Date | string
  updated_at: Date | string
}

interface DbUserPlanRow {
  id: string
  user_id: string
  plan: string
  extractions_per_hour: number | string
  extra_credits: number | string | null
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: string
  current_period_start: Date | string | null
  current_period_end: Date | string | null
  canceled_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

interface DbDailyExtractionCountRow {
  date: Date | string
  count: number | string
}

interface DbCreditTransactionRow {
  id: string
  user_id: string
  amount: number | string
  reason: string
  stripe_session_id: string | null
  created_at: Date | string
}

interface DbCountRow {
  total: number | string
}

interface DbAdminDailyExtractionRow {
  day: Date | string
  total: number | string
}

interface DbAdminTopVideoRow {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  total: number | string
  total_ai_cost_usd: string | number
  audio_transcription_cost_usd: string | number
  audio_transcription_calls: number | string
  missing_cost_log_total: number | string
  missing_audio_cost_log_total: number | string
}

interface DbAdminModeBreakdownRow {
  extraction_mode: string | null
  total: number | string
}

interface DbAdminYoutubeResolutionSummaryRow {
  youtube_total: number | string | null
  cache_total: number | string | null
  audio_total: number | string | null
  transcript_total: number | string | null
  other_total: number | string | null
}

interface DbAdminYoutubeTranscriptionCostRow {
  audio_transcription_calls: number | string | null
  audio_transcription_cost_usd: string | number | null
}

interface DbAdminTranscriptSourceBreakdownRow {
  transcript_source: string | null
  total: number | string
}

interface DbAiCostByModelRow {
  provider: string
  model: string
  calls: number | string
  input_tokens: number | string
  output_tokens: number | string
  cost_usd: string | number
}

interface DbAiCostByDayRow {
  day: Date | string
  cost_usd: string | number
  calls: number | string
}

interface DbAiCostTotalsRow {
  total_calls: number | string
  total_input: number | string
  total_output: number | string
  total_cost: string | number
}

interface DbAiCostByUseTypeRow {
  use_type: string
  calls: number | string
  input_tokens: number | string
  output_tokens: number | string
  cost_usd: string | number
}

interface DbAiCostBySourceTypeRow {
  source_type: string | null
  calls: number | string
  cost_usd: string | number
}

interface DbAiCostRecentCallRow {
  id: string
  created_at: Date | string
  use_type: string
  source_type: string | null
  user_id: string | null
  user_email: string | null
  extraction_id: string | null
  input_tokens: number | string
  output_tokens: number | string
  cost_usd: string | number
}

interface DbProfitabilityUserPlanRow {
  user_id: string
  plan_name: string
  plan_display_name: string
  plan_id: string
  price_monthly_usd: string | number
  extractions_per_day: string | number
  chat_tokens_per_day: string | number
  storage_limit_bytes: string | number | null
  target_gross_margin_pct: string | number | null
  profitability_alert_enabled: boolean | null
  estimated_monthly_fixed_cost_usd: string | number | null
  used_bytes: string | number | null
}

interface DbProfitabilityUsageRow {
  user_id: string
  use_type: string
  cost_usd: string | number
  input_tokens: string | number
  output_tokens: string | number
}

interface DbProfitabilityExtractionCountRow {
  user_id: string
  extractions: string | number
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseDbInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function getEstimatedStorageCostUsdPerByteMonth() {
  const raw = process.env.ACTION_EXTRACTOR_STORAGE_COST_USD_PER_GB_MONTH
  const parsed = Number.parseFloat(raw ?? '')
  const perGb = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  return perGb / (1024 * 1024 * 1024)
}

function percentileFromSorted(values: number[], percentile: number) {
  if (values.length === 0) return 0
  const safePercentile = Math.min(100, Math.max(0, percentile))
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil((safePercentile / 100) * values.length) - 1)
  )
  return values[index] ?? 0
}

function midpointInteger(current: number, recommended: number, roundTo = 1) {
  const mid = (current + recommended) / 2
  return Math.max(recommended, Math.ceil(mid / roundTo) * roundTo)
}

function buildPlanScenarioSnapshot(input: {
  stat: AdminPlanProfitabilityStat
  preset: 'conservative' | 'recommended'
  assumptions: BusinessAssumptions
  storageCostUsdPerByteMonth: number
}): AdminPlanScenarioSnapshot {
  const { stat, preset, assumptions, storageCostUsdPerByteMonth } = input
  const currentPrice = stat.price_monthly_usd
  const currentExtractions = stat.current_extractions_per_day
  const currentChatTokens = stat.current_chat_tokens_per_day
  const currentStorage = stat.storage_limit_bytes
  const recommendedExtractions = stat.recommended_extractions_per_day ?? currentExtractions
  const recommendedChatTokens = stat.recommended_chat_tokens_per_day ?? currentChatTokens
  const recommendedStorage = stat.recommended_storage_limit_bytes || currentStorage

  const scenarioExtractions = preset === 'recommended'
    ? recommendedExtractions
    : midpointInteger(currentExtractions, recommendedExtractions)
  const scenarioChatTokens = preset === 'recommended'
    ? recommendedChatTokens
    : midpointInteger(currentChatTokens, recommendedChatTokens, 1000)
  const scenarioStorage = preset === 'recommended'
    ? recommendedStorage
    : midpointInteger(currentStorage, recommendedStorage, 100 * 1024 * 1024)

  const projectedVariable = calculateProjectedPlanCapCost({
    extractionsPerDay: scenarioExtractions,
    avgExtractionCostUsd: stat.avg_extraction_cost_usd,
    chatTokensPerDay: scenarioChatTokens,
    avgChatCostPerTokenUsd: stat.avg_chat_cost_per_token_usd,
    storageCapCostUsd: scenarioStorage * storageCostUsdPerByteMonth,
  }).totalCostUsd

  const baseNonVariableCosts =
    stat.estimated_monthly_fixed_cost_usd + stat.allocated_shared_fixed_cost_per_user_usd
  const targetPriceForMargin = calculateRequiredPriceForMargin(
    projectedVariable + baseNonVariableCosts,
    stat.target_gross_margin_pct
  )

  const shouldRaisePrice =
    stat.scenario_recommendation === 'raise_price' ||
    stat.scenario_recommendation === 'raise_price_and_lower_limits'

  let scenarioPrice = currentPrice
  if (shouldRaisePrice && targetPriceForMargin !== null) {
    const multiplier = preset === 'recommended' ? 1 : 0.9
    scenarioPrice = Math.max(currentPrice, roundUpPriceUsd(targetPriceForMargin * multiplier))
  }

  const scenarioPaymentFee = calculatePaymentFeeMonthlyUsd({
    priceMonthlyUsd: scenarioPrice,
    paymentFeePct: assumptions.paymentFeePct,
    paymentFeeFixedUsd: assumptions.paymentFeeFixedUsd,
  })

  const scenarioProjectedCostUsd = projectedVariable + baseNonVariableCosts + scenarioPaymentFee
  const scenarioProjectedMarginPct = calculateGrossMarginPct(scenarioPrice, scenarioProjectedCostUsd)

  return {
    preset,
    label: preset === 'recommended' ? 'Recomendado' : 'Conservador',
    plan_id: stat.plan_id,
    plan_name: stat.plan_name,
    plan_display_name: stat.plan_display_name,
    current_price_monthly_usd: currentPrice,
    scenario_price_monthly_usd: scenarioPrice,
    current_extractions_per_day: currentExtractions,
    scenario_extractions_per_day: scenarioExtractions,
    current_chat_tokens_per_day: currentChatTokens,
    scenario_chat_tokens_per_day: scenarioChatTokens,
    current_storage_limit_bytes: currentStorage,
    scenario_storage_limit_bytes: scenarioStorage,
    scenario_projected_cost_usd: scenarioProjectedCostUsd,
    scenario_projected_margin_pct: scenarioProjectedMarginPct,
    recommendation: stat.scenario_recommendation,
    reason: stat.scenario_reason,
  }
}

async function listProfitabilityUserPlanRows(): Promise<DbProfitabilityUserPlanRow[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbProfitabilityUserPlanRow>(
    `
      SELECT
        u.id AS user_id,
        COALESCE(up.plan, 'free') AS plan_name,
        p.display_name AS plan_display_name,
        p.id AS plan_id,
        p.price_monthly_usd,
        p.extractions_per_day,
        p.chat_tokens_per_day,
        p.storage_limit_bytes,
        p.target_gross_margin_pct,
        p.profitability_alert_enabled,
        p.estimated_monthly_fixed_cost_usd,
        COALESCE(us.used_bytes, 0) AS used_bytes
      FROM users u
      LEFT JOIN user_plans up
        ON up.user_id = u.id
       AND up.status = 'active'
      INNER JOIN plans p
        ON p.name = COALESCE(up.plan, 'free')
      LEFT JOIN user_storage us
        ON us.user_id = u.id
      WHERE u.blocked_at IS NULL
    `
  )
  return rows
}

async function listProfitabilityUsageRows(periodDays: number): Promise<DbProfitabilityUsageRow[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbProfitabilityUsageRow>(
    `
      SELECT
        user_id,
        use_type,
        COALESCE(SUM(cost_usd), 0) AS cost_usd,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
      FROM ai_usage_log
      WHERE user_id IS NOT NULL
        AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY user_id, use_type
    `,
    [periodDays]
  )
  return rows
}

async function listProfitabilityExtractionCountRows(
  periodDays: number
): Promise<DbProfitabilityExtractionCountRow[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbProfitabilityExtractionCountRow>(
    `
      SELECT
        user_id,
        COUNT(*)::int AS extractions
      FROM extractions
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY user_id
    `,
    [periodDays]
  )
  return rows
}

function mapUserRow(row: DbUserRow): DbUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    email_verified_at: row.email_verified_at ? toIso(row.email_verified_at) : null,
    blocked_at: row.blocked_at ? toIso(row.blocked_at) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapPlanRow(row: DbPlanRow): DbPlan {
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    price_monthly_usd: Number(row.price_monthly_usd),
    stripe_price_id: row.stripe_price_id ?? null,
    extractions_per_hour: parseDbInteger(row.extractions_per_hour),
    extractions_per_day: parseDbInteger(row.extractions_per_day ?? 3),
    chat_tokens_per_day: parseDbInteger(row.chat_tokens_per_day ?? 10000),
    storage_limit_bytes: row.storage_limit_bytes != null ? Number(row.storage_limit_bytes) : 104857600,
    target_gross_margin_pct: row.target_gross_margin_pct != null ? Number(row.target_gross_margin_pct) : 0.75,
    profitability_alert_enabled: row.profitability_alert_enabled !== false,
    estimated_monthly_fixed_cost_usd:
      row.estimated_monthly_fixed_cost_usd != null ? Number(row.estimated_monthly_fixed_cost_usd) : 0,
    features_json: row.features_json,
    is_active: Boolean(row.is_active),
    display_order: parseDbInteger(row.display_order),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapUserPlanRow(row: DbUserPlanRow): DbUserPlan {
  return {
    id: row.id,
    user_id: row.user_id,
    plan: row.plan,
    extractions_per_hour: parseDbInteger(row.extractions_per_hour),
    extra_credits: parseDbInteger(row.extra_credits ?? 0),
    stripe_subscription_id: row.stripe_subscription_id ?? null,
    stripe_price_id: row.stripe_price_id ?? null,
    status: row.status,
    current_period_start: row.current_period_start ? toIso(row.current_period_start) : null,
    current_period_end: row.current_period_end ? toIso(row.current_period_end) : null,
    canceled_at: row.canceled_at ? toIso(row.canceled_at) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function getUtcDateParts(reference = new Date()) {
  const year = reference.getUTCFullYear()
  const month = String(reference.getUTCMonth() + 1).padStart(2, '0')
  const day = String(reference.getUTCDate()).padStart(2, '0')
  const today = `${year}-${month}-${day}`
  const resetDate = new Date(Date.UTC(year, reference.getUTCMonth(), reference.getUTCDate() + 1))
  return {
    today,
    reset_at: resetDate.toISOString(),
  }
}

async function getActivePlanSnapshotForUpdate(client: PoolClient, userId: string) {
  const [planResult, activePlanResult] = await Promise.all([
    client.query<{ extractions_per_day: number | string | null }>(
      `
        SELECT p.extractions_per_day
        FROM user_plans up
        LEFT JOIN plans p ON p.name = up.plan
        WHERE up.user_id = $1 AND up.status = 'active'
        LIMIT 1
      `,
      [userId]
    ),
    client.query<{ id: string; extra_credits: number | string | null }>(
      `
        SELECT id, extra_credits
        FROM user_plans
        WHERE user_id = $1 AND status = 'active'
        LIMIT 1
        FOR UPDATE
      `,
      [userId]
    ),
  ])

  return {
    limit:
      planResult.rows[0]?.extractions_per_day != null
        ? parseDbInteger(planResult.rows[0].extractions_per_day)
        : 3,
    activePlanId: activePlanResult.rows[0]?.id ?? null,
    extraCredits: activePlanResult.rows[0]
      ? parseDbInteger(activePlanResult.rows[0].extra_credits ?? 0)
      : 0,
  }
}

export async function getBusinessAssumptions(): Promise<BusinessAssumptions> {
  const raw = await getAppSetting(BUSINESS_ASSUMPTIONS_SETTING_KEY)
  if (!raw) return DEFAULT_BUSINESS_ASSUMPTIONS

  try {
    return normalizeBusinessAssumptions(JSON.parse(raw) as Partial<BusinessAssumptions>)
  } catch {
    return DEFAULT_BUSINESS_ASSUMPTIONS
  }
}

export async function upsertBusinessAssumptions(
  input: Partial<BusinessAssumptions> | BusinessAssumptions
): Promise<BusinessAssumptions> {
  const normalized = normalizeBusinessAssumptions(input)
  await upsertAppSetting(BUSINESS_ASSUMPTIONS_SETTING_KEY, JSON.stringify(normalized))
  return normalized
}

export async function listPlans(): Promise<DbPlan[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbPlanRow>(
    `SELECT id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
            extractions_per_day, chat_tokens_per_day, storage_limit_bytes, target_gross_margin_pct,
            profitability_alert_enabled, estimated_monthly_fixed_cost_usd,
            features_json, is_active, display_order, created_at, updated_at
     FROM plans
     ORDER BY display_order ASC, created_at ASC`
  )
  return rows.map(mapPlanRow)
}

export async function getPlanByName(name: string): Promise<DbPlan | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbPlanRow>(
    `SELECT id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
            extractions_per_day, chat_tokens_per_day, storage_limit_bytes, target_gross_margin_pct,
            profitability_alert_enabled, estimated_monthly_fixed_cost_usd,
            features_json, is_active, display_order, created_at, updated_at
     FROM plans WHERE name = $1 LIMIT 1`,
    [name]
  )
  return rows[0] ? mapPlanRow(rows[0]) : null
}

export async function createPlan(input: {
  name: string
  displayName: string
  priceMonthlyUsd: number
  stripePriceId: string | null
  extractionsPerHour: number
  extractionsPerDay?: number
  chatTokensPerDay?: number
  storageLimitBytes?: number
  targetGrossMarginPct?: number
  profitabilityAlertEnabled?: boolean
  estimatedMonthlyFixedCostUsd?: number
  featuresJson: string
  isActive: boolean
  displayOrder: number
}): Promise<DbPlan> {
  await ensureDbReady()
  const id = `plan_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  const { rows } = await pool.query<DbPlanRow>(
    `INSERT INTO plans
       (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
        extractions_per_day, chat_tokens_per_day, storage_limit_bytes, target_gross_margin_pct,
        profitability_alert_enabled, estimated_monthly_fixed_cost_usd,
        features_json, is_active, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
               extractions_per_day, chat_tokens_per_day, storage_limit_bytes, target_gross_margin_pct,
               profitability_alert_enabled, estimated_monthly_fixed_cost_usd,
               features_json, is_active, display_order, created_at, updated_at`,
    [
      id,
      input.name.toLowerCase().trim(),
      input.displayName.trim(),
      input.priceMonthlyUsd,
      input.stripePriceId || null,
      input.extractionsPerHour,
      input.extractionsPerDay ?? 3,
      input.chatTokensPerDay ?? 10000,
      input.storageLimitBytes ?? 104857600,
      normalizeMarginPct(input.targetGrossMarginPct ?? 0.75),
      input.profitabilityAlertEnabled !== false,
      input.estimatedMonthlyFixedCostUsd ?? 0,
      input.featuresJson,
      input.isActive,
      input.displayOrder,
    ]
  )
  return mapPlanRow(rows[0])
}

export async function updatePlan(
  id: string,
  input: Partial<{
    name: string
    displayName: string
    priceMonthlyUsd: number
    stripePriceId: string | null
    extractionsPerHour: number
    extractionsPerDay: number
    chatTokensPerDay: number
    storageLimitBytes: number
    targetGrossMarginPct: number
    profitabilityAlertEnabled: boolean
    estimatedMonthlyFixedCostUsd: number
    featuresJson: string
    isActive: boolean
    displayOrder: number
  }>
): Promise<DbPlan | null> {
  await ensureDbReady()

  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let idx = 1

  if (input.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(input.name.toLowerCase().trim()) }
  if (input.displayName !== undefined) { setClauses.push(`display_name = $${idx++}`); values.push(input.displayName.trim()) }
  if (input.priceMonthlyUsd !== undefined) { setClauses.push(`price_monthly_usd = $${idx++}`); values.push(input.priceMonthlyUsd) }
  if ('stripePriceId' in input) { setClauses.push(`stripe_price_id = $${idx++}`); values.push(input.stripePriceId || null) }
  if (input.extractionsPerHour !== undefined) { setClauses.push(`extractions_per_hour = $${idx++}`); values.push(input.extractionsPerHour) }
  if (input.extractionsPerDay !== undefined) { setClauses.push(`extractions_per_day = $${idx++}`); values.push(input.extractionsPerDay) }
  if (input.chatTokensPerDay !== undefined) { setClauses.push(`chat_tokens_per_day = $${idx++}`); values.push(input.chatTokensPerDay) }
  if (input.storageLimitBytes !== undefined) { setClauses.push(`storage_limit_bytes = $${idx++}`); values.push(input.storageLimitBytes) }
  if (input.targetGrossMarginPct !== undefined) {
    setClauses.push(`target_gross_margin_pct = $${idx++}`)
    values.push(normalizeMarginPct(input.targetGrossMarginPct))
  }
  if (input.profitabilityAlertEnabled !== undefined) {
    setClauses.push(`profitability_alert_enabled = $${idx++}`)
    values.push(input.profitabilityAlertEnabled)
  }
  if (input.estimatedMonthlyFixedCostUsd !== undefined) {
    setClauses.push(`estimated_monthly_fixed_cost_usd = $${idx++}`)
    values.push(input.estimatedMonthlyFixedCostUsd)
  }
  if (input.featuresJson !== undefined) { setClauses.push(`features_json = $${idx++}`); values.push(input.featuresJson) }
  if (input.isActive !== undefined) { setClauses.push(`is_active = $${idx++}`); values.push(input.isActive) }
  if (input.displayOrder !== undefined) { setClauses.push(`display_order = $${idx++}`); values.push(input.displayOrder) }

  if (values.length === 0) {
    const { rows } = await pool.query<DbPlanRow>(
      `SELECT id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
              extractions_per_day, chat_tokens_per_day, storage_limit_bytes, target_gross_margin_pct,
              profitability_alert_enabled, estimated_monthly_fixed_cost_usd,
              features_json, is_active, display_order, created_at, updated_at
       FROM plans
       WHERE id = $1
       LIMIT 1`,
      [id]
    )
    return rows[0] ? mapPlanRow(rows[0]) : null
  }

  values.push(id)
  const { rows } = await pool.query<DbPlanRow>(
    `UPDATE plans SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour,
               extractions_per_day, chat_tokens_per_day, storage_limit_bytes, target_gross_margin_pct,
               profitability_alert_enabled, estimated_monthly_fixed_cost_usd,
               features_json, is_active, display_order, created_at, updated_at`,
    values
  )
  return rows[0] ? mapPlanRow(rows[0]) : null
}

export async function deletePlan(id: string): Promise<void> {
  await ensureDbReady()
  await pool.query(`DELETE FROM plans WHERE id = $1`, [id])
}

export async function getUserActivePlan(userId: string): Promise<DbUserPlan | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserPlanRow>(
    `SELECT id, user_id, plan, extractions_per_hour, extra_credits, stripe_subscription_id, stripe_price_id,
            status, current_period_start, current_period_end, canceled_at, created_at, updated_at
     FROM user_plans
     WHERE user_id = $1 AND status = 'active'
     LIMIT 1`,
    [userId]
  )
  return rows[0] ? mapUserPlanRow(rows[0]) : null
}

export async function getUserPlanRateLimit(userId: string): Promise<number> {
  const plan = await getUserActivePlan(userId)
  if (!plan) {
    const raw = process.env.ACTION_EXTRACTOR_EXTRACTIONS_PER_HOUR
    if (!raw) return 12
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 12
  }
  return plan.extractions_per_hour
}

export async function upsertUserActivePlan(input: {
  userId: string
  plan: string
  extractionsPerHour: number
  extractionsPerDay?: number
  subscriptionId: string
  priceId: string
  periodStart: Date | null
  periodEnd: Date | null
}): Promise<void> {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `INSERT INTO user_plans
       (id, user_id, plan, extractions_per_hour, stripe_subscription_id, stripe_price_id,
        status, current_period_start, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, NOW())
     ON CONFLICT (user_id) WHERE status = 'active'
     DO UPDATE SET
       plan = EXCLUDED.plan,
       extractions_per_hour = EXCLUDED.extractions_per_hour,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       updated_at = NOW()`,
    [
      id,
      input.userId,
      input.plan,
      input.extractionsPerHour,
      input.subscriptionId,
      input.priceId,
      input.periodStart ? input.periodStart.toISOString() : null,
      input.periodEnd ? input.periodEnd.toISOString() : null,
    ]
  )
}

export async function deactivateUserPlan(userId: string, subscriptionId: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `UPDATE user_plans
     SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND stripe_subscription_id = $2 AND status = 'active'`,
    [userId, subscriptionId]
  )
}

export async function setUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `UPDATE users SET stripe_customer_id = $2, updated_at = NOW() WHERE id = $1`,
    [userId, stripeCustomerId]
  )
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<DbUser | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `SELECT id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
     FROM users
     WHERE stripe_customer_id = $1
     LIMIT 1`,
    [stripeCustomerId]
  )
  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function getUserStripeCustomerId(userId: string): Promise<string | null> {
  await ensureDbReady()
  const { rows } = await pool.query<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  )
  return rows[0]?.stripe_customer_id ?? null
}

export async function claimStripeEventProcessing(
  id: string,
  eventType: string,
  userId: string | null,
  rawJson: string
): Promise<boolean> {
  await ensureDbReady()
  const { rows } = await pool.query<{ id: string }>(
    `
      INSERT INTO stripe_events (id, event_type, user_id, raw_json, processing, processed, last_error)
      VALUES ($1, $2, $3, $4, TRUE, FALSE, NULL)
      ON CONFLICT (id) DO UPDATE
      SET
        event_type = EXCLUDED.event_type,
        user_id = COALESCE(EXCLUDED.user_id, stripe_events.user_id),
        raw_json = EXCLUDED.raw_json,
        processing = CASE
          WHEN stripe_events.processed = FALSE AND stripe_events.processing = FALSE THEN TRUE
          ELSE stripe_events.processing
        END,
        last_error = CASE
          WHEN stripe_events.processed = FALSE AND stripe_events.processing = FALSE THEN NULL
          ELSE stripe_events.last_error
        END
      WHERE stripe_events.processed = FALSE AND stripe_events.processing = FALSE
      RETURNING id
    `,
    [id, eventType, userId, rawJson]
  )
  return rows.length > 0
}

export async function markStripeEventProcessed(id: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `UPDATE stripe_events
     SET processed = TRUE, processing = FALSE, processed_at = NOW(), last_error = NULL
     WHERE id = $1`,
    [id]
  )
}

export async function releaseStripeEventProcessing(id: string, message: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `UPDATE stripe_events
     SET processing = FALSE, last_error = $2
     WHERE id = $1`,
    [id, message.slice(0, 2000)]
  )
}

export async function getUserDailyLimit(userId: string): Promise<number> {
  await ensureDbReady()
  const { rows } = await pool.query<{ extractions_per_day: number | string }>(
    `SELECT p.extractions_per_day
     FROM user_plans up
     JOIN plans p ON p.name = up.plan
     WHERE up.user_id = $1 AND up.status = 'active'
     LIMIT 1`,
    [userId]
  )
  if (rows[0]) return parseDbInteger(rows[0].extractions_per_day)
  return 3
}

export async function getDailyExtractionSnapshot(userId: string): Promise<DailyExtractionSnapshot> {
  await ensureDbReady()
  const limit = await getUserDailyLimit(userId)
  const { today, reset_at } = getUtcDateParts()

  const [countResult, creditsResult] = await Promise.all([
    pool.query<DbDailyExtractionCountRow>(
      `SELECT date, count FROM daily_extraction_counts WHERE user_id = $1 AND date = $2 LIMIT 1`,
      [userId, today]
    ),
    pool.query<{ extra_credits: number | string | null }>(
      `SELECT extra_credits FROM user_plans WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    ),
  ])

  const used = countResult.rows[0] ? parseDbInteger(countResult.rows[0].count) : 0
  const extra_credits = creditsResult.rows[0]
    ? parseDbInteger(creditsResult.rows[0].extra_credits ?? 0)
    : 0

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    extra_credits,
    reset_at,
  }
}

export async function consumeDailyExtraction(userId: string): Promise<{
  allowed: boolean
  used_credit: boolean
  snapshot: DailyExtractionSnapshot
}> {
  await ensureDbReady()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { today, reset_at } = getUtcDateParts()
    const planSnapshot = await getActivePlanSnapshotForUpdate(client, userId)

    await client.query(
      `INSERT INTO daily_extraction_counts (user_id, date, count)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, date) DO NOTHING`,
      [userId, today]
    )

    const countResult = await client.query<DbDailyExtractionCountRow>(
      `
        SELECT date, count
        FROM daily_extraction_counts
        WHERE user_id = $1 AND date = $2
        LIMIT 1
        FOR UPDATE
      `,
      [userId, today]
    )

    const used = countResult.rows[0] ? parseDbInteger(countResult.rows[0].count) : 0

    if (used < planSnapshot.limit) {
      const updatedCountResult = await client.query<{ count: number | string }>(
        `
          UPDATE daily_extraction_counts
          SET count = count + 1, updated_at = NOW()
          WHERE user_id = $1 AND date = $2
          RETURNING count
        `,
        [userId, today]
      )

      const updatedCountRow = updatedCountResult.rows[0]
      if (!updatedCountRow) {
        throw new Error('Failed to increment daily extraction count atomically.')
      }

      const nextUsed = parseDbInteger(updatedCountRow.count)
      await client.query('COMMIT')
      return {
        allowed: true,
        used_credit: false,
        snapshot: {
          limit: planSnapshot.limit,
          used: nextUsed,
          remaining: Math.max(0, planSnapshot.limit - nextUsed),
          extra_credits: planSnapshot.extraCredits,
          reset_at,
        },
      }
    }

    if (planSnapshot.activePlanId && planSnapshot.extraCredits > 0) {
      const updatedCreditsResult = await client.query<{ extra_credits: number | string }>(
        `
          UPDATE user_plans
          SET extra_credits = extra_credits - 1, updated_at = NOW()
          WHERE id = $1 AND extra_credits > 0
          RETURNING extra_credits
        `,
        [planSnapshot.activePlanId]
      )

      const updatedCreditsRow = updatedCreditsResult.rows[0]
      if (!updatedCreditsRow) {
        throw new Error('Failed to consume extra credit atomically.')
      }

      const remainingCredits = parseDbInteger(updatedCreditsRow.extra_credits)
      await client.query(
        `INSERT INTO credit_transactions (id, user_id, amount, reason)
         VALUES ($1, $2, -1, 'consumed')`,
        [randomUUID(), userId]
      )
      await client.query('COMMIT')
      return {
        allowed: true,
        used_credit: true,
        snapshot: {
          limit: planSnapshot.limit,
          used,
          remaining: 0,
          extra_credits: remainingCredits,
          reset_at,
        },
      }
    }

    await client.query('COMMIT')
    return {
      allowed: false,
      used_credit: false,
      snapshot: {
        limit: planSnapshot.limit,
        used,
        remaining: Math.max(0, planSnapshot.limit - used),
        extra_credits: planSnapshot.extraCredits,
        reset_at,
      },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function getUserCreditBalance(userId: string): Promise<number> {
  await ensureDbReady()
  const { rows } = await pool.query<{ extra_credits: number | string | null }>(
    `SELECT extra_credits FROM user_plans WHERE user_id = $1 AND status = 'active' LIMIT 1`,
    [userId]
  )
  return rows[0] ? parseDbInteger(rows[0].extra_credits ?? 0) : 0
}

export async function consumeUserCredit(userId: string): Promise<void> {
  await ensureDbReady()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ id: string; extra_credits: number | string | null }>(
      `
        SELECT id, extra_credits
        FROM user_plans
        WHERE user_id = $1 AND status = 'active'
        LIMIT 1
        FOR UPDATE
      `,
      [userId]
    )

    const activePlanId = rows[0]?.id ?? null
    const balance = rows[0] ? parseDbInteger(rows[0].extra_credits ?? 0) : 0
    if (!activePlanId || balance <= 0) {
      throw new Error('No hay créditos disponibles para consumir.')
    }

    await client.query(
      `
        UPDATE user_plans
        SET extra_credits = extra_credits - 1, updated_at = NOW()
        WHERE id = $1
      `,
      [activePlanId]
    )
    await client.query(
      `INSERT INTO credit_transactions (id, user_id, amount, reason)
       VALUES ($1, $2, -1, 'consumed')`,
      [randomUUID(), userId]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function addUserCredits(
  userId: string,
  amount: number,
  reason: string,
  stripeSessionId?: string
): Promise<{ applied: boolean }> {
  await ensureDbReady()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const txId = randomUUID()
    let transactionInserted = true

    if (stripeSessionId) {
      const insertTxResult = await client.query<{ id: string }>(
        `
          INSERT INTO credit_transactions (id, user_id, amount, reason, stripe_session_id)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
          RETURNING id
        `,
        [txId, userId, amount, reason, stripeSessionId]
      )
      transactionInserted = insertTxResult.rows.length > 0
    } else {
      await client.query(
        `INSERT INTO credit_transactions (id, user_id, amount, reason, stripe_session_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [txId, userId, amount, reason, null]
      )
    }

    if (!transactionInserted) {
      await client.query('ROLLBACK')
      return { applied: false }
    }

    await client.query(
      `INSERT INTO user_plans (id, user_id, plan, extractions_per_hour, extra_credits, status)
       VALUES ($1, $2, 'free', 12, $3, 'active')
       ON CONFLICT (user_id) WHERE status = 'active'
       DO UPDATE SET extra_credits = user_plans.extra_credits + $3, updated_at = NOW()`,
      [randomUUID(), userId, amount]
    )

    await client.query('COMMIT')
    return { applied: true }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function listUserCreditTransactions(
  userId: string,
  limit = 10
): Promise<DbCreditTransaction[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbCreditTransactionRow>(
    `SELECT id, user_id, amount, reason, stripe_session_id, created_at
     FROM credit_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    amount: parseDbInteger(row.amount),
    reason: row.reason,
    stripe_session_id: row.stripe_session_id ?? null,
    created_at: toIso(row.created_at),
  }))
}

export async function getAdminUsageStats(periodDays = 30): Promise<AdminUsageStats> {
  await ensureDbReady()

  const safePeriodDays = Number.isFinite(periodDays)
    ? Math.min(90, Math.max(1, Math.trunc(periodDays)))
    : 30

  const [totalUsersResult, totalExtractionsResult, activeUsers7dResult, last24hResult, uniqueVideosResult] =
    await Promise.all([
      pool.query<DbCountRow>('SELECT COUNT(*)::int AS total FROM users'),
      pool.query<DbCountRow>('SELECT COUNT(*)::int AS total FROM extractions'),
      pool.query<DbCountRow>(
        `
          SELECT COUNT(DISTINCT user_id)::int AS total
          FROM extractions
          WHERE created_at >= NOW() - INTERVAL '7 days'
        `
      ),
      pool.query<DbCountRow>(
        `
          SELECT COUNT(*)::int AS total
          FROM extractions
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        `
      ),
      pool.query<DbCountRow>(
        `
          SELECT COUNT(DISTINCT video_id)::int AS total
          FROM extractions
          WHERE video_id IS NOT NULL
            AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
        `,
        [safePeriodDays]
      ),
    ])

  const [
    dailyResult,
    topVideosResult,
    modeBreakdownResult,
    youtubeResolutionSummaryResult,
    youtubeTranscriptionCostResult,
    transcriptSourceBreakdownResult,
  ] = await Promise.all([
    pool.query<DbAdminDailyExtractionRow>(
      `
        SELECT
          date_trunc('day', created_at) AS day,
          COUNT(*)::int AS total
        FROM extractions
        WHERE created_at >= date_trunc('day', NOW()) - (($1::int - 1) * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [safePeriodDays]
    ),
    pool.query<DbAdminTopVideoRow>(
      `
        SELECT
          e.video_id,
          MAX(e.video_title) AS video_title,
          MAX(e.thumbnail_url) AS thumbnail_url,
          COUNT(*)::int AS total,
          COALESCE(SUM(ai.total_ai_cost_usd), 0) AS total_ai_cost_usd,
          COALESCE(SUM(ai.audio_transcription_cost_usd), 0) AS audio_transcription_cost_usd,
          COALESCE(SUM(ai.audio_transcription_calls), 0)::int AS audio_transcription_calls,
          COUNT(*) FILTER (WHERE COALESCE(ai.total_ai_calls, 0) = 0)::int AS missing_cost_log_total,
          COUNT(*) FILTER (
            WHERE e.transcript_source = 'openai_audio_transcription'
              AND COALESCE(ai.audio_transcription_calls, 0) = 0
          )::int AS missing_audio_cost_log_total
        FROM extractions e
        LEFT JOIN (
          SELECT
            extraction_id,
            COUNT(*)::int AS total_ai_calls,
            COALESCE(SUM(cost_usd), 0) AS total_ai_cost_usd,
            COALESCE(SUM(cost_usd) FILTER (WHERE use_type = 'transcription'), 0) AS audio_transcription_cost_usd,
            COUNT(*) FILTER (WHERE use_type = 'transcription')::int AS audio_transcription_calls
          FROM ai_usage_log
          WHERE extraction_id IS NOT NULL
          GROUP BY extraction_id
        ) ai ON ai.extraction_id = e.id
        WHERE e.video_id IS NOT NULL
          AND e.created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY e.video_id
        ORDER BY total DESC, total_ai_cost_usd DESC
        LIMIT 10
      `,
      [safePeriodDays]
    ),
    pool.query<DbAdminModeBreakdownRow>(
      `
        SELECT
          extraction_mode,
          COUNT(*)::int AS total
        FROM extractions
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY extraction_mode
        ORDER BY total DESC
      `,
      [safePeriodDays]
    ),
    pool.query<DbAdminYoutubeResolutionSummaryRow>(
      `
        SELECT
          COUNT(*)::int AS youtube_total,
          COUNT(*) FILTER (
            WHERE transcript_source IN ('cache_exact', 'cache_transcript', 'cache_result')
          )::int AS cache_total,
          COUNT(*) FILTER (
            WHERE transcript_source = 'openai_audio_transcription'
          )::int AS audio_total,
          COUNT(*) FILTER (
            WHERE transcript_source IN (
              'custom_extractor',
              'youtube_transcript',
              'yt_dlp_subtitles',
              'youtube_official_api'
            )
          )::int AS transcript_total,
          COUNT(*) FILTER (
            WHERE transcript_source IS NULL
              OR transcript_source NOT IN (
                'cache_exact',
                'cache_transcript',
                'cache_result',
                'openai_audio_transcription',
                'custom_extractor',
                'youtube_transcript',
                'yt_dlp_subtitles',
                'youtube_official_api'
              )
          )::int AS other_total
        FROM extractions
        WHERE source_type = 'youtube'
          AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
      `,
      [safePeriodDays]
    ),
    pool.query<DbAdminYoutubeTranscriptionCostRow>(
      `
        SELECT
          COUNT(*)::int AS audio_transcription_calls,
          COALESCE(SUM(cost_usd), 0) AS audio_transcription_cost_usd
        FROM ai_usage_log
        WHERE source_type = 'youtube'
          AND use_type = 'transcription'
          AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
      `,
      [safePeriodDays]
    ),
    pool.query<DbAdminTranscriptSourceBreakdownRow>(
      `
        SELECT
          COALESCE(transcript_source, 'unknown') AS transcript_source,
          COUNT(*)::int AS total
        FROM extractions
        WHERE source_type = 'youtube'
          AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY COALESCE(transcript_source, 'unknown')
        ORDER BY total DESC, transcript_source ASC
      `,
      [safePeriodDays]
    ),
  ])

  const youtubeResolutionSummary = youtubeResolutionSummaryResult.rows[0]
  const youtubeExtractionsTotal = parseDbInteger(youtubeResolutionSummary?.youtube_total)
  const cacheTotal = parseDbInteger(youtubeResolutionSummary?.cache_total)
  const audioTotal = parseDbInteger(youtubeResolutionSummary?.audio_total)
  const transcriptTotal = parseDbInteger(youtubeResolutionSummary?.transcript_total)
  const otherTotal = parseDbInteger(youtubeResolutionSummary?.other_total)
  const liveTotal = Math.max(0, youtubeExtractionsTotal - cacheTotal)
  const youtubeTranscriptionCost = youtubeTranscriptionCostResult.rows[0]
  const audioTranscriptionCalls = parseDbInteger(youtubeTranscriptionCost?.audio_transcription_calls)
  const audioTranscriptionCostUsd = Number(youtubeTranscriptionCost?.audio_transcription_cost_usd ?? 0)

  const resolveTranscriptResolutionKind = (
    transcriptSource: string | null | undefined
  ): 'cache' | 'audio' | 'transcript' | 'other' => {
    if (!transcriptSource) return 'other'
    if (['cache_exact', 'cache_transcript', 'cache_result'].includes(transcriptSource)) return 'cache'
    if (transcriptSource === 'openai_audio_transcription') return 'audio'
    if (
      ['custom_extractor', 'youtube_transcript', 'yt_dlp_subtitles', 'youtube_official_api'].includes(
        transcriptSource
      )
    ) {
      return 'transcript'
    }
    return 'other'
  }

  const roundShare = (value: number) => Math.round(value * 10) / 10

  return {
    period_days: safePeriodDays,
    generated_at: new Date().toISOString(),
    total_users: parseDbInteger(totalUsersResult.rows[0]?.total),
    total_extractions: parseDbInteger(totalExtractionsResult.rows[0]?.total),
    active_users_7d: parseDbInteger(activeUsers7dResult.rows[0]?.total),
    extractions_last_24h: parseDbInteger(last24hResult.rows[0]?.total),
    unique_videos_in_period: parseDbInteger(uniqueVideosResult.rows[0]?.total),
    extractions_by_day: dailyResult.rows.map((row) => ({
      date: toIso(row.day).slice(0, 10),
      total: parseDbInteger(row.total),
    })),
    top_videos: topVideosResult.rows.map((row) => ({
      video_id: row.video_id,
      video_title: row.video_title,
      thumbnail_url: row.thumbnail_url,
      total: parseDbInteger(row.total),
      total_ai_cost_usd: Number(row.total_ai_cost_usd ?? 0),
      audio_transcription_cost_usd: Number(row.audio_transcription_cost_usd ?? 0),
      audio_transcription_calls: parseDbInteger(row.audio_transcription_calls),
      missing_cost_log_total: parseDbInteger(row.missing_cost_log_total),
      missing_audio_cost_log_total: parseDbInteger(row.missing_audio_cost_log_total),
    })),
    extraction_modes: modeBreakdownResult.rows.map((row) => ({
      extraction_mode: row.extraction_mode || 'action_plan',
      total: parseDbInteger(row.total),
    })),
    youtube_resolution: {
      youtube_extractions_total: youtubeExtractionsTotal,
      cache_total: cacheTotal,
      live_total: liveTotal,
      audio_total: audioTotal,
      transcript_total: transcriptTotal,
      other_total: otherTotal,
      audio_transcription_calls: audioTranscriptionCalls,
      audio_transcription_cost_usd: audioTranscriptionCostUsd,
      transcript_sources: transcriptSourceBreakdownResult.rows.map((row) => {
        const transcriptSource = row.transcript_source || 'unknown'
        const total = parseDbInteger(row.total)
        const kind = resolveTranscriptResolutionKind(transcriptSource)
        const isLiveKind = kind === 'audio' || kind === 'transcript' || kind === 'other'
        return {
          transcript_source: transcriptSource,
          kind,
          total,
          share_of_youtube: youtubeExtractionsTotal > 0 ? roundShare((total / youtubeExtractionsTotal) * 100) : 0,
          share_of_live: isLiveKind && liveTotal > 0 ? roundShare((total / liveTotal) * 100) : 0,
        }
      }),
    },
  }
}

export async function logAiUsage(input: {
  provider: string
  model: string
  useType: string
  userId?: string | null
  extractionId?: string | null
  sourceType?: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  pricingVersion?: string | null
}): Promise<void> {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `
      INSERT INTO ai_usage_log (
        id,
        provider,
        model,
        use_type,
        user_id,
        extraction_id,
        source_type,
        input_tokens,
        output_tokens,
        cost_usd,
        pricing_version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      id,
      input.provider,
      input.model,
      input.useType,
      input.userId ?? null,
      input.extractionId ?? null,
      input.sourceType ?? null,
      input.inputTokens,
      input.outputTokens,
      input.costUsd,
      input.pricingVersion ?? '',
    ]
  )
}

export async function getAdminUserAiCostDetail(userId: string): Promise<AdminUserAiCostDetail> {
  await ensureDbReady()

  const [totalsResult, byModelResult, byUseTypeResult] = await Promise.all([
    pool.query<{
      total_calls: number | string
      total_input: number | string
      total_output: number | string
      total_cost: string | number
    }>(
      `
        SELECT
          COUNT(*)::int AS total_calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output,
          COALESCE(SUM(cost_usd), 0) AS total_cost
        FROM ai_usage_log
        WHERE user_id = $1
      `,
      [userId]
    ),
    pool.query<DbAiCostByModelRow>(
      `
        SELECT
          provider,
          model,
          COUNT(*)::int AS calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
        GROUP BY provider, model
        ORDER BY SUM(cost_usd) DESC
      `,
      [userId]
    ),
    pool.query<{ use_type: string; calls: number | string; cost_usd: string | number }>(
      `
        SELECT
          use_type,
          COUNT(*)::int AS calls,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
        GROUP BY use_type
        ORDER BY SUM(cost_usd) DESC
      `,
      [userId]
    ),
  ])

  const totals = totalsResult.rows[0]
  return {
    total_calls: parseDbInteger(totals?.total_calls),
    total_input_tokens: Number(totals?.total_input ?? 0),
    total_output_tokens: Number(totals?.total_output ?? 0),
    total_cost_usd: Number(totals?.total_cost ?? 0),
    by_model: byModelResult.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      calls: parseDbInteger(row.calls),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
    })),
    by_use_type: byUseTypeResult.rows.map((row) => ({
      use_type: row.use_type,
      calls: parseDbInteger(row.calls),
      cost_usd: Number(row.cost_usd),
    })),
  }
}

export async function getUserAiDailyUsage(userId: string, days = 30): Promise<UserAiDailyStat[]> {
  await ensureDbReady()
  const safeDays = Math.min(90, Math.max(7, Math.trunc(days)))
  const { rows } = await pool.query<{
    day: Date | string
    calls: number | string
    input_tokens: number | string
    output_tokens: number | string
    cost_usd: string | number
  }>(
    `
      SELECT
        DATE(created_at AT TIME ZONE 'UTC') AS day,
        COUNT(*)::int AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(cost_usd), 0) AS cost_usd
      FROM ai_usage_log
      WHERE user_id = $1
        AND created_at >= NOW() - ($2 * INTERVAL '1 day')
      GROUP BY day
      ORDER BY day ASC
    `,
    [userId, safeDays]
  )
  return rows.map((row) => ({
    date:
      typeof row.day === 'string'
        ? row.day.slice(0, 10)
        : row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10),
    calls: parseDbInteger(row.calls),
    tokens: Number(row.input_tokens ?? 0) + Number(row.output_tokens ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
  }))
}

export async function getAdminUserMonthlyStats(userId: string): Promise<AdminUserMonthlyStats> {
  await ensureDbReady()

  const [aiResult, extractionsResult] = await Promise.all([
    pool.query<{
      month: string
      ai_calls: number | string
      input_tokens: number | string
      output_tokens: number | string
      cost_usd: string | number
    }>(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS ai_calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
      `,
      [userId]
    ),
    pool.query<{ month: string; extractions: number | string }>(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS extractions
        FROM extractions
        WHERE user_id = $1
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) ASC
      `,
      [userId]
    ),
  ])

  const extractionsByMonth = new Map(
    extractionsResult.rows.map((row) => [row.month, parseDbInteger(row.extractions)])
  )

  const months = aiResult.rows.map((row) => {
    const [year, month] = row.month.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    const monthLabel = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    return {
      month: row.month,
      month_label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      ai_calls: parseDbInteger(row.ai_calls),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
      extractions: extractionsByMonth.get(row.month) ?? 0,
    }
  })

  for (const [month, count] of Array.from(extractionsByMonth)) {
    if (!months.find((entry) => entry.month === month)) {
      const [year, mon] = month.split('-')
      const date = new Date(Number(year), Number(mon) - 1, 1)
      const monthLabel = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      months.push({
        month,
        month_label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        ai_calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        extractions: count,
      })
    }
  }

  months.sort((a, b) => a.month.localeCompare(b.month))

  return { user_id: userId, months }
}

export async function getAdminAiCostStats(periodDays = 30): Promise<AdminAiCostStats> {
  await ensureDbReady()

  const safeDays = Number.isFinite(periodDays) ? Math.min(90, Math.max(1, Math.trunc(periodDays))) : 30

  const [totalsResult, byModelResult, byDayResult] = await Promise.all([
    pool.query<DbAiCostTotalsRow>(
      `
        SELECT
          COUNT(*)::int AS total_calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output,
          COALESCE(SUM(cost_usd), 0) AS total_cost
        FROM ai_usage_log
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      `,
      [safeDays]
    ),
    pool.query<DbAiCostByModelRow>(
      `
        SELECT
          provider,
          model,
          COUNT(*)::int AS calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY provider, model
        ORDER BY SUM(cost_usd) DESC
      `,
      [safeDays]
    ),
    pool.query<DbAiCostByDayRow>(
      `
        SELECT
          date_trunc('day', created_at) AS day,
          COALESCE(SUM(cost_usd), 0) AS cost_usd,
          COUNT(*)::int AS calls
        FROM ai_usage_log
        WHERE created_at >= date_trunc('day', NOW()) - (($1::int - 1) * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [safeDays]
    ),
  ])

  const totals = totalsResult.rows[0]
  return {
    period_days: safeDays,
    total_calls: parseDbInteger(totals?.total_calls),
    total_input_tokens: Number(totals?.total_input ?? 0),
    total_output_tokens: Number(totals?.total_output ?? 0),
    total_cost_usd: Number(totals?.total_cost ?? 0),
    by_model: byModelResult.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      calls: parseDbInteger(row.calls),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
    })),
    by_day: byDayResult.rows.map((row) => ({
      date: toIso(row.day).slice(0, 10),
      cost_usd: Number(row.cost_usd),
      calls: parseDbInteger(row.calls),
    })),
  }
}

export async function getAdminAiCostModelDetail(
  provider: string,
  model: string,
  periodDays = 30
): Promise<AdminAiCostModelDetail> {
  await ensureDbReady()

  const safeProvider = provider.trim()
  const safeModel = model.trim()
  const safeDays = Number.isFinite(periodDays) ? Math.min(90, Math.max(1, Math.trunc(periodDays))) : 30

  const [totalsResult, byUseTypeResult, bySourceTypeResult, recentCallsResult] = await Promise.all([
    pool.query<DbAiCostTotalsRow>(
      `
        SELECT
          COUNT(*)::int AS total_calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output,
          COALESCE(SUM(cost_usd), 0) AS total_cost
        FROM ai_usage_log
        WHERE provider = $1
          AND model = $2
          AND created_at >= NOW() - ($3::int * INTERVAL '1 day')
      `,
      [safeProvider, safeModel, safeDays]
    ),
    pool.query<DbAiCostByUseTypeRow>(
      `
        SELECT
          use_type,
          COUNT(*)::int AS calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE provider = $1
          AND model = $2
          AND created_at >= NOW() - ($3::int * INTERVAL '1 day')
        GROUP BY use_type
        ORDER BY SUM(cost_usd) DESC, use_type ASC
      `,
      [safeProvider, safeModel, safeDays]
    ),
    pool.query<DbAiCostBySourceTypeRow>(
      `
        SELECT
          COALESCE(source_type, 'unknown') AS source_type,
          COUNT(*)::int AS calls,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE provider = $1
          AND model = $2
          AND created_at >= NOW() - ($3::int * INTERVAL '1 day')
        GROUP BY COALESCE(source_type, 'unknown')
        ORDER BY SUM(cost_usd) DESC, COALESCE(source_type, 'unknown') ASC
      `,
      [safeProvider, safeModel, safeDays]
    ),
    pool.query<DbAiCostRecentCallRow>(
      `
        SELECT
          l.id,
          l.created_at,
          l.use_type,
          l.source_type,
          l.user_id,
          u.email AS user_email,
          l.extraction_id,
          l.input_tokens,
          l.output_tokens,
          l.cost_usd
        FROM ai_usage_log l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.provider = $1
          AND l.model = $2
          AND l.created_at >= NOW() - ($3::int * INTERVAL '1 day')
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT 25
      `,
      [safeProvider, safeModel, safeDays]
    ),
  ])

  const totals = totalsResult.rows[0]
  return {
    period_days: safeDays,
    provider: safeProvider,
    model: safeModel,
    total_calls: parseDbInteger(totals?.total_calls),
    total_input_tokens: Number(totals?.total_input ?? 0),
    total_output_tokens: Number(totals?.total_output ?? 0),
    total_cost_usd: Number(totals?.total_cost ?? 0),
    by_use_type: byUseTypeResult.rows.map((row) => ({
      use_type: row.use_type,
      calls: parseDbInteger(row.calls),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
    })),
    by_source_type: bySourceTypeResult.rows.map((row) => ({
      source_type: row.source_type ?? 'unknown',
      calls: parseDbInteger(row.calls),
      cost_usd: Number(row.cost_usd),
    })),
    recent_calls: recentCallsResult.rows.map((row) => ({
      id: row.id,
      created_at: toIso(row.created_at),
      use_type: row.use_type,
      source_type: row.source_type ?? null,
      user_id: row.user_id ?? null,
      user_email: row.user_email ?? null,
      extraction_id: row.extraction_id ?? null,
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
    })),
  }
}

export async function getExtractionCostBreakdown(extractionId: string): Promise<ExtractionCostBreakdown> {
  await ensureDbReady()

  const [totalsResult, byUseTypeResult] = await Promise.all([
    pool.query<{
      total_calls: number | string
      total_input_tokens: number | string
      total_output_tokens: number | string
      total_cost_usd: string | number
    }>(
      `
        SELECT
          COUNT(*)::int AS total_calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output_tokens,
          COALESCE(SUM(cost_usd), 0) AS total_cost_usd
        FROM ai_usage_log
        WHERE extraction_id = $1
      `,
      [extractionId]
    ),
    pool.query<{
      use_type: string
      calls: number | string
      input_tokens: number | string
      output_tokens: number | string
      cost_usd: string | number
    }>(
      `
        SELECT
          use_type,
          COUNT(*)::int AS calls,
          COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
          COALESCE(SUM(cost_usd), 0) AS cost_usd
        FROM ai_usage_log
        WHERE extraction_id = $1
        GROUP BY use_type
        ORDER BY SUM(cost_usd) DESC, use_type ASC
      `,
      [extractionId]
    ),
  ])

  const totals = totalsResult.rows[0]
  return {
    extraction_id: extractionId,
    total_calls: parseDbInteger(totals?.total_calls),
    total_input_tokens: Number(totals?.total_input_tokens ?? 0),
    total_output_tokens: Number(totals?.total_output_tokens ?? 0),
    total_cost_usd: Number(totals?.total_cost_usd ?? 0),
    by_use_type: byUseTypeResult.rows.map((row) => ({
      use_type: row.use_type,
      calls: parseDbInteger(row.calls),
      input_tokens: Number(row.input_tokens ?? 0),
      output_tokens: Number(row.output_tokens ?? 0),
      cost_usd: Number(row.cost_usd ?? 0),
    })),
  }
}

export async function adminGetCreditStats(): Promise<AdminCreditStats> {
  await ensureDbReady()
  const [circulation, purchases, recent] = await Promise.all([
    pool.query<{ total: string | number; users: string | number }>(
      `SELECT COALESCE(SUM(extra_credits), 0) AS total, COUNT(*) FILTER (WHERE extra_credits > 0) AS users
       FROM user_plans WHERE status = 'active'`
    ),
    pool.query<{ total: string | number; credits: string | number }>(
      `SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS credits
       FROM credit_transactions WHERE reason = 'purchase'`
    ),
    pool.query<{ total: string | number; credits: string | number }>(
      `SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS credits
       FROM credit_transactions WHERE reason = 'purchase' AND created_at > NOW() - INTERVAL '30 days'`
    ),
  ])
  return {
    total_credits_in_circulation: parseDbInteger(circulation.rows[0]?.total ?? 0),
    users_with_credits: parseDbInteger(circulation.rows[0]?.users ?? 0),
    total_purchases_alltime: parseDbInteger(purchases.rows[0]?.total ?? 0),
    total_purchases_30d: parseDbInteger(recent.rows[0]?.total ?? 0),
    credits_purchased_30d: parseDbInteger(recent.rows[0]?.credits ?? 0),
  }
}

export async function adminListUsersWithCredits(limit = 100): Promise<AdminUserCreditRow[]> {
  await ensureDbReady()
  const { rows } = await pool.query<{
    user_id: string
    user_name: string
    user_email: string
    extra_credits: string | number
    plan: string
    total_purchased: string | number
    last_purchase_at: Date | string | null
  }>(
    `SELECT up.user_id,
            u.name  AS user_name,
            u.email AS user_email,
            up.extra_credits,
            up.plan,
            COALESCE(tx.total_purchased, 0) AS total_purchased,
            tx.last_purchase_at
     FROM user_plans up
     JOIN users u ON u.id = up.user_id
     LEFT JOIN (
       SELECT user_id,
              SUM(amount) AS total_purchased,
              MAX(created_at) AS last_purchase_at
       FROM credit_transactions
       WHERE reason = 'purchase'
       GROUP BY user_id
     ) tx ON tx.user_id = up.user_id
     WHERE up.status = 'active'
       AND (up.extra_credits > 0 OR tx.total_purchased IS NOT NULL)
     ORDER BY up.extra_credits DESC, tx.last_purchase_at DESC NULLS LAST
     LIMIT $1`,
    [limit]
  )
  return rows.map((row) => ({
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    extra_credits: parseDbInteger(row.extra_credits),
    plan: row.plan,
    total_purchased: parseDbInteger(row.total_purchased),
    last_purchase_at: row.last_purchase_at ? toIso(row.last_purchase_at) : null,
  }))
}

export async function adminListRecentCreditTransactions(limit = 50): Promise<AdminRecentTransaction[]> {
  await ensureDbReady()
  const { rows } = await pool.query<{
    id: string
    user_id: string
    user_name: string
    user_email: string
    amount: string | number
    reason: string
    stripe_session_id: string | null
    created_at: Date | string
  }>(
    `SELECT ct.id, ct.user_id, u.name AS user_name, u.email AS user_email,
            ct.amount, ct.reason, ct.stripe_session_id, ct.created_at
     FROM credit_transactions ct
     JOIN users u ON u.id = ct.user_id
     ORDER BY ct.created_at DESC
     LIMIT $1`,
    [limit]
  )
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    amount: parseDbInteger(row.amount),
    reason: row.reason,
    stripe_session_id: row.stripe_session_id ?? null,
    created_at: toIso(row.created_at),
  }))
}

export async function adminGetUserCreditDetail(userId: string): Promise<{
  balance: number
  daily_used: number
  daily_limit: number
  transactions: DbCreditTransaction[]
}> {
  await ensureDbReady()
  const [snapshot, txRows] = await Promise.all([
    getDailyExtractionSnapshot(userId),
    pool.query<DbCreditTransactionRow>(
      `SELECT id, user_id, amount, reason, stripe_session_id, created_at
       FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    ),
  ])
  return {
    balance: snapshot.extra_credits,
    daily_used: snapshot.used,
    daily_limit: snapshot.limit,
    transactions: txRows.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      amount: parseDbInteger(row.amount),
      reason: row.reason,
      stripe_session_id: row.stripe_session_id ?? null,
      created_at: toIso(row.created_at),
    })),
  }
}

export async function getUserChatTokenLimit(userId: string): Promise<number> {
  await ensureDbReady()
  const { rows } = await pool.query<{ chat_tokens_per_day: string | number | null }>(
    `SELECT p.chat_tokens_per_day
     FROM user_plans up
     JOIN plans p ON p.name = up.plan
     WHERE up.user_id = $1 AND up.status = 'active'
     ORDER BY up.created_at DESC
     LIMIT 1`,
    [userId]
  )
  return parseDbInteger(rows[0]?.chat_tokens_per_day ?? 10000)
}

export async function getChatTokenSnapshot(userId: string): Promise<{
  limit: number
  used: number
  remaining: number
  reset_at: string
  allowed: boolean
}> {
  await ensureDbReady()
  const limit = await getUserChatTokenLimit(userId)
  const { rows } = await pool.query<{ tokens_used: string | number }>(
    `SELECT tokens_used FROM daily_chat_token_counts WHERE user_id = $1 AND date = CURRENT_DATE`,
    [userId]
  )
  const used = parseDbInteger(rows[0]?.tokens_used ?? 0)
  const remaining = Math.max(0, limit - used)
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return {
    limit,
    used,
    remaining,
    reset_at: tomorrow.toISOString(),
    allowed: used < limit,
  }
}

export async function consumeChatTokens(
  userId: string,
  tokens: number
): Promise<{ allowed: boolean; snapshot: { limit: number; used: number; remaining: number } }> {
  await ensureDbReady()
  const limit = await getUserChatTokenLimit(userId)
  const { rows } = await pool.query<{ tokens_used: string | number }>(
    `INSERT INTO daily_chat_token_counts (user_id, date, tokens_used)
     VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (user_id, date) DO UPDATE
       SET tokens_used = daily_chat_token_counts.tokens_used + EXCLUDED.tokens_used,
           updated_at = NOW()
     RETURNING tokens_used`,
    [userId, tokens]
  )
  const used = parseDbInteger(rows[0]?.tokens_used ?? tokens)
  const remaining = Math.max(0, limit - used)
  return {
    allowed: used <= limit,
    snapshot: { limit, used, remaining },
  }
}

export async function adminGetChatTokenStats(): Promise<
  Array<{ user_id: string; email: string; tokens_used: number; limit: number; date: string }>
> {
  await ensureDbReady()
  const { rows } = await pool.query<{
    user_id: string
    email: string
    tokens_used: string | number
    limit: string | number
    date: string | Date
  }>(
    `SELECT d.user_id, u.email,
            d.tokens_used,
            COALESCE(
              (SELECT p.chat_tokens_per_day
               FROM user_plans up
               JOIN plans p ON p.name = up.plan
               WHERE up.user_id = d.user_id AND up.status = 'active'
               ORDER BY up.created_at DESC LIMIT 1),
              10000
            ) AS limit,
            d.date::text
     FROM daily_chat_token_counts d
     JOIN users u ON u.id = d.user_id
     WHERE d.date = CURRENT_DATE
     ORDER BY d.tokens_used DESC
     LIMIT 50`
  )
  return rows.map((row) => ({
    user_id: row.user_id,
    email: row.email,
    tokens_used: parseDbInteger(row.tokens_used),
    limit: parseDbInteger(row.limit),
    date: typeof row.date === 'string' ? row.date : row.date.toISOString().slice(0, 10),
  }))
}

export async function getAdminUserProfitability(
  userId: string,
  periodDays = 30
): Promise<AdminUserProfitabilitySnapshot | null> {
  await ensureDbReady()
  const safeDays = Number.isFinite(periodDays) ? Math.min(90, Math.max(1, Math.trunc(periodDays))) : 30
  const storageCostUsdPerByteMonth = getEstimatedStorageCostUsdPerByteMonth()

  const [assumptions, userPlanRows, usageRows, extractionRows] = await Promise.all([
    getBusinessAssumptions(),
    listProfitabilityUserPlanRows(),
    listProfitabilityUsageRows(safeDays),
    listProfitabilityExtractionCountRows(safeDays),
  ])

  const planRow = userPlanRows.find((row) => row.user_id === userId)
  if (!planRow) return null
  const totalActiveUsers = userPlanRows.length
  const totalActivePaidUsers = userPlanRows.filter((row) => Number(row.price_monthly_usd ?? 0) > 0).length
  const sharedFixedCostUsd = getTotalSharedFixedCostUsd(assumptions)

  const usage = usageRows.filter((row) => row.user_id === userId)
  const aiCostPeriodUsd = usage.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0)
  const extractionRelatedCostPeriodUsd = usage
    .filter((row) => ['extraction', 'repair', 'transcription'].includes(row.use_type))
    .reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0)
  const chatUsage = usage.filter((row) => row.use_type === 'chat')
  const chatCostPeriodUsd = chatUsage.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0)
  const chatTokensPeriod = chatUsage.reduce(
    (sum, row) => sum + Number(row.input_tokens ?? 0) + Number(row.output_tokens ?? 0),
    0
  )
  const extractionCount = extractionRows.find((row) => row.user_id === userId)
  const extractionsPeriod = parseDbInteger(extractionCount?.extractions ?? 0)
  const storageUsedBytes = Number(planRow.used_bytes ?? 0)
  const storageCostMonthlyUsd = storageUsedBytes * storageCostUsdPerByteMonth
  const priceMonthlyUsd = Number(planRow.price_monthly_usd ?? 0)
  const sharedFixedAllocation = calculateSharedFixedCostAllocationPerUser({
    sharedFixedCostUsd,
    totalActiveUsers,
    totalActivePaidUsers,
    planPriceMonthlyUsd: priceMonthlyUsd,
  })
  const paymentFeeMonthlyUsd = calculatePaymentFeeMonthlyUsd({
    priceMonthlyUsd,
    paymentFeePct: assumptions.paymentFeePct,
    paymentFeeFixedUsd: assumptions.paymentFeeFixedUsd,
  })
  const aiCostMonthlyRunRateUsd = calculateMonthlyRunRate(aiCostPeriodUsd, safeDays)
  const monthlyVariableCostRunRateUsd = aiCostMonthlyRunRateUsd + storageCostMonthlyUsd
  const estimatedMonthlyFixedCostUsd = Number(planRow.estimated_monthly_fixed_cost_usd ?? 0)
  const monthlyTotalCostRunRateUsd =
    monthlyVariableCostRunRateUsd +
    estimatedMonthlyFixedCostUsd +
    sharedFixedAllocation.allocatedCostPerUserUsd +
    paymentFeeMonthlyUsd
  const targetGrossMarginPct = normalizeMarginPct(
    Number(planRow.target_gross_margin_pct ?? assumptions.targetGrossMarginPct),
    assumptions.targetGrossMarginPct
  )
  const maxVariableCostAllowedUsd = Math.max(
    0,
    calculateMaxVariableCostAllowed(priceMonthlyUsd, targetGrossMarginPct) -
      estimatedMonthlyFixedCostUsd -
      sharedFixedAllocation.allocatedCostPerUserUsd -
      paymentFeeMonthlyUsd
  )
  const actualGrossMarginPct = calculateGrossMarginPct(priceMonthlyUsd, monthlyTotalCostRunRateUsd)
  const status = classifyProfitabilityStatus({
    actualMarginPct: actualGrossMarginPct,
    projectedMarginPct: actualGrossMarginPct,
    targetGrossMarginPct,
  })

  return {
    user_id: userId,
    plan_name: planRow.plan_name,
    plan_display_name: planRow.plan_display_name,
    period_days: safeDays,
    price_monthly_usd: priceMonthlyUsd,
    target_gross_margin_pct: targetGrossMarginPct,
    profitability_alert_enabled: planRow.profitability_alert_enabled !== false,
    estimated_monthly_fixed_cost_usd: estimatedMonthlyFixedCostUsd,
    ai_cost_period_usd: aiCostPeriodUsd,
    ai_cost_monthly_run_rate_usd: aiCostMonthlyRunRateUsd,
    extraction_related_cost_period_usd: extractionRelatedCostPeriodUsd,
    chat_cost_period_usd: chatCostPeriodUsd,
    chat_tokens_period: chatTokensPeriod,
    extractions_period: extractionsPeriod,
    storage_used_bytes: storageUsedBytes,
    storage_cost_monthly_usd: storageCostMonthlyUsd,
    allocated_shared_fixed_cost_usd: sharedFixedAllocation.allocatedCostPerUserUsd,
    shared_cost_allocation_strategy: sharedFixedAllocation.strategy,
    payment_fee_monthly_usd: paymentFeeMonthlyUsd,
    monthly_variable_cost_run_rate_usd: monthlyVariableCostRunRateUsd,
    monthly_total_cost_run_rate_usd: monthlyTotalCostRunRateUsd,
    max_variable_cost_allowed_usd: maxVariableCostAllowedUsd,
    actual_gross_margin_pct: actualGrossMarginPct,
    status,
  }
}

export async function getAdminPlanProfitabilityStats(
  periodDays = 30
): Promise<{ period_days: number; plans: AdminPlanProfitabilityStat[] }> {
  await ensureDbReady()
  const safeDays = Number.isFinite(periodDays) ? Math.min(90, Math.max(1, Math.trunc(periodDays))) : 30
  const storageCostUsdPerByteMonth = getEstimatedStorageCostUsdPerByteMonth()

  const [assumptions, plans, userPlanRows, usageRows, extractionRows] = await Promise.all([
    getBusinessAssumptions(),
    listPlans(),
    listProfitabilityUserPlanRows(),
    listProfitabilityUsageRows(safeDays),
    listProfitabilityExtractionCountRows(safeDays),
  ])
  const totalActiveUsers = userPlanRows.length
  const totalActivePaidUsers = userPlanRows.filter((row) => Number(row.price_monthly_usd ?? 0) > 0).length
  const sharedFixedCostUsd = getTotalSharedFixedCostUsd(assumptions)

  const usageByUser = new Map<
    string,
    {
      totalCostPeriodUsd: number
      extractionRelatedCostPeriodUsd: number
      chatCostPeriodUsd: number
      chatTokensPeriod: number
    }
  >()

  for (const row of usageRows) {
    const current = usageByUser.get(row.user_id) ?? {
      totalCostPeriodUsd: 0,
      extractionRelatedCostPeriodUsd: 0,
      chatCostPeriodUsd: 0,
      chatTokensPeriod: 0,
    }
    const rowCost = Number(row.cost_usd ?? 0)
    current.totalCostPeriodUsd += rowCost
    if (['extraction', 'repair', 'transcription'].includes(row.use_type)) {
      current.extractionRelatedCostPeriodUsd += rowCost
    }
    if (row.use_type === 'chat') {
      current.chatCostPeriodUsd += rowCost
      current.chatTokensPeriod += Number(row.input_tokens ?? 0) + Number(row.output_tokens ?? 0)
    }
    usageByUser.set(row.user_id, current)
  }

  const extractionCountByUser = new Map<string, number>(
    extractionRows.map((row) => [row.user_id, parseDbInteger(row.extractions)])
  )

  const planUsers = new Map<
    string,
    Array<{
      userId: string
      totalMonthlyCostUsd: number
      monthlyAiCostUsd: number
      monthlyStorageCostUsd: number
      storageUsedBytes: number
      extractionRelatedCostPeriodUsd: number
      chatCostPeriodUsd: number
      chatTokensPeriod: number
      extractionCountPeriod: number
    }>
  >()

  for (const row of userPlanRows) {
    const usage = usageByUser.get(row.user_id)
    const aiCostPeriodUsd = usage?.totalCostPeriodUsd ?? 0
    const monthlyAiCostUsd = calculateMonthlyRunRate(aiCostPeriodUsd, safeDays)
    const priceMonthlyUsd = Number(row.price_monthly_usd ?? 0)
    const storageUsedBytes = Number(row.used_bytes ?? 0)
    const monthlyStorageCostUsd = storageUsedBytes * storageCostUsdPerByteMonth
    const sharedFixedAllocation = calculateSharedFixedCostAllocationPerUser({
      sharedFixedCostUsd,
      totalActiveUsers,
      totalActivePaidUsers,
      planPriceMonthlyUsd: priceMonthlyUsd,
    })
    const paymentFeeMonthlyUsd = calculatePaymentFeeMonthlyUsd({
      priceMonthlyUsd,
      paymentFeePct: assumptions.paymentFeePct,
      paymentFeeFixedUsd: assumptions.paymentFeeFixedUsd,
    })
    const totalMonthlyCostUsd =
      monthlyAiCostUsd +
      monthlyStorageCostUsd +
      Number(row.estimated_monthly_fixed_cost_usd ?? 0) +
      sharedFixedAllocation.allocatedCostPerUserUsd +
      paymentFeeMonthlyUsd

    const bucket = planUsers.get(row.plan_name) ?? []
    bucket.push({
      userId: row.user_id,
      totalMonthlyCostUsd,
      monthlyAiCostUsd,
      monthlyStorageCostUsd,
      storageUsedBytes,
      extractionRelatedCostPeriodUsd: usage?.extractionRelatedCostPeriodUsd ?? 0,
      chatCostPeriodUsd: usage?.chatCostPeriodUsd ?? 0,
      chatTokensPeriod: usage?.chatTokensPeriod ?? 0,
      extractionCountPeriod: extractionCountByUser.get(row.user_id) ?? 0,
    })
    planUsers.set(row.plan_name, bucket)
  }

  const stats = plans.map((plan) => {
    const users = planUsers.get(plan.name) ?? []
    const activeUsers = users.length
    const sharedFixedAllocation = calculateSharedFixedCostAllocationPerUser({
      sharedFixedCostUsd,
      totalActiveUsers,
      totalActivePaidUsers,
      planPriceMonthlyUsd: plan.price_monthly_usd,
    })
    const paymentFeeMonthlyUsd = calculatePaymentFeeMonthlyUsd({
      priceMonthlyUsd: plan.price_monthly_usd,
      paymentFeePct: assumptions.paymentFeePct,
      paymentFeeFixedUsd: assumptions.paymentFeeFixedUsd,
    })
    const totalMonthlyRunRateCostUsd = users.reduce((sum, user) => sum + user.totalMonthlyCostUsd, 0)
    const avgMonthlyAiCostPerUserUsd = activeUsers > 0
      ? users.reduce((sum, user) => sum + user.monthlyAiCostUsd, 0) / activeUsers
      : 0
    const avgMonthlyStorageCostPerUserUsd = activeUsers > 0
      ? users.reduce((sum, user) => sum + user.monthlyStorageCostUsd, 0) / activeUsers
      : 0
    const avgMonthlyVariableCostPerUserUsd = avgMonthlyAiCostPerUserUsd + avgMonthlyStorageCostPerUserUsd
    const avgMonthlyTotalCostPerUserUsd = activeUsers > 0 ? totalMonthlyRunRateCostUsd / activeUsers : 0
    const sortedMonthlyCosts = users
      .map((user) => user.totalMonthlyCostUsd)
      .sort((a, b) => a - b)
    const p95MonthlyTotalCostPerUserUsd = percentileFromSorted(sortedMonthlyCosts, 95)
    const avgStorageUsedBytes = activeUsers > 0
      ? users.reduce((sum, user) => sum + user.storageUsedBytes, 0) / activeUsers
      : 0
    const p95StorageUsedBytes = percentileFromSorted(
      users.map((user) => user.storageUsedBytes).sort((a, b) => a - b),
      95
    )
    const extractionRelatedCostPeriodUsd = users.reduce(
      (sum, user) => sum + user.extractionRelatedCostPeriodUsd,
      0
    )
    const extractionCountPeriod = users.reduce((sum, user) => sum + user.extractionCountPeriod, 0)
    const chatCostPeriodUsd = users.reduce((sum, user) => sum + user.chatCostPeriodUsd, 0)
    const chatTokensPeriod = users.reduce((sum, user) => sum + user.chatTokensPeriod, 0)
    const avgExtractionCostUsd =
      extractionCountPeriod > 0 ? extractionRelatedCostPeriodUsd / extractionCountPeriod : 0
    const avgChatCostPerTokenUsd = chatTokensPeriod > 0 ? chatCostPeriodUsd / chatTokensPeriod : 0
    const currentStorageCapCostUsd = plan.storage_limit_bytes * storageCostUsdPerByteMonth
    const maxVariableCostAllowedUsd = Math.max(
      0,
      calculateMaxVariableCostAllowed(plan.price_monthly_usd, plan.target_gross_margin_pct) -
        plan.estimated_monthly_fixed_cost_usd -
        sharedFixedAllocation.allocatedCostPerUserUsd -
        paymentFeeMonthlyUsd
    )
    const projectedCostAtCurrentCaps = calculateProjectedPlanCapCost({
      extractionsPerDay: plan.extractions_per_day,
      avgExtractionCostUsd,
      chatTokensPerDay: plan.chat_tokens_per_day,
      avgChatCostPerTokenUsd,
      storageCapCostUsd: currentStorageCapCostUsd,
    })
    const projectedTotalCostUsd =
      projectedCostAtCurrentCaps.totalCostUsd +
      plan.estimated_monthly_fixed_cost_usd +
      sharedFixedAllocation.allocatedCostPerUserUsd +
      paymentFeeMonthlyUsd
    const actualGrossMarginPct = calculateGrossMarginPct(
      plan.price_monthly_usd,
      avgMonthlyTotalCostPerUserUsd
    )
    const projectedGrossMarginPct = calculateGrossMarginPct(plan.price_monthly_usd, projectedTotalCostUsd)
    const p95GrossMarginPct = calculateGrossMarginPct(plan.price_monthly_usd, p95MonthlyTotalCostPerUserUsd)
    const recommendedExtractionsPerDay = calculateRecommendedExtractionsPerDay({
      maxVariableCostAllowedUsd,
      avgExtractionCostUsd,
      currentChatCapCostUsd: projectedCostAtCurrentCaps.chatCapCostUsd,
      currentStorageCostUsd: currentStorageCapCostUsd,
    })
    const recommendedChatTokensPerDay = calculateRecommendedChatTokensPerDay({
      maxVariableCostAllowedUsd,
      avgChatCostPerTokenUsd,
      currentExtractionCapCostUsd: projectedCostAtCurrentCaps.extractionCapCostUsd,
      currentStorageCostUsd: currentStorageCapCostUsd,
    })
    const recommendedStorageLimitBytes = calculateRecommendedStorageLimitBytes({
      currentStorageLimitBytes: plan.storage_limit_bytes,
      avgStorageUsedBytes,
      p95StorageUsedBytes,
    })
    const extractionRatio =
      activeUsers > 0 && plan.extractions_per_day > 0
        ? extractionCountPeriod / activeUsers / safeDays / plan.extractions_per_day
        : 0
    const chatRatio =
      activeUsers > 0 && plan.chat_tokens_per_day > 0
        ? chatTokensPeriod / activeUsers / safeDays / plan.chat_tokens_per_day
        : 0
    const storageRatio = plan.storage_limit_bytes > 0 ? avgStorageUsedBytes / plan.storage_limit_bytes : 0
    const upgradePressureScore = calculateUpgradePressureScore({
      extractionRatio,
      chatRatio,
      storageRatio,
    })
    const unprofitableUsers = users.filter((user) => user.totalMonthlyCostUsd > plan.price_monthly_usd).length
    const atRiskUsers = users.filter((user) => {
      const margin = calculateGrossMarginPct(plan.price_monthly_usd, user.totalMonthlyCostUsd)
      return (margin ?? 1) < plan.target_gross_margin_pct
    }).length
    const status = classifyProfitabilityStatus({
      actualMarginPct: actualGrossMarginPct,
      projectedMarginPct: projectedGrossMarginPct,
      targetGrossMarginPct: plan.target_gross_margin_pct,
    })
    const scenarioRecommendation = deriveScenarioRecommendation({
      planName: plan.name,
      targetGrossMarginPct: plan.target_gross_margin_pct,
      actualMarginPct: actualGrossMarginPct,
      projectedMarginPct: projectedGrossMarginPct,
      p95MarginPct: p95GrossMarginPct,
      currentExtractionsPerDay: plan.extractions_per_day,
      recommendedExtractionsPerDay,
      currentChatTokensPerDay: plan.chat_tokens_per_day,
      recommendedChatTokensPerDay,
      currentStorageLimitBytes: plan.storage_limit_bytes,
      recommendedStorageLimitBytes,
      upgradePressureScore,
      unprofitableUsers,
      activeUsers,
    })

    return {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_display_name: plan.display_name,
      period_days: safeDays,
      active_users: activeUsers,
      price_monthly_usd: plan.price_monthly_usd,
      target_gross_margin_pct: plan.target_gross_margin_pct,
      profitability_alert_enabled: plan.profitability_alert_enabled,
      estimated_monthly_fixed_cost_usd: plan.estimated_monthly_fixed_cost_usd,
      allocated_shared_fixed_cost_per_user_usd: sharedFixedAllocation.allocatedCostPerUserUsd,
      shared_cost_allocation_strategy: sharedFixedAllocation.strategy,
      payment_fee_monthly_usd: paymentFeeMonthlyUsd,
      avg_monthly_ai_cost_per_user_usd: avgMonthlyAiCostPerUserUsd,
      avg_monthly_storage_cost_per_user_usd: avgMonthlyStorageCostPerUserUsd,
      avg_monthly_variable_cost_per_user_usd: avgMonthlyVariableCostPerUserUsd,
      avg_monthly_total_cost_per_user_usd: avgMonthlyTotalCostPerUserUsd,
      p95_monthly_total_cost_per_user_usd: p95MonthlyTotalCostPerUserUsd,
      total_monthly_run_rate_cost_usd: totalMonthlyRunRateCostUsd,
      actual_gross_margin_pct: actualGrossMarginPct,
      p95_gross_margin_pct: p95GrossMarginPct,
      avg_extraction_cost_usd: avgExtractionCostUsd,
      avg_chat_cost_per_token_usd: avgChatCostPerTokenUsd,
      avg_storage_used_bytes: avgStorageUsedBytes,
      p95_storage_used_bytes: p95StorageUsedBytes,
      recommended_storage_limit_bytes: recommendedStorageLimitBytes,
      projected_cost_at_current_caps_usd: projectedTotalCostUsd,
      projected_gross_margin_pct: projectedGrossMarginPct,
      recommended_extractions_per_day: recommendedExtractionsPerDay,
      recommended_chat_tokens_per_day: recommendedChatTokensPerDay,
      upgrade_pressure_score: upgradePressureScore,
      scenario_recommendation: scenarioRecommendation.recommendation,
      scenario_reason: scenarioRecommendation.reason,
      current_extractions_per_day: plan.extractions_per_day,
      current_chat_tokens_per_day: plan.chat_tokens_per_day,
      storage_limit_bytes: plan.storage_limit_bytes,
      unprofitable_users: unprofitableUsers,
      at_risk_users: atRiskUsers,
      status,
    } satisfies AdminPlanProfitabilityStat
  })

  return {
    period_days: safeDays,
    plans: stats,
  }
}

export async function getAdminPlanProfitabilityScenarios(
  periodDays = 30
): Promise<{ period_days: number; assumptions: BusinessAssumptions; scenarios: AdminPlanScenarioSnapshot[] }> {
  const safeDays = Number.isFinite(periodDays) ? Math.min(90, Math.max(1, Math.trunc(periodDays))) : 30
  const storageCostUsdPerByteMonth = getEstimatedStorageCostUsdPerByteMonth()
  const [assumptions, profitability] = await Promise.all([
    getBusinessAssumptions(),
    getAdminPlanProfitabilityStats(safeDays),
  ])

  const scenarios = profitability.plans.flatMap((stat) => [
    buildPlanScenarioSnapshot({
      stat,
      preset: 'conservative',
      assumptions,
      storageCostUsdPerByteMonth,
    }),
    buildPlanScenarioSnapshot({
      stat,
      preset: 'recommended',
      assumptions,
      storageCostUsdPerByteMonth,
    }),
  ])

  return {
    period_days: profitability.period_days,
    assumptions,
    scenarios,
  }
}

export async function getAdminInvestorMetricsPack(
  periodDays = 30
): Promise<AdminInvestorMetricsPack> {
  const safeDays = Number.isFinite(periodDays) ? Math.min(90, Math.max(1, Math.trunc(periodDays))) : 30
  const storageCostUsdPerByteMonth = getEstimatedStorageCostUsdPerByteMonth()
  const [assumptions, profitability] = await Promise.all([
    getBusinessAssumptions(),
    getAdminPlanProfitabilityStats(safeDays),
  ])

  const scenarios = profitability.plans.flatMap((stat) => [
    buildPlanScenarioSnapshot({
      stat,
      preset: 'conservative',
      assumptions,
      storageCostUsdPerByteMonth,
    }),
    buildPlanScenarioSnapshot({
      stat,
      preset: 'recommended',
      assumptions,
      storageCostUsdPerByteMonth,
    }),
  ])

  const plans = profitability.plans
    .map((stat) => {
      const monthlyRevenueRunRateUsd = stat.active_users * stat.price_monthly_usd
      const monthlyCostRunRateUsd = stat.total_monthly_run_rate_cost_usd
      const monthlyProjectedCostAtCapsUsd = stat.projected_cost_at_current_caps_usd * stat.active_users

      return {
        plan_id: stat.plan_id,
        plan_name: stat.plan_name,
        plan_display_name: stat.plan_display_name,
        active_users: stat.active_users,
        price_monthly_usd: stat.price_monthly_usd,
        monthly_revenue_run_rate_usd: monthlyRevenueRunRateUsd,
        monthly_cost_run_rate_usd: monthlyCostRunRateUsd,
        monthly_projected_cost_at_caps_usd: monthlyProjectedCostAtCapsUsd,
        actual_gross_margin_pct: calculateGrossMarginPct(monthlyRevenueRunRateUsd, monthlyCostRunRateUsd),
        projected_gross_margin_pct: calculateGrossMarginPct(
          monthlyRevenueRunRateUsd,
          monthlyProjectedCostAtCapsUsd
        ),
        share_of_mrr_pct: 0,
        share_of_cost_pct: 0,
        unprofitable_users: stat.unprofitable_users,
        at_risk_users: stat.at_risk_users,
        upgrade_pressure_score: stat.upgrade_pressure_score,
        recommended_extractions_per_day: stat.recommended_extractions_per_day,
        recommended_chat_tokens_per_day: stat.recommended_chat_tokens_per_day,
        recommended_storage_limit_bytes: stat.recommended_storage_limit_bytes,
        scenario_recommendation: stat.scenario_recommendation,
        scenario_reason: stat.scenario_reason,
      } satisfies AdminInvestorPlanSnapshot
    })
    .sort((a, b) => b.monthly_revenue_run_rate_usd - a.monthly_revenue_run_rate_usd)

  const mrrRunRateUsd = plans.reduce((sum, plan) => sum + plan.monthly_revenue_run_rate_usd, 0)
  const monthlyCostRunRateUsd = plans.reduce((sum, plan) => sum + plan.monthly_cost_run_rate_usd, 0)

  for (const plan of plans) {
    plan.share_of_mrr_pct = mrrRunRateUsd > 0 ? plan.monthly_revenue_run_rate_usd / mrrRunRateUsd : 0
    plan.share_of_cost_pct = monthlyCostRunRateUsd > 0 ? plan.monthly_cost_run_rate_usd / monthlyCostRunRateUsd : 0
  }

  const activeUsers = profitability.plans.reduce((sum, plan) => sum + plan.active_users, 0)
  const activePaidUsers = profitability.plans
    .filter((plan) => plan.price_monthly_usd > 0)
    .reduce((sum, plan) => sum + plan.active_users, 0)
  const freeUsers = activeUsers - activePaidUsers
  const arrRunRateUsd = mrrRunRateUsd * 12
  const monthlyProjectedCostAtCapsUsd = profitability.plans.reduce(
    (sum, plan) => sum + plan.projected_cost_at_current_caps_usd * plan.active_users,
    0
  )
  const atRiskUsers = profitability.plans.reduce((sum, plan) => sum + plan.at_risk_users, 0)
  const unprofitableUsers = profitability.plans.reduce((sum, plan) => sum + plan.unprofitable_users, 0)
  const impliedCustomerLifetimeMonths = assumptions.assumedMonthlyChurnPct > 0
    ? 1 / assumptions.assumedMonthlyChurnPct
    : null

  const totalAiCostUsd = profitability.plans.reduce(
    (sum, plan) => sum + plan.avg_monthly_ai_cost_per_user_usd * plan.active_users,
    0
  )
  const totalStorageCostUsd = profitability.plans.reduce(
    (sum, plan) => sum + plan.avg_monthly_storage_cost_per_user_usd * plan.active_users,
    0
  )
  const totalPaymentFeesUsd = profitability.plans.reduce(
    (sum, plan) => sum + plan.payment_fee_monthly_usd * plan.active_users,
    0
  )
  const totalPlanFixedCostUsd = profitability.plans.reduce(
    (sum, plan) => sum + plan.estimated_monthly_fixed_cost_usd * plan.active_users,
    0
  )
  const totalSharedFixedCostUsd = profitability.plans.reduce(
    (sum, plan) => sum + plan.allocated_shared_fixed_cost_per_user_usd * plan.active_users,
    0
  )

  const baseCostDrivers = [
    {
      key: 'ai',
      label: 'AI',
      monthly_cost_usd: totalAiCostUsd,
      share_of_total_cost_pct: 0,
    },
    {
      key: 'storage',
      label: 'Storage',
      monthly_cost_usd: totalStorageCostUsd,
      share_of_total_cost_pct: 0,
    },
    {
      key: 'payment_fees',
      label: 'Payment fees',
      monthly_cost_usd: totalPaymentFeesUsd,
      share_of_total_cost_pct: 0,
    },
    {
      key: 'plan_fixed',
      label: 'Fixed by plan',
      monthly_cost_usd: totalPlanFixedCostUsd,
      share_of_total_cost_pct: 0,
    },
    {
      key: 'shared_fixed',
      label: 'Shared fixed',
      monthly_cost_usd: totalSharedFixedCostUsd,
      share_of_total_cost_pct: 0,
    },
  ] satisfies AdminInvestorCostDriver[]

  const costDrivers = baseCostDrivers
    .map<AdminInvestorCostDriver>((driver) => ({
      ...driver,
      share_of_total_cost_pct: monthlyCostRunRateUsd > 0 ? driver.monthly_cost_usd / monthlyCostRunRateUsd : 0,
    }))
    .sort((a, b) => b.monthly_cost_usd - a.monthly_cost_usd)

  const recommendationCounts: Record<ScenarioRecommendation, number> = {
    keep: 0,
    raise_price: 0,
    lower_limits: 0,
    raise_price_and_lower_limits: 0,
    acquisition_mode: 0,
  }

  for (const plan of profitability.plans) {
    recommendationCounts[plan.scenario_recommendation] += 1
  }

  return {
    generated_at: new Date().toISOString(),
    period_days: profitability.period_days,
    business_assumptions: assumptions,
    summary: {
      active_users: activeUsers,
      active_paid_users: activePaidUsers,
      free_users: freeUsers,
      mrr_run_rate_usd: mrrRunRateUsd,
      arr_run_rate_usd: arrRunRateUsd,
      monthly_cost_run_rate_usd: monthlyCostRunRateUsd,
      monthly_projected_cost_at_caps_usd: monthlyProjectedCostAtCapsUsd,
      blended_gross_margin_pct: calculateGrossMarginPct(mrrRunRateUsd, monthlyCostRunRateUsd),
      projected_blended_gross_margin_pct: calculateGrossMarginPct(
        mrrRunRateUsd,
        monthlyProjectedCostAtCapsUsd
      ),
      at_risk_users: atRiskUsers,
      unprofitable_users: unprofitableUsers,
      target_gross_margin_pct: assumptions.targetGrossMarginPct,
      assumed_monthly_churn_pct: assumptions.assumedMonthlyChurnPct,
      implied_customer_lifetime_months: impliedCustomerLifetimeMonths,
      assumed_trial_to_paid_pct: assumptions.assumedTrialToPaidPct,
      target_payback_months: assumptions.targetPaybackMonths,
    },
    cost_drivers: costDrivers,
    recommendation_counts: recommendationCounts,
    plans,
    scenarios,
  }
}
