import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const RUN_DB_INTEGRATION_TESTS = process.env.ACTION_EXTRACTOR_RUN_DB_TESTS === '1'
const describeDb = RUN_DB_INTEGRATION_TESTS ? describe : describe.skip

function buildTestPrefix() {
  return `hardening_${randomUUID().replace(/-/g, '')}`
}

function getTodayUtcDate() {
  const reference = new Date()
  const year = reference.getUTCFullYear()
  const month = String(reference.getUTCMonth() + 1).padStart(2, '0')
  const day = String(reference.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

describeDb('DB-backed hardening coverage', () => {
  let db: typeof import('@/lib/db')
  let billing: typeof import('@/lib/db/billing')
  let extractions: typeof import('@/lib/db/extractions')
  let currentPrefix = ''

  beforeAll(async () => {
    ;[db, billing, extractions] = await Promise.all([
      import('@/lib/db'),
      import('@/lib/db/billing'),
      import('@/lib/db/extractions'),
    ])

    await db.ensureDbReady()
  })

  beforeEach(() => {
    currentPrefix = buildTestPrefix()
  })

  afterEach(async () => {
    if (!currentPrefix) return
    await cleanupTestData(currentPrefix)
  })

  afterAll(async () => {
    await db.pool.end()
  })

  async function cleanupTestData(prefix: string) {
    const idPattern = `${prefix}%`
    const emailPattern = `${prefix}%@example.com`

    await db.pool.query(`DELETE FROM extraction_additional_sources WHERE id LIKE $1 OR extraction_id LIKE $1 OR created_by_user_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM extraction_members WHERE extraction_id LIKE $1 OR user_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM extraction_folder_members WHERE folder_id LIKE $1 OR owner_user_id LIKE $1 OR member_user_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM extraction_folders WHERE id LIKE $1 OR user_id LIKE $1 OR parent_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM extractions WHERE id LIKE $1 OR user_id LIKE $1 OR parent_extraction_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM daily_extraction_counts WHERE user_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM credit_transactions WHERE id LIKE $1 OR user_id LIKE $1 OR stripe_session_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM stripe_events WHERE id LIKE $1 OR user_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM user_plans WHERE id LIKE $1 OR user_id LIKE $1`, [idPattern])
    await db.pool.query(`DELETE FROM users WHERE id LIKE $1 OR email LIKE $2`, [idPattern, emailPattern])
  }

  async function insertUser(label: string) {
    const id = `${currentPrefix}_user_${label}`
    await db.pool.query(
      `
        INSERT INTO users (id, name, email, password_hash, email_verified_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
      [id, `User ${label}`, `${id}@example.com`, 'test-password-hash']
    )
    return id
  }

  async function insertActivePlan(userId: string, extraCredits: number, plan = 'free') {
    const id = `${currentPrefix}_plan_${randomUUID().replace(/-/g, '')}`
    await db.pool.query(
      `
        INSERT INTO user_plans (id, user_id, plan, extractions_per_hour, extra_credits, status)
        VALUES ($1, $2, $3, 12, $4, 'active')
      `,
      [id, userId, plan, extraCredits]
    )
    return id
  }

  async function getPlanDailyLimit(plan = 'free') {
    const result = await db.pool.query<{ extractions_per_day: number | string }>(
      `SELECT extractions_per_day FROM plans WHERE name = $1 LIMIT 1`,
      [plan]
    )
    return Number(result.rows[0]?.extractions_per_day ?? 3)
  }

  async function setDailyUsage(userId: string, count: number) {
    await db.pool.query(
      `
        INSERT INTO daily_extraction_counts (user_id, date, count)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, date)
        DO UPDATE SET count = EXCLUDED.count, updated_at = NOW()
      `,
      [userId, getTodayUtcDate(), count]
    )
  }

  async function createTextExtraction(input: {
    userId: string
    id: string
    shareVisibility: import('@/lib/db').ExtractionShareVisibility
    folderId?: string | null
    sourceFileUrl?: string | null
    sourceFileName?: string | null
  }) {
    const extraction = await extractions.createExtraction({
      id: input.id,
      userId: input.userId,
      url: null,
      videoId: null,
      videoTitle: null,
      thumbnailUrl: null,
      extractionMode: 'action_plan',
      objective: 'Objective',
      phasesJson: '[]',
      proTip: 'Pro tip',
      metadataJson: '{"difficulty":"easy"}',
      sourceType: 'text',
      sourceLabel: 'Primary source',
      sourceText: 'Primary source body',
      sourceFileUrl: input.sourceFileUrl ?? null,
      sourceFileName: input.sourceFileName ?? null,
      sourceFileSizeBytes: input.sourceFileUrl ? 128 : null,
      sourceFileMimeType: input.sourceFileUrl ? 'application/pdf' : null,
      folderId: input.folderId ?? null,
      shareVisibility: input.shareVisibility,
    })

    expect(extraction).not.toBeNull()
    return extraction!
  }

  it('allows folder-share viewers to read primary/additional sources and uploads but not edit', async () => {
    const ownerId = await insertUser('folder_owner')
    const viewerId = await insertUser('folder_viewer')
    const outsiderId = await insertUser('folder_outsider')

    const sharedFolder = await extractions.createExtractionFolderForUser({
      id: `${currentPrefix}_folder_shared`,
      userId: ownerId,
      name: 'Shared folder',
      color: '#0f172a',
      parentId: null,
    })
    expect(sharedFolder).not.toBeNull()

    const folderMember = await extractions.upsertExtractionFolderMemberForOwner({
      folderId: sharedFolder!.id,
      ownerUserId: ownerId,
      memberUserId: viewerId,
      role: 'viewer',
    })
    expect(folderMember).not.toBeNull()

    const primaryFileUrl = `/api/uploads/${currentPrefix}-primary.pdf`
    const additionalFileUrl = `/api/uploads/${currentPrefix}-additional.pdf`

    const extraction = await createTextExtraction({
      id: `${currentPrefix}_extraction_folder`,
      userId: ownerId,
      shareVisibility: 'private',
      folderId: sharedFolder!.id,
      sourceFileUrl: primaryFileUrl,
      sourceFileName: 'primary.pdf',
    })

    const additionalSource = await extractions.createExtractionAdditionalSourceForUser({
      extractionId: extraction.id,
      userId: ownerId,
      sourceType: 'pdf',
      sourceLabel: 'Attachment',
      url: null,
      sourceText: 'Additional attachment body',
      sourceFileUrl: additionalFileUrl,
      sourceFileName: 'attachment.pdf',
      sourceFileSizeBytes: 256,
      sourceFileMimeType: 'application/pdf',
      analysisStatus: 'analyzed',
    })
    expect(additionalSource).not.toBeNull()

    const viewerAccess = await extractions.findExtractionAccessForUser({
      id: extraction.id,
      userId: viewerId,
    })
    expect(viewerAccess.role).toBe('viewer')

    const readablePrimarySource = await extractions.getExtractionSourceData({
      extractionId: extraction.id,
      requestingUserId: viewerId,
    })
    expect(readablePrimarySource?.sourceFileUrl).toBe(primaryFileUrl)

    const readableAdditionalSources = await extractions.listExtractionAdditionalSources({
      extractionId: extraction.id,
      requestingUserId: viewerId,
    })
    expect(readableAdditionalSources).toHaveLength(1)
    expect(readableAdditionalSources?.[0]?.source_file_url).toBe(additionalFileUrl)

    const readablePrimaryUpload = await extractions.findReadableUploadFileByUrl({
      fileUrl: primaryFileUrl,
      requestingUserId: viewerId,
    })
    expect(readablePrimaryUpload?.sourceFileName).toBe('primary.pdf')

    const readableAdditionalUpload = await extractions.findReadableUploadFileByUrl({
      fileUrl: additionalFileUrl,
      requestingUserId: viewerId,
    })
    expect(readableAdditionalUpload?.sourceFileName).toBe('attachment.pdf')

    const outsiderPrimarySource = await extractions.getExtractionSourceData({
      extractionId: extraction.id,
      requestingUserId: outsiderId,
    })
    expect(outsiderPrimarySource).toBeNull()

    const outsiderUpload = await extractions.findReadableUploadFileByUrl({
      fileUrl: primaryFileUrl,
      requestingUserId: outsiderId,
    })
    expect(outsiderUpload).toBeNull()

    const viewerCreatedSource = await extractions.createExtractionAdditionalSourceForUser({
      extractionId: extraction.id,
      userId: viewerId,
      sourceType: 'text',
      sourceLabel: 'Should not write',
      url: null,
      sourceText: 'blocked',
      analysisStatus: 'pending',
    })
    expect(viewerCreatedSource).toBeNull()
  })

  it('applies public, unlisted, private and circle read rules consistently across sources and uploads', async () => {
    const ownerId = await insertUser('visibility_owner')
    const circleMemberId = await insertUser('circle_member')
    const outsiderId = await insertUser('visibility_outsider')

    const publicExtraction = await createTextExtraction({
      id: `${currentPrefix}_extraction_public`,
      userId: ownerId,
      shareVisibility: 'public',
      sourceFileUrl: `/api/uploads/${currentPrefix}-public.pdf`,
      sourceFileName: 'public.pdf',
    })
    const unlistedExtraction = await createTextExtraction({
      id: `${currentPrefix}_extraction_unlisted`,
      userId: ownerId,
      shareVisibility: 'unlisted',
      sourceFileUrl: `/api/uploads/${currentPrefix}-unlisted.pdf`,
      sourceFileName: 'unlisted.pdf',
    })
    const privateExtraction = await createTextExtraction({
      id: `${currentPrefix}_extraction_private`,
      userId: ownerId,
      shareVisibility: 'private',
      sourceFileUrl: `/api/uploads/${currentPrefix}-private.pdf`,
      sourceFileName: 'private.pdf',
    })
    const circleExtraction = await createTextExtraction({
      id: `${currentPrefix}_extraction_circle`,
      userId: ownerId,
      shareVisibility: 'circle',
      sourceFileUrl: `/api/uploads/${currentPrefix}-circle.pdf`,
      sourceFileName: 'circle.pdf',
    })

    const circleAccess = await extractions.upsertExtractionMemberForOwner({
      extractionId: circleExtraction.id,
      ownerUserId: ownerId,
      memberUserId: circleMemberId,
      role: 'viewer',
    })
    expect(circleAccess).not.toBeNull()

    await expect(
      extractions.getExtractionSourceData({
        extractionId: publicExtraction.id,
        requestingUserId: null,
      })
    ).resolves.not.toBeNull()
    await expect(
      extractions.getExtractionSourceData({
        extractionId: unlistedExtraction.id,
        requestingUserId: null,
      })
    ).resolves.not.toBeNull()
    await expect(
      extractions.getExtractionSourceData({
        extractionId: privateExtraction.id,
        requestingUserId: null,
      })
    ).resolves.toBeNull()
    await expect(
      extractions.getExtractionSourceData({
        extractionId: circleExtraction.id,
        requestingUserId: null,
      })
    ).resolves.toBeNull()
    await expect(
      extractions.getExtractionSourceData({
        extractionId: circleExtraction.id,
        requestingUserId: circleMemberId,
      })
    ).resolves.not.toBeNull()
    await expect(
      extractions.getExtractionSourceData({
        extractionId: circleExtraction.id,
        requestingUserId: outsiderId,
      })
    ).resolves.toBeNull()

    await expect(
      extractions.findReadableUploadFileByUrl({
        fileUrl: `/api/uploads/${currentPrefix}-public.pdf`,
        requestingUserId: null,
      })
    ).resolves.not.toBeNull()
    await expect(
      extractions.findReadableUploadFileByUrl({
        fileUrl: `/api/uploads/${currentPrefix}-unlisted.pdf`,
        requestingUserId: null,
      })
    ).resolves.not.toBeNull()
    await expect(
      extractions.findReadableUploadFileByUrl({
        fileUrl: `/api/uploads/${currentPrefix}-private.pdf`,
        requestingUserId: null,
      })
    ).resolves.toBeNull()
    await expect(
      extractions.findReadableUploadFileByUrl({
        fileUrl: `/api/uploads/${currentPrefix}-circle.pdf`,
        requestingUserId: null,
      })
    ).resolves.toBeNull()
    await expect(
      extractions.findReadableUploadFileByUrl({
        fileUrl: `/api/uploads/${currentPrefix}-circle.pdf`,
        requestingUserId: circleMemberId,
      })
    ).resolves.not.toBeNull()
  })

  it('allows only one concurrent consumption of the last daily quota', async () => {
    const userId = await insertUser('quota_user')
    const limit = await getPlanDailyLimit('free')

    await insertActivePlan(userId, 0, 'free')
    await setDailyUsage(userId, limit - 1)

    const results = await Promise.all([
      billing.consumeDailyExtraction(userId),
      billing.consumeDailyExtraction(userId),
    ])

    expect(results.filter((result) => result.allowed)).toHaveLength(1)
    expect(results.filter((result) => result.allowed && !result.used_credit)).toHaveLength(1)

    const countResult = await db.pool.query<{ count: number | string }>(
      `SELECT count FROM daily_extraction_counts WHERE user_id = $1 AND date = $2 LIMIT 1`,
      [userId, getTodayUtcDate()]
    )
    expect(Number(countResult.rows[0]?.count ?? 0)).toBe(limit)
  })

  it('allows only one concurrent consumption of the last extra credit', async () => {
    const userId = await insertUser('credit_user')
    const limit = await getPlanDailyLimit('free')

    await insertActivePlan(userId, 1, 'free')
    await setDailyUsage(userId, limit)

    const results = await Promise.all([
      billing.consumeDailyExtraction(userId),
      billing.consumeDailyExtraction(userId),
    ])

    expect(results.filter((result) => result.allowed && result.used_credit)).toHaveLength(1)
    expect(results.filter((result) => !result.allowed)).toHaveLength(1)

    const [planResult, txResult] = await Promise.all([
      db.pool.query<{ extra_credits: number | string }>(
        `SELECT extra_credits FROM user_plans WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [userId]
      ),
      db.pool.query<{ count: number | string }>(
        `SELECT COUNT(*)::int AS count FROM credit_transactions WHERE user_id = $1 AND reason = 'consumed'`,
        [userId]
      ),
    ])

    expect(Number(planResult.rows[0]?.extra_credits ?? 0)).toBe(0)
    expect(Number(txResult.rows[0]?.count ?? 0)).toBe(1)
  })

  it('deduplicates stripe event claims and credit purchases by session id', async () => {
    const userId = await insertUser('billing_user')
    await insertActivePlan(userId, 0, 'free')

    const eventId = `${currentPrefix}_evt_checkout_completed`
    const [firstClaim, secondClaim] = await Promise.all([
      billing.claimStripeEventProcessing(eventId, 'checkout.session.completed', userId, '{"id":"evt"}'),
      billing.claimStripeEventProcessing(eventId, 'checkout.session.completed', userId, '{"id":"evt"}'),
    ])

    expect([firstClaim, secondClaim].filter(Boolean)).toHaveLength(1)

    await billing.markStripeEventProcessed(eventId)
    await expect(
      billing.claimStripeEventProcessing(eventId, 'checkout.session.completed', userId, '{"id":"evt"}')
    ).resolves.toBe(false)

    const stripeSessionId = `${currentPrefix}_cs_pack_small`
    const creditResults = await Promise.all([
      billing.addUserCredits(userId, 25, 'purchase', stripeSessionId),
      billing.addUserCredits(userId, 25, 'purchase', stripeSessionId),
    ])

    expect(creditResults.filter((result) => result.applied)).toHaveLength(1)

    const [planResult, txResult] = await Promise.all([
      db.pool.query<{ extra_credits: number | string }>(
        `SELECT extra_credits FROM user_plans WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [userId]
      ),
      db.pool.query<{ count: number | string }>(
        `SELECT COUNT(*)::int AS count
         FROM credit_transactions
         WHERE user_id = $1 AND stripe_session_id = $2`,
        [userId, stripeSessionId]
      ),
    ])

    expect(Number(planResult.rows[0]?.extra_credits ?? 0)).toBe(25)
    expect(Number(txResult.rows[0]?.count ?? 0)).toBe(1)
  })
})
