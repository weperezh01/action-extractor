import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { normalizeMarginPct } from '@/lib/profitability'
import {
  ensureDbReady,
  pool,
  type DailyExtractionSnapshot,
  type DbCreditTransaction,
  type DbPlan,
  type DbUser,
  type DbUserPlan,
} from '@/lib/db'

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

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseDbInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(parsed) ? parsed : 0
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

      const nextUsed = parseDbInteger(updatedCountResult.rows[0]?.count ?? used + 1)
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

      if (updatedCreditsResult.rows[0]) {
        const remainingCredits = parseDbInteger(updatedCreditsResult.rows[0].extra_credits)
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
