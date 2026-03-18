import { randomUUID } from 'node:crypto'
import { Pool, type PoolClient } from 'pg'
import {
  type BuiltInTaskStatus,
} from '@/lib/task-statuses'
import {
  calculatePaymentFeeMonthlyUsd,
  calculateGrossMarginPct,
  calculateMaxVariableCostAllowed,
  calculateMonthlyRunRate,
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
  roundUpPriceUsd,
  type BusinessAssumptions,
  type ProfitabilityStatus,
  type ScenarioRecommendation,
  type SharedCostAllocationStrategy,
} from '@/lib/profitability'
import {
  buildSystemExtractionFolderIdForUser,
  isProtectedExtractionFolderIdForUser,
  listSystemExtractionFoldersForUser,
} from '@/lib/extraction-folders'

export interface DbUser {
  id: string
  name: string
  email: string
  password_hash: string
  email_verified_at: string | null
  blocked_at: string | null
  created_at: string
  updated_at: string
}

interface DbSessionWithUser {
  session_id: string
  user_id: string
  expires_at: string
  user_name: string
  user_email: string
  user_blocked_at: string | null
}

export interface DbExtractionTag {
  id: string
  name: string
  color: string
}

export interface DbExtraction {
  id: string
  user_id: string
  parent_extraction_id: string | null
  url: string | null
  video_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  extraction_mode: string
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  share_visibility: ExtractionShareVisibility
  clone_permission: ExtractionClonePermission
  order_number?: number
  created_at: string
  source_type: string
  source_label: string | null
  folder_id: string | null
  is_starred: boolean
  tags: DbExtractionTag[]
  source_text: string | null
  source_file_url: string | null
  source_file_name: string | null
  source_file_size_bytes: number | null
  source_file_mime_type: string | null
  has_source_text: boolean
  transcript_source: string | null
}

export interface DbExtractionAdditionalSource {
  id: string
  extraction_id: string
  created_by_user_id: string
  source_type: 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text'
  source_label: string | null
  url: string | null
  source_text: string | null
  source_file_url: string | null
  source_file_name: string | null
  source_file_size_bytes: number | null
  source_file_mime_type: string | null
  analysis_status: 'pending' | 'analyzed'
  analyzed_at: string | null
  created_at: string
}

export interface DbExtractionFolder {
  id: string
  user_id: string
  name: string
  color: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface DbExtractionMember {
  extraction_id: string
  user_id: string
  role: ExtractionMemberRole
  created_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbExtractionFolderMember {
  folder_id: string
  owner_user_id: string
  member_user_id: string
  role: ExtractionFolderMemberRole
  created_at: string
  member_name: string | null
  member_email: string | null
}

export interface DbSharedExtractionFolder {
  id: string
  user_id: string
  name: string
  color: string
  parent_id: string | null
  created_at: string
  updated_at: string
  root_folder_id: string
  owner_user_id: string
  owner_name: string | null
  owner_email: string | null
}

export interface DbCircleExtraction {
  extraction: DbExtraction
  access_role: ExtractionMemberRole
  owner_name: string | null
  owner_email: string | null
}

export interface DbSharedExtraction {
  extraction: DbExtraction
  access_role: ExtractionMemberRole
  owner_name: string | null
  owner_email: string | null
  share_source: 'direct' | 'folder'
  root_folder_id: string | null
  root_folder_name: string | null
}

export interface DbPublicExtraction {
  extraction: DbExtraction
  owner_name: string | null
  owner_email: string | null
}

export interface DbVideoCache {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  transcript_text: string | null
  prompt_version: string
  model: string
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface DbShareToken {
  token: string
  extraction_id: string
  user_id: string
  created_at: string
  last_used_at: string
}

export interface DbNotionConnection {
  user_id: string
  access_token: string
  workspace_id: string | null
  workspace_name: string | null
  workspace_icon: string | null
  bot_id: string | null
  owner_user_id: string | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface DbTrelloConnection {
  user_id: string
  access_token: string
  member_id: string | null
  username: string | null
  full_name: string | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface DbTodoistConnection {
  user_id: string
  access_token: string
  project_id: string | null
  user_email: string | null
  user_name: string | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export interface DbGoogleDocsConnection {
  user_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  scope: string | null
  google_user_id: string | null
  user_email: string | null
  created_at: string
  updated_at: string
  last_used_at: string
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'
export type WorkspaceInvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface DbWorkspace {
  id: string
  name: string
  slug: string
  description: string | null
  avatar_color: string
  owner_user_id: string
  created_at: string
  updated_at: string
}

export interface DbWorkspaceWithRole extends DbWorkspace {
  role: WorkspaceRole
  member_count: number
}

export interface DbWorkspaceMember {
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  joined_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbWorkspaceInvitation {
  id: string
  workspace_id: string
  invited_by_user_id: string
  email: string
  role: WorkspaceRole
  token: string
  status: WorkspaceInvitationStatus
  expires_at: string
  created_at: string
  accepted_at: string | null
  workspace_name?: string
  invited_by_name?: string | null
}

export type ExtractionShareVisibility = 'private' | 'circle' | 'unlisted' | 'public'
export type ExtractionClonePermission = 'disabled' | 'template_only' | 'full'
export type ExtractionMemberRole = 'editor' | 'viewer'
export type ExtractionFolderMemberRole = 'viewer'
export type ExtractionAccessRole = 'owner' | ExtractionMemberRole

export type CommunityPostVisibility = 'private' | 'circle' | 'followers' | 'public'
export type CommunityPostReactionType = 'like'
export type CommunityPostAttachmentType = 'link' | 'image' | 'audio' | 'video' | 'file'
export type CommunityPostAttachmentStorageProvider = 'external' | 'cloudinary'

export interface DbCommunityPostAttachment {
  id: string
  attachment_type: CommunityPostAttachmentType
  storage_provider: CommunityPostAttachmentStorageProvider
  url: string
  thumbnail_url: string | null
  title: string | null
  mime_type: string | null
  metadata_json: string
  created_at: string
  updated_at: string
}

export interface DbCommunityPost {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  content: string
  visibility: CommunityPostVisibility
  metadata_json: string
  source_extraction_id: string | null
  source_task_id: string | null
  source_label: string | null
  reactions_count: number
  comments_count: number
  views_count: number
  reacted_by_me: boolean
  following_author: boolean
  attachments: DbCommunityPostAttachment[]
  created_at: string
  updated_at: string
}

export interface DbCommunityPostComment {
  id: string
  post_id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  content: string
  created_at: string
  updated_at: string
}

export interface DbCommunityPostReactionSummary {
  post_id: string
  reaction_type: CommunityPostReactionType
  reactions_count: number
  reacted_by_me: boolean
}

export type ExtractionTaskStatus = BuiltInTaskStatus | (string & {})
export type ExtractionTaskEventType = 'note' | 'pending_action' | 'blocker' | 'resolved'
export type ExtractionTaskAttachmentType = 'pdf' | 'image' | 'audio' | 'youtube_link' | 'note'
export type ExtractionTaskAttachmentStorageProvider = 'cloudinary' | 'external'

export interface DbExtractionTask {
  id: string
  extraction_id: string
  user_id: string
  phase_id: number
  phase_title: string
  item_index: number
  item_text: string
  node_id: string
  parent_node_id: string | null
  depth: number
  position_path: string
  checked: boolean
  status: ExtractionTaskStatus
  numeric_value: number | null
  numeric_formula_json: string
  due_at: string | null
  completed_at: string | null
  scheduled_start_at: string | null
  scheduled_end_at: string | null
  duration_days: number
  flow_node_type: string
  created_at: string
  updated_at: string
}

export interface DbExtractionTaskEdge {
  id: string
  extraction_id: string
  from_task_id: string
  to_task_id: string
  edge_type: 'and' | 'xor' | 'loop'
  label: string | null
  expected_extra_days: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DbExtractionTaskDecisionSelection {
  extraction_id: string
  decision_task_id: string
  selected_to_task_id: string
  created_at: string
  updated_at: string
}

export interface DbExtractionTaskEvent {
  id: string
  task_id: string
  user_id: string
  event_type: ExtractionTaskEventType
  content: string
  metadata_json: string
  created_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbExtractionTaskAttachment {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  attachment_type: ExtractionTaskAttachmentType
  storage_provider: ExtractionTaskAttachmentStorageProvider
  url: string
  thumbnail_url: string | null
  title: string | null
  mime_type: string | null
  size_bytes: number | null
  metadata_json: string
  created_at: string
  updated_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbExtractionTaskComment {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  parent_comment_id: string | null
  is_hidden: boolean
  content: string
  created_at: string
  updated_at: string
  user_name: string | null
  user_email: string | null
}

export interface DbExtractionTaskLikeSummary {
  task_id: string
  extraction_id: string
  likes_count: number
  liked_by_me: boolean
  shares_count: number
  shared_by_me: boolean
  followers_count: number
  following_by_me: boolean
  views_count: number
  viewed_by_me: boolean
}

export type ChatMessageRole = 'user' | 'assistant'

export interface DbChatConversation {
  id: string
  user_id: string
  title: string
  context_type: string
  context_id: string | null
  created_at: string
  updated_at: string
}

export interface DbChatMessage {
  id: string
  conversation_id: string
  user_id: string
  role: ChatMessageRole
  content: string
  metadata_json: string
  created_at: string
  updated_at: string
}

export interface UserExtractionRateLimitUsage {
  limit: number
  used: number
  remaining: number
  reset_at: string
  allowed: boolean
}

export interface DailyExtractionSnapshot {
  limit: number
  used: number
  remaining: number
  extra_credits: number
  reset_at: string
}

export interface DbCreditTransaction {
  id: string
  user_id: string
  amount: number
  reason: string
  stripe_session_id: string | null
  created_at: string
}

export interface AdminDailyExtractionStat {
  date: string
  total: number
}

export interface AdminTopVideoStat {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  total: number
  total_ai_cost_usd: number
  audio_transcription_cost_usd: number
  audio_transcription_calls: number
  missing_cost_log_total: number
  missing_audio_cost_log_total: number
}

export interface AdminModeBreakdownStat {
  extraction_mode: string
  total: number
}

export type AdminTranscriptResolutionKind = 'cache' | 'audio' | 'transcript' | 'other'

export interface AdminTranscriptSourceStat {
  transcript_source: string
  kind: AdminTranscriptResolutionKind
  total: number
  share_of_youtube: number
  share_of_live: number
}

export interface AdminYoutubeResolutionStats {
  youtube_extractions_total: number
  cache_total: number
  live_total: number
  audio_total: number
  transcript_total: number
  other_total: number
  audio_transcription_calls: number
  audio_transcription_cost_usd: number
  transcript_sources: AdminTranscriptSourceStat[]
}

export interface AdminUserExtractionCostDetail {
  id: string
  url: string | null
  video_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  extraction_mode: string
  objective: string
  created_at: string
  source_type: string
  transcript_source: string | null
  total_ai_calls: number
  total_ai_cost_usd: number
  audio_transcription_calls: number
  audio_transcription_cost_usd: number
}

export interface AdminUsageStats {
  period_days: number
  generated_at: string
  total_users: number
  total_extractions: number
  active_users_7d: number
  extractions_last_24h: number
  unique_videos_in_period: number
  extractions_by_day: AdminDailyExtractionStat[]
  top_videos: AdminTopVideoStat[]
  extraction_modes: AdminModeBreakdownStat[]
  youtube_resolution: AdminYoutubeResolutionStats
}

export type AdminUserVerificationFilter = 'all' | 'verified' | 'unverified'
export type AdminUserBlockedFilter = 'all' | 'blocked' | 'active'

export interface AdminUserListItem {
  id: string
  name: string
  email: string
  created_at: string
  email_verified_at: string | null
  blocked_at: string | null
  total_extractions: number
  last_extraction_at: string | null
  ai_calls: number
  ai_input_tokens: number
  ai_output_tokens: number
  ai_cost_usd: number
}

export interface AdminUserListResult {
  total: number
  users: AdminUserListItem[]
}

interface GlobalDb {
  __actionExtractorPgPool?: Pool
  __actionExtractorDbReady?: Promise<void>
  __actionExtractorDbInitSignature?: string
  __actionExtractorDbBootstrapWarned?: boolean
}

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

interface DbEmailVerificationTokenRow {
  user_id: string
  expires_at: Date | string
}

interface DbSessionWithUserRow {
  session_id: string
  user_id: string
  expires_at: Date | string
  user_name: string
  user_email: string
  user_blocked_at: Date | string | null
}

interface DbExtractionRow {
  id: string
  user_id: string
  parent_extraction_id?: string | null
  url: string | null
  video_id: string | null
  video_title: string | null
  thumbnail_url: string | null
  extraction_mode: string
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  share_visibility?: string | null
  clone_permission?: string | null
  order_number?: number | string
  created_at: Date | string
  source_type?: string | null
  source_label?: string | null
  folder_id?: string | null
  is_starred?: boolean | null
  tags_json?: string | null
  source_text?: string | null
  source_file_url?: string | null
  source_file_name?: string | null
  source_file_size_bytes?: number | null
  source_file_mime_type?: string | null
  has_source_text?: boolean | null
  transcript_source?: string | null
}

interface DbExtractionAdditionalSourceRow {
  id: string
  extraction_id: string
  created_by_user_id: string
  source_type: 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text'
  source_label: string | null
  url: string | null
  source_text: string | null
  source_file_url: string | null
  source_file_name: string | null
  source_file_size_bytes: number | string | null
  source_file_mime_type: string | null
  analysis_status: string | null
  analyzed_at: Date | string | null
  created_at: Date | string
}

interface DbExtractionFolderRow {
  id: string
  user_id: string
  name: string
  color: string
  parent_id: string | null
  created_at: Date | string
  updated_at: Date | string
}

interface DbExtractionAccessRow extends DbExtractionRow {
  access_role: string | null
}

interface DbVideoCacheRow {
  video_id: string
  video_title: string | null
  thumbnail_url: string | null
  objective: string
  phases_json: string
  pro_tip: string
  metadata_json: string
  transcript_text: string | null
  prompt_version: string
  model: string
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbNotionConnectionRow {
  user_id: string
  access_token: string
  workspace_id: string | null
  workspace_name: string | null
  workspace_icon: string | null
  bot_id: string | null
  owner_user_id: string | null
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbTrelloConnectionRow {
  user_id: string
  access_token: string
  member_id: string | null
  username: string | null
  full_name: string | null
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbTodoistConnectionRow {
  user_id: string
  access_token: string
  project_id: string | null
  user_email: string | null
  user_name: string | null
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbGoogleDocsConnectionRow {
  user_id: string
  access_token: string
  refresh_token: string | null
  token_expires_at: Date | string | null
  scope: string | null
  google_user_id: string | null
  user_email: string | null
  created_at: Date | string
  updated_at: Date | string
  last_used_at: Date | string
}

interface DbExtractionTaskRow {
  id: string
  extraction_id: string
  user_id: string
  phase_id: number | string
  phase_title: string
  item_index: number | string
  item_text: string
  node_id: string | null
  parent_node_id: string | null
  depth: number | string | null
  position_path: string | null
  checked: boolean
  status: ExtractionTaskStatus
  numeric_value: number | string | null
  numeric_formula_json: string | null
  due_at: Date | string | null
  completed_at: Date | string | null
  scheduled_start_at: Date | string | null
  scheduled_end_at: Date | string | null
  duration_days: number | string
  flow_node_type: string | null
  created_at: Date | string
  updated_at: Date | string
}

interface DbExtractionTaskEventRow {
  id: string
  task_id: string
  user_id: string
  event_type: ExtractionTaskEventType
  content: string
  metadata_json: string
  created_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbCommunityPostRow {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  content: string
  visibility: string
  metadata_json: string
  source_extraction_id: string | null
  source_task_id: string | null
  source_label: string | null
  reactions_count: number | string
  comments_count: number | string
  views_count: number | string
  reacted_by_me: boolean | null
  following_author: boolean | null
  attachments_json: unknown
  created_at: Date | string
  updated_at: Date | string
}

interface DbCommunityPostCommentRow {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: Date | string
  updated_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbChatConversationRow {
  id: string
  user_id: string
  title: string
  context_type: string
  context_id: string | null
  created_at: Date | string
  updated_at: Date | string
}

interface DbChatMessageRow {
  id: string
  conversation_id: string
  user_id: string
  role: string
  content: string
  metadata_json: string
  created_at: Date | string
  updated_at: Date | string
}

interface DbWorkspaceRow {
  id: string
  name: string
  slug: string
  description: string | null
  avatar_color: string
  owner_user_id: string
  created_at: Date | string
  updated_at: Date | string
}

interface DbWorkspaceWithRoleRow extends DbWorkspaceRow {
  role: string
  member_count: number | string
}

interface DbWorkspaceMemberRow {
  workspace_id: string
  user_id: string
  role: string
  joined_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbWorkspaceInvitationRow {
  id: string
  workspace_id: string
  invited_by_user_id: string
  email: string
  role: string
  token: string
  status: string
  expires_at: Date | string
  created_at: Date | string
  accepted_at: Date | string | null
  workspace_name?: string
  invited_by_name?: string | null
}

interface DbExtractionRateLimitRow {
  window_start: Date | string
  request_count: number | string
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

interface DbCommunityActionRateLimitRow {
  window_start: Date | string
  request_count: number | string
}

interface DbCountRow {
  total: number | string
}

interface DbExtractionOrderNumberRow {
  order_number: number | string
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
  total_ai_cost_usd: number | string
  audio_transcription_cost_usd: number | string
  audio_transcription_calls: number | string
  missing_cost_log_total: number | string
  missing_audio_cost_log_total: number | string
}

interface DbAdminModeBreakdownRow {
  extraction_mode: string | null
  total: number | string
}

interface DbAdminYoutubeResolutionSummaryRow {
  youtube_total: number | string
  cache_total: number | string
  audio_total: number | string
  transcript_total: number | string
  other_total: number | string
}

interface DbAdminYoutubeTranscriptionCostRow {
  audio_transcription_calls: number | string
  audio_transcription_cost_usd: number | string
}

interface DbAdminTranscriptSourceBreakdownRow {
  transcript_source: string | null
  total: number | string
}

interface DbAdminUserExtractionCostRow extends DbExtractionRow {
  total_ai_calls: number | string
  total_ai_cost_usd: number | string
  audio_transcription_calls: number | string
  audio_transcription_cost_usd: number | string
}

interface DbAdminUserListRow {
  id: string
  name: string
  email: string
  created_at: Date | string
  email_verified_at: Date | string | null
  blocked_at: Date | string | null
  total_extractions: number | string
  last_extraction_at: Date | string | null
  ai_calls: number | string
  ai_input_tokens: number | string
  ai_output_tokens: number | string
  ai_cost_usd: string | number
}

const globalForDb = globalThis as unknown as GlobalDb

const POOL_SHARED_CONFIG = {
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
}

export const pool =
  globalForDb.__actionExtractorPgPool ??
  new Pool(
    process.env.ACTION_EXTRACTOR_DATABASE_URL
      ? {
          connectionString: process.env.ACTION_EXTRACTOR_DATABASE_URL,
          ...POOL_SHARED_CONFIG,
        }
      : {
          host: process.env.ACTION_EXTRACTOR_DB_HOST ?? 'postgres-db',
          port: Number(process.env.ACTION_EXTRACTOR_DB_PORT ?? 5432),
          database: process.env.ACTION_EXTRACTOR_DB_NAME ?? 'action_extractor_db',
          user: process.env.ACTION_EXTRACTOR_DB_USER ?? 'action_extractor_user',
          password: process.env.ACTION_EXTRACTOR_DB_PASSWORD ?? '',
          ...POOL_SHARED_CONFIG,
        }
  )

if (!globalForDb.__actionExtractorPgPool) {
  globalForDb.__actionExtractorPgPool = pool
}

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email_verified_at TIMESTAMPTZ,
    blocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extractions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_extraction_id TEXT REFERENCES extractions(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    video_id TEXT,
    video_title TEXT,
    thumbnail_url TEXT,
    extraction_mode TEXT NOT NULL DEFAULT 'action_plan',
    objective TEXT NOT NULL,
    phases_json TEXT NOT NULL,
    pro_tip TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    clone_permission TEXT NOT NULL DEFAULT 'disabled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS video_cache (
    video_id TEXT PRIMARY KEY,
    video_title TEXT,
    thumbnail_url TEXT,
    objective TEXT NOT NULL,
    phases_json TEXT NOT NULL,
    pro_tip TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    transcript_text TEXT,
    prompt_version TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS share_tokens (
    token TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS notion_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    workspace_id TEXT,
    workspace_name TEXT,
    workspace_icon TEXT,
    bot_id TEXT,
    owner_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS trello_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    member_id TEXT,
    username TEXT,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS todoist_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    project_id TEXT,
    user_email TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS google_docs_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    scope TEXT,
    google_user_id TEXT,
    user_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_rate_limits (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, window_start)
  );

  CREATE TABLE IF NOT EXISTS community_action_rate_limits (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_key TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, action_key, window_start)
  );

  CREATE TABLE IF NOT EXISTS extraction_tasks (
    id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phase_id INTEGER NOT NULL,
    phase_title TEXT NOT NULL,
    item_index INTEGER NOT NULL,
    item_text TEXT NOT NULL,
    node_id TEXT NOT NULL,
    parent_node_id TEXT,
    depth INTEGER NOT NULL DEFAULT 1,
    position_path TEXT NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending',
    numeric_value DOUBLE PRECISION,
    numeric_formula_json TEXT NOT NULL DEFAULT '{}',
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (extraction_id, phase_id, item_index)
  );

  CREATE TABLE IF NOT EXISTS extraction_task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_task_attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'external',
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    title TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id TEXT REFERENCES extraction_task_comments(id) ON DELETE SET NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_task_likes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS extraction_task_follows (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS extraction_task_shares (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS extraction_task_views (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Asistente de Contenidos',
    context_type TEXT NOT NULL DEFAULT 'global',
    context_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS checked BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS numeric_value DOUBLE PRECISION;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS numeric_formula_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS node_id TEXT;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS parent_node_id TEXT;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS position_path TEXT;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ;
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 1;

  CREATE TABLE IF NOT EXISTS extraction_task_dependencies (
    extraction_id       TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    task_id             TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    predecessor_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, predecessor_task_id)
  );
  CREATE INDEX IF NOT EXISTS idx_etd_extraction  ON extraction_task_dependencies(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_etd_task        ON extraction_task_dependencies(task_id);
  CREATE INDEX IF NOT EXISTS idx_etd_predecessor ON extraction_task_dependencies(predecessor_task_id);

  UPDATE extraction_tasks
  SET node_id = CONCAT('p', phase_id, '-i', item_index)
  WHERE node_id IS NULL OR BTRIM(node_id) = '';

  UPDATE extraction_tasks
  SET position_path = CONCAT(phase_id::text, '.', (item_index + 1)::text)
  WHERE position_path IS NULL OR BTRIM(position_path) = '';

  UPDATE extraction_tasks
  SET depth = 1
  WHERE depth IS NULL OR depth < 1;

  ALTER TABLE extraction_tasks ALTER COLUMN node_id SET NOT NULL;
  ALTER TABLE extraction_tasks ALTER COLUMN position_path SET NOT NULL;
  ALTER TABLE extraction_task_events ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE extraction_task_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS attachment_type TEXT NOT NULL DEFAULT 'pdf';
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'external';
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT '';
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS mime_type TEXT;
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS parent_comment_id TEXT REFERENCES extraction_task_comments(id) ON DELETE SET NULL;
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_likes ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_follows ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_follows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_shares ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_shares ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_task_views ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE extraction_task_views ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Asistente de Contenidos';
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_conversations DROP CONSTRAINT IF EXISTS chat_conversations_user_id_key;
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS context_type TEXT NOT NULL DEFAULT 'global';
  ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS context_id TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS video_title TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS extraction_mode TEXT NOT NULL DEFAULT 'action_plan';
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS share_visibility TEXT NOT NULL DEFAULT 'private';
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS clone_permission TEXT NOT NULL DEFAULT 'disabled';
  ALTER TABLE extractions DROP CONSTRAINT IF EXISTS extractions_clone_permission_check;
  ALTER TABLE extractions ADD CONSTRAINT extractions_clone_permission_check CHECK (clone_permission IN ('disabled', 'template_only', 'full'));
  ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS video_title TEXT;
  ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE video_cache ADD COLUMN IF NOT EXISTS transcript_text TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_blocked_at ON users(blocked_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_extractions_user_id ON extractions(user_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_created_at ON extractions(created_at);
  CREATE INDEX IF NOT EXISTS idx_video_cache_last_used_at ON video_cache(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_reset_tokens_token_hash ON password_reset_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_share_tokens_extraction_id ON share_tokens(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_share_tokens_user_id ON share_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_share_tokens_last_used_at ON share_tokens(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_notion_connections_last_used_at ON notion_connections(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_trello_connections_last_used_at ON trello_connections(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_todoist_connections_last_used_at ON todoist_connections(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_google_docs_connections_last_used_at ON google_docs_connections(last_used_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_rate_limits_window_start ON extraction_rate_limits(window_start);
  CREATE INDEX IF NOT EXISTS idx_community_action_rate_limits_window_start ON community_action_rate_limits(window_start);
  CREATE INDEX IF NOT EXISTS idx_community_action_rate_limits_action_key ON community_action_rate_limits(action_key);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_extraction_id ON extraction_tasks(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_user_id ON extraction_tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_status ON extraction_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_extraction_tasks_position_path ON extraction_tasks(extraction_id, phase_id, position_path);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_tasks_extraction_node_unique ON extraction_tasks(extraction_id, node_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_events_task_id ON extraction_task_events(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_events_created_at ON extraction_task_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_task_id ON extraction_task_attachments(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_extraction_id ON extraction_task_attachments(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_user_id ON extraction_task_attachments(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_attachments_created_at ON extraction_task_attachments(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_task_id ON extraction_task_comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_extraction_id ON extraction_task_comments(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_parent_comment_id ON extraction_task_comments(parent_comment_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_comments_created_at ON extraction_task_comments(created_at);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_likes_task_id ON extraction_task_likes(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_likes_extraction_id ON extraction_task_likes(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_likes_task_user_unique ON extraction_task_likes(task_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_follows_task_id ON extraction_task_follows(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_follows_extraction_id ON extraction_task_follows(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_follows_task_user_unique ON extraction_task_follows(task_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_shares_task_id ON extraction_task_shares(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_shares_extraction_id ON extraction_task_shares(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_shares_task_user_unique ON extraction_task_shares(task_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_views_task_id ON extraction_task_views(task_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_task_views_extraction_id ON extraction_task_views(extraction_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_task_views_task_user_unique ON extraction_task_views(task_id, user_id);
  DROP INDEX IF EXISTS idx_chat_conversations_user_id;
  CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ai_usage_log (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    use_type TEXT NOT NULL DEFAULT 'extraction',
    user_id TEXT,
    extraction_id TEXT,
    source_type TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
    pricing_version TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS extraction_id TEXT;
  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS source_type TEXT;
  ALTER TABLE ai_usage_log ADD COLUMN IF NOT EXISTS pricing_version TEXT NOT NULL DEFAULT '';

  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider_model ON ai_usage_log(provider, model);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_extraction_id ON ai_usage_log(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_ai_usage_log_use_type ON ai_usage_log(use_type);

  ALTER TABLE extractions ALTER COLUMN url DROP NOT NULL;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS parent_extraction_id TEXT REFERENCES extractions(id) ON DELETE SET NULL;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'youtube';
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_label TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS folder_id TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS extraction_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'indigo',
    parent_id TEXT REFERENCES extraction_folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS extraction_members (
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (extraction_id, user_id),
    CONSTRAINT extraction_members_role_check CHECK (role IN ('editor', 'viewer'))
  );

  CREATE TABLE IF NOT EXISTS extraction_additional_sources (
    id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL DEFAULT 'web_url',
    source_label TEXT,
    url TEXT,
    source_text TEXT,
    source_file_url TEXT,
    source_file_name TEXT,
    source_file_size_bytes BIGINT,
    source_file_mime_type TEXT,
    analysis_status TEXT NOT NULL DEFAULT 'pending',
    analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT extraction_additional_sources_type_check CHECK (source_type IN ('youtube', 'web_url', 'pdf', 'docx', 'text')),
    CONSTRAINT extraction_additional_sources_analysis_status_check CHECK (analysis_status IN ('pending', 'analyzed'))
  );

  CREATE TABLE IF NOT EXISTS extraction_folder_members (
    folder_id TEXT NOT NULL REFERENCES extraction_folders(id) ON DELETE CASCADE,
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (folder_id, member_user_id),
    CONSTRAINT extraction_folder_members_role_check CHECK (role IN ('viewer'))
  );

  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS user_id TEXT;
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'indigo';
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS parent_id TEXT;
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_folders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
  ALTER TABLE extraction_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'web_url';
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_label TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS url TEXT;
  ALTER TABLE extraction_additional_sources ALTER COLUMN url DROP NOT NULL;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_text TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_file_url TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_file_name TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_file_size_bytes BIGINT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS source_file_mime_type TEXT;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'pending';
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;
  ALTER TABLE extraction_additional_sources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE extraction_additional_sources DROP CONSTRAINT IF EXISTS extraction_additional_sources_type_check;
  ALTER TABLE extraction_additional_sources ADD CONSTRAINT extraction_additional_sources_type_check CHECK (source_type IN ('youtube', 'web_url', 'pdf', 'docx', 'text'));
  ALTER TABLE extraction_additional_sources DROP CONSTRAINT IF EXISTS extraction_additional_sources_analysis_status_check;
  ALTER TABLE extraction_additional_sources ADD CONSTRAINT extraction_additional_sources_analysis_status_check CHECK (analysis_status IN ('pending', 'analyzed'));
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS member_user_id TEXT;
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
  ALTER TABLE extraction_folder_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS idx_extraction_folders_user_id ON extraction_folders(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_folders_parent_id ON extraction_folders(parent_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_folder_id ON extractions(folder_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_parent_extraction_id ON extractions(parent_extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_user_id ON extraction_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_extraction_id ON extraction_members(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_members_role ON extraction_members(role);
  CREATE INDEX IF NOT EXISTS idx_extraction_additional_sources_extraction_id ON extraction_additional_sources(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_additional_sources_created_by_user_id ON extraction_additional_sources(created_by_user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_additional_sources_analysis_status ON extraction_additional_sources(analysis_status);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_additional_sources_unique_url ON extraction_additional_sources(extraction_id, url);
  CREATE INDEX IF NOT EXISTS idx_extraction_folder_members_owner_user_id ON extraction_folder_members(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_folder_members_member_user_id ON extraction_folder_members(member_user_id);
  CREATE INDEX IF NOT EXISTS idx_extraction_folder_members_folder_id ON extraction_folder_members(folder_id);

  CREATE TABLE IF NOT EXISTS guest_extraction_limits (
    guest_id    TEXT    NOT NULL,
    window_date DATE    NOT NULL DEFAULT CURRENT_DATE,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guest_id, window_date)
  );

  CREATE TABLE IF NOT EXISTS login_rate_limits (
    key          TEXT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, window_start)
  );

  CREATE TABLE IF NOT EXISTS guest_tasks (
    id TEXT PRIMARY KEY,
    guest_id TEXT NOT NULL,
    phase_id INTEGER NOT NULL,
    phase_title TEXT NOT NULL,
    item_index INTEGER NOT NULL,
    item_text TEXT NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending',
    numeric_value DOUBLE PRECISION,
    numeric_formula_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (guest_id, phase_id, item_index)
  );

  CREATE TABLE IF NOT EXISTS guest_task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES guest_tasks(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS guest_task_attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES guest_tasks(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL,
    attachment_type TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'external',
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    title TEXT,
    mime_type TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS guest_task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES guest_tasks(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL,
    parent_comment_id TEXT REFERENCES guest_task_comments(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS guest_task_likes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES guest_tasks(id) ON DELETE CASCADE,
    guest_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, guest_id)
  );

  ALTER TABLE guest_task_comments ADD COLUMN IF NOT EXISTS parent_comment_id TEXT REFERENCES guest_task_comments(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_guest_tasks_guest_id ON guest_tasks(guest_id);
  ALTER TABLE guest_tasks ADD COLUMN IF NOT EXISTS numeric_value DOUBLE PRECISION;
  ALTER TABLE guest_tasks ADD COLUMN IF NOT EXISTS numeric_formula_json TEXT NOT NULL DEFAULT '{}';
  CREATE INDEX IF NOT EXISTS idx_guest_task_events_task_id ON guest_task_events(task_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_attachments_task_id ON guest_task_attachments(task_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_comments_task_id ON guest_task_comments(task_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_comments_parent_comment_id ON guest_task_comments(parent_comment_id);
  CREATE INDEX IF NOT EXISTS idx_guest_task_likes_task_id ON guest_task_likes(task_id);

  CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'public',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT community_posts_visibility_check CHECK (visibility IN ('private', 'circle', 'followers', 'public'))
  );

  CREATE TABLE IF NOT EXISTS community_post_sources (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    source_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS community_post_attachments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    attachment_type TEXT NOT NULL DEFAULT 'link',
    storage_provider TEXT NOT NULL DEFAULT 'external',
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    title TEXT,
    mime_type TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT community_post_attachments_type_check CHECK (attachment_type IN ('link', 'image', 'audio', 'video', 'file')),
    CONSTRAINT community_post_attachments_storage_check CHECK (storage_provider IN ('external', 'cloudinary'))
  );

  CREATE TABLE IF NOT EXISTS community_follows (
    follower_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_user_id, following_user_id),
    CONSTRAINT community_follows_not_self CHECK (follower_user_id <> following_user_id)
  );

  CREATE TABLE IF NOT EXISTS community_post_reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT community_post_reactions_type_check CHECK (reaction_type IN ('like')),
    UNIQUE (post_id, user_id, reaction_type)
  );

  CREATE TABLE IF NOT EXISTS community_post_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS community_post_views (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (post_id, user_id)
  );

  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_sources ADD COLUMN IF NOT EXISTS extraction_id TEXT REFERENCES extractions(id) ON DELETE CASCADE;
  ALTER TABLE community_post_sources ADD COLUMN IF NOT EXISTS task_id TEXT REFERENCES extraction_tasks(id) ON DELETE CASCADE;
  ALTER TABLE community_post_sources ADD COLUMN IF NOT EXISTS source_label TEXT;
  ALTER TABLE community_post_sources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS attachment_type TEXT NOT NULL DEFAULT 'link';
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'external';
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS mime_type TEXT;
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_attachments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_reactions ADD COLUMN IF NOT EXISTS reaction_type TEXT NOT NULL DEFAULT 'like';
  ALTER TABLE community_post_reactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE community_post_views ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_posts_visibility ON community_posts(visibility);
  CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_community_post_sources_post_id ON community_post_sources(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_sources_extraction_id ON community_post_sources(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_sources_task_id ON community_post_sources(task_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_attachments_post_id ON community_post_attachments(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_follows_follower ON community_follows(follower_user_id);
  CREATE INDEX IF NOT EXISTS idx_community_follows_following ON community_follows(following_user_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_reactions_post_id ON community_post_reactions(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_reactions_user_id ON community_post_reactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_comments_post_id ON community_post_comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_comments_user_id ON community_post_comments(user_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_views_post_id ON community_post_views(post_id);
  CREATE INDEX IF NOT EXISTS idx_community_post_views_user_id ON community_post_views(user_id);

  -- Stripe monetization
  ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id
    ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS user_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free',
    extractions_per_hour INTEGER NOT NULL DEFAULT 12,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plans_user_active
    ON user_plans(user_id) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS idx_user_plans_stripe_sub
    ON user_plans(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processing BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    raw_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS processing BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
  ALTER TABLE stripe_events ADD COLUMN IF NOT EXISTS last_error TEXT;
  CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);

  -- Plan catalog (admin-managed)
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    price_monthly_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    stripe_price_id TEXT,
    extractions_per_hour INTEGER NOT NULL DEFAULT 12,
    features_json TEXT NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Seed initial plans — use ON CONFLICT (name) DO NOTHING to safely handle duplicate names
  -- (name is the business key; the id may differ if a plan was created manually)
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES ('plan_free', 'free', 'Free', 0, NULL, 12, '{"batch_extraction":false,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":false,"api_access":false}', true, 0)
  ON CONFLICT (name) DO NOTHING;
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES ('plan_starter', 'starter', 'Starter', 9, NULL, 30, '{"batch_extraction":false,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":false,"api_access":false}', true, 1)
  ON CONFLICT (name) DO NOTHING;
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES ('plan_pro', 'pro', 'Pro', 15, NULL, 60, '{"batch_extraction":true,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":true,"api_access":false}', true, 2)
  ON CONFLICT (name) DO NOTHING;
  INSERT INTO plans (id, name, display_name, price_monthly_usd, stripe_price_id, extractions_per_hour, features_json, is_active, display_order)
  VALUES ('plan_business', 'business', 'Business', 49, NULL, 200, '{"batch_extraction":true,"export_integrations":true,"folders":true,"knowledge_chat":true,"concept_map_mode":true,"priority_support":true,"api_access":true}', true, 3)
  ON CONFLICT (name) DO NOTHING;

  -- ── Tags ───────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS extraction_tags (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT 'indigo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_extraction_tags_user ON extraction_tags(user_id);

  CREATE TABLE IF NOT EXISTS extraction_tag_assignments (
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    tag_id        TEXT NOT NULL REFERENCES extraction_tags(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (extraction_id, tag_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON extraction_tag_assignments(tag_id);
  CREATE INDEX IF NOT EXISTS idx_tag_assignments_extraction ON extraction_tag_assignments(extraction_id);

  CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify_task_status_change BOOLEAN NOT NULL DEFAULT TRUE,
    notify_new_comment BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ── Workspaces ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    avatar_color TEXT NOT NULL DEFAULT 'indigo',
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id),
    CONSTRAINT workspace_members_role_check CHECK (role IN ('owner','admin','member','viewer'))
  );

  CREATE TABLE IF NOT EXISTS workspace_invitations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE (workspace_id, email),
    CONSTRAINT workspace_invitations_role_check CHECK (role IN ('admin','member','viewer')),
    CONSTRAINT workspace_invitations_status_check CHECK (status IN ('pending','accepted','declined','expired'))
  );

  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;

  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_text TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_file_url TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_file_name TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_file_size_bytes INTEGER;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS source_file_mime_type TEXT;
  ALTER TABLE extractions ADD COLUMN IF NOT EXISTS transcript_source TEXT;

  CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
  CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
  CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
  CREATE INDEX IF NOT EXISTS idx_extractions_workspace_id ON extractions(workspace_id);

  -- ── Daily extraction counts (replaces hourly sliding window) ──────────────
  CREATE TABLE IF NOT EXISTS daily_extraction_counts (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_extraction_counts_user ON daily_extraction_counts(user_id);
  CREATE INDEX IF NOT EXISTS idx_daily_extraction_counts_date ON daily_extraction_counts(date);

  -- ── Credit transactions ───────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'purchase',
    stripe_session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_stripe_session_id
    ON credit_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

  -- ── Schema migrations for daily limits ───────────────────────────────────
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS extractions_per_day INT NOT NULL DEFAULT 3;
  ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS extra_credits INT NOT NULL DEFAULT 0;

  -- Update existing plan rows with correct daily limits (idempotent)
  UPDATE plans SET extractions_per_day = 3   WHERE name = 'free';
  UPDATE plans SET extractions_per_day = 15  WHERE name = 'starter';
  UPDATE plans SET extractions_per_day = 40  WHERE name = 'pro';
  UPDATE plans SET extractions_per_day = 150 WHERE name = 'business';

  -- ── Prompt templates (admin-editable overrides) ───────────────────────────
  CREATE TABLE IF NOT EXISTS prompt_templates (
    prompt_key TEXT PRIMARY KEY,
    content    TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
  );

  -- ── Chat token daily limits ────────────────────────────────────────────────
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS chat_tokens_per_day INT NOT NULL DEFAULT 10000;
  UPDATE plans SET chat_tokens_per_day = 10000  WHERE name = 'free';
  UPDATE plans SET chat_tokens_per_day = 30000  WHERE name = 'starter';
  UPDATE plans SET chat_tokens_per_day = 100000 WHERE name = 'pro';
  UPDATE plans SET chat_tokens_per_day = 500000 WHERE name = 'business';

  CREATE TABLE IF NOT EXISTS daily_chat_token_counts (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       DATE NOT NULL DEFAULT CURRENT_DATE,
    tokens_used INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_daily_chat_tokens_user ON daily_chat_token_counts(user_id);
  CREATE INDEX IF NOT EXISTS idx_daily_chat_tokens_date ON daily_chat_token_counts(date);

  -- ── Flowchart / Process Graph ─────────────────────────────────────────────
  ALTER TABLE extraction_tasks ADD COLUMN IF NOT EXISTS flow_node_type TEXT NOT NULL DEFAULT 'process';

  CREATE TABLE IF NOT EXISTS extraction_task_edges (
    id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    from_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    to_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL DEFAULT 'and',
    label TEXT,
    expected_extra_days DOUBLE PRECISION,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (extraction_id, from_task_id, to_task_id, edge_type),
    CONSTRAINT extraction_task_edges_type_check CHECK (edge_type IN ('and', 'xor', 'loop'))
  );
  CREATE INDEX IF NOT EXISTS idx_ete_extraction ON extraction_task_edges(extraction_id);
  CREATE INDEX IF NOT EXISTS idx_ete_from_task ON extraction_task_edges(from_task_id);
  CREATE INDEX IF NOT EXISTS idx_ete_to_task ON extraction_task_edges(to_task_id);

  CREATE TABLE IF NOT EXISTS extraction_task_decision_selection (
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    decision_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    selected_to_task_id TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (extraction_id, decision_task_id)
  );
  CREATE INDEX IF NOT EXISTS idx_etds_extraction ON extraction_task_decision_selection(extraction_id);

  CREATE TABLE IF NOT EXISTS extraction_presentations (
    extraction_id TEXT PRIMARY KEY REFERENCES extractions(id) ON DELETE CASCADE,
    deck_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS extraction_presentation_states (
    extraction_id TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_slide_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (extraction_id, user_id)
  );

  -- ── Flowchart custom node positions ─────────────────────────────
  CREATE TABLE IF NOT EXISTS flow_node_positions (
    task_id        TEXT NOT NULL REFERENCES extraction_tasks(id) ON DELETE CASCADE,
    extraction_id  TEXT NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
    cx             DOUBLE PRECISION NOT NULL,
    cy             DOUBLE PRECISION NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, extraction_id)
  );
  CREATE INDEX IF NOT EXISTS idx_fnp_extraction ON flow_node_positions(extraction_id);

  -- ── Per-user storage tracking ─────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS user_storage (
    user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    used_bytes BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- ── Storage limit per plan + per-user admin override ──────────────────────
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT NOT NULL DEFAULT 104857600;
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS target_gross_margin_pct NUMERIC(5,4) NOT NULL DEFAULT 0.75;
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS profitability_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS estimated_monthly_fixed_cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0;
  -- Seed correct limits for built-in plans only if still at the default (idempotent, respects admin edits)
  UPDATE plans SET storage_limit_bytes = 104857600   WHERE name = 'free'     AND storage_limit_bytes = 104857600;
  UPDATE plans SET storage_limit_bytes = 524288000   WHERE name = 'starter'  AND storage_limit_bytes = 104857600;
  UPDATE plans SET storage_limit_bytes = 2147483648  WHERE name = 'pro'      AND storage_limit_bytes = 104857600;
  UPDATE plans SET storage_limit_bytes = 10737418240 WHERE name = 'business' AND storage_limit_bytes = 104857600;
  UPDATE plans SET target_gross_margin_pct = 0.00 WHERE name = 'free';
  UPDATE plans SET target_gross_margin_pct = 0.70 WHERE name = 'starter';
  UPDATE plans SET target_gross_margin_pct = 0.75 WHERE name = 'pro';
  UPDATE plans SET target_gross_margin_pct = 0.80 WHERE name = 'business';
  UPDATE plans SET profitability_alert_enabled = TRUE WHERE profitability_alert_enabled IS DISTINCT FROM TRUE;
  ALTER TABLE user_storage ADD COLUMN IF NOT EXISTS storage_limit_override_bytes BIGINT;
`

const DB_INIT_SIGNATURE = '2026-03-18-phase2-1'
const DB_RUNTIME_BOOTSTRAP_WARNING =
  '[db] Runtime schema bootstrap is deprecated. Run "npm run db:migrate" before starting the app or deploying changes.'

function warnRuntimeBootstrapDeprecationOnce() {
  if (process.env.NODE_ENV === 'test') return
  if (globalForDb.__actionExtractorDbBootstrapWarned) return
  globalForDb.__actionExtractorDbBootstrapWarned = true
  console.warn(DB_RUNTIME_BOOTSTRAP_WARNING)
}

function getDbReadyPromise() {
  const shouldReinitialize =
    !globalForDb.__actionExtractorDbReady ||
    globalForDb.__actionExtractorDbInitSignature !== DB_INIT_SIGNATURE

  if (shouldReinitialize) {
    let readyPromise: Promise<void>
    warnRuntimeBootstrapDeprecationOnce()
    readyPromise = pool
      .query(INIT_SQL)
      .then(async () => {
        // Sync stripe_price_ids from env vars so admins don't have to set them manually
        const priceUpdates: Array<{ name: string; priceId: string }> = [
          { name: 'starter',  priceId: process.env.STRIPE_PRICE_STARTER_MONTHLY  ?? '' },
          { name: 'pro',      priceId: process.env.STRIPE_PRICE_PRO_MONTHLY      ?? '' },
          { name: 'business', priceId: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? '' },
        ].filter((u) => u.priceId)
        for (const { name, priceId } of priceUpdates) {
          await pool.query(
            `UPDATE plans SET stripe_price_id = $1, updated_at = NOW() WHERE name = $2 AND (stripe_price_id IS NULL OR stripe_price_id = '')`,
            [priceId, name]
          )
        }
        // Sync daily limits (always update to ensure new values are applied)
        await pool.query(`UPDATE plans SET extractions_per_day = 3   WHERE name = 'free'`)
        await pool.query(`UPDATE plans SET extractions_per_day = 15  WHERE name = 'starter'`)
        await pool.query(`UPDATE plans SET extractions_per_day = 40  WHERE name = 'pro'`)
        await pool.query(`UPDATE plans SET extractions_per_day = 150 WHERE name = 'business'`)
      })
      .catch((error) => {
        if (globalForDb.__actionExtractorDbReady === readyPromise) {
          globalForDb.__actionExtractorDbReady = undefined
          globalForDb.__actionExtractorDbInitSignature = undefined
        }
        throw error
      })

    globalForDb.__actionExtractorDbReady = readyPromise
    globalForDb.__actionExtractorDbInitSignature = DB_INIT_SIGNATURE
  }

  return globalForDb.__actionExtractorDbReady
}

function toIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toISOString()
}

function parseDbInteger(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isFinite(parsed)) {
    return Math.max(0, parsed)
  }

  return 0
}

function parseDbNullableInteger(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value))
  }

  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isFinite(parsed)) {
    return Math.max(0, parsed)
  }

  return null
}

function parseDbNullableFloat(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const parsed = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getEstimatedStorageCostUsdPerByteMonth() {
  const raw = process.env.ACTION_EXTRACTOR_STORAGE_COST_USD_PER_GB_MONTH
  const parsed = Number.parseFloat(raw ?? '')
  const perGb = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  return perGb / (1024 * 1024 * 1024)
}

function normalizeWorkspaceRole(value: unknown): WorkspaceRole {
  if (value === 'owner') return 'owner'
  if (value === 'admin') return 'admin'
  if (value === 'viewer') return 'viewer'
  return 'member'
}

function normalizeWorkspaceInvitationStatus(value: unknown): WorkspaceInvitationStatus {
  if (value === 'accepted') return 'accepted'
  if (value === 'declined') return 'declined'
  if (value === 'expired') return 'expired'
  return 'pending'
}

function mapWorkspaceRow(row: DbWorkspaceRow): DbWorkspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    avatar_color: row.avatar_color,
    owner_user_id: row.owner_user_id,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapWorkspaceWithRoleRow(row: DbWorkspaceWithRoleRow): DbWorkspaceWithRole {
  return {
    ...mapWorkspaceRow(row),
    role: normalizeWorkspaceRole(row.role),
    member_count: parseDbInteger(row.member_count),
  }
}

function mapWorkspaceMemberRow(row: DbWorkspaceMemberRow): DbWorkspaceMember {
  return {
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    role: normalizeWorkspaceRole(row.role),
    joined_at: toIso(row.joined_at),
    user_name: row.user_name,
    user_email: row.user_email,
  }
}

function mapWorkspaceInvitationRow(row: DbWorkspaceInvitationRow): DbWorkspaceInvitation {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    invited_by_user_id: row.invited_by_user_id,
    email: row.email,
    role: normalizeWorkspaceRole(row.role),
    token: row.token,
    status: normalizeWorkspaceInvitationStatus(row.status),
    expires_at: toIso(row.expires_at),
    created_at: toIso(row.created_at),
    accepted_at: row.accepted_at ? toIso(row.accepted_at) : null,
    workspace_name: row.workspace_name,
    invited_by_name: row.invited_by_name,
  }
}

function normalizeExtractionShareVisibility(value: unknown): ExtractionShareVisibility {
  if (value === 'public') return 'public'
  if (value === 'unlisted') return 'unlisted'
  if (value === 'circle') return 'circle'
  return 'private'
}

function normalizeExtractionClonePermission(value: unknown): ExtractionClonePermission {
  if (value === 'template_only') return 'template_only'
  if (value === 'full') return 'full'
  return 'disabled'
}

function normalizeCommunityPostVisibility(value: unknown): CommunityPostVisibility {
  if (value === 'private') return 'private'
  if (value === 'circle') return 'circle'
  if (value === 'followers') return 'followers'
  return 'public'
}

function normalizeExtractionAccessRole(value: unknown): ExtractionAccessRole | null {
  if (value === 'owner') return 'owner'
  if (value === 'editor') return 'editor'
  if (value === 'viewer') return 'viewer'
  return null
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

function mapSessionRow(row: DbSessionWithUserRow): DbSessionWithUser {
  return {
    session_id: row.session_id,
    user_id: row.user_id,
    expires_at: toIso(row.expires_at),
    user_name: row.user_name,
    user_email: row.user_email,
    user_blocked_at: row.user_blocked_at ? toIso(row.user_blocked_at) : null,
  }
}

function mapAdminUserListRow(row: DbAdminUserListRow): AdminUserListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: toIso(row.created_at),
    email_verified_at: row.email_verified_at ? toIso(row.email_verified_at) : null,
    blocked_at: row.blocked_at ? toIso(row.blocked_at) : null,
    total_extractions: parseDbInteger(row.total_extractions),
    last_extraction_at: row.last_extraction_at ? toIso(row.last_extraction_at) : null,
    ai_calls: parseDbInteger(row.ai_calls),
    ai_input_tokens: Number(row.ai_input_tokens ?? 0),
    ai_output_tokens: Number(row.ai_output_tokens ?? 0),
    ai_cost_usd: Number(row.ai_cost_usd ?? 0),
  }
}

function mapExtractionRow(row: DbExtractionRow): DbExtraction {
  const orderNumber =
    row.order_number === null || row.order_number === undefined
      ? undefined
      : parseDbInteger(row.order_number)
  const shareVisibility = normalizeExtractionShareVisibility(row.share_visibility)
  const clonePermission = normalizeExtractionClonePermission(row.clone_permission)

  return {
    id: row.id,
    user_id: row.user_id,
    parent_extraction_id: row.parent_extraction_id ?? null,
    url: row.url ?? null,
    video_id: row.video_id,
    video_title: row.video_title,
    thumbnail_url: row.thumbnail_url,
    extraction_mode: row.extraction_mode || 'action_plan',
    objective: row.objective,
    phases_json: row.phases_json,
    pro_tip: row.pro_tip,
    metadata_json: row.metadata_json,
    share_visibility: shareVisibility,
    clone_permission: clonePermission,
    order_number: orderNumber,
    created_at: toIso(row.created_at),
    source_type: row.source_type ?? 'youtube',
    source_label: row.source_label ?? null,
    folder_id: row.folder_id ?? null,
    is_starred: row.is_starred === true,
    tags: (() => {
      try {
        const parsed = row.tags_json ? JSON.parse(row.tags_json) : []
        return Array.isArray(parsed) ? (parsed as DbExtractionTag[]) : []
      } catch {
        return []
      }
    })(),
    source_text: row.source_text ?? null,
    source_file_url: row.source_file_url ?? null,
    source_file_name: row.source_file_name ?? null,
    source_file_size_bytes: row.source_file_size_bytes != null ? Number(row.source_file_size_bytes) : null,
    source_file_mime_type: row.source_file_mime_type ?? null,
    has_source_text: row.has_source_text === true || !!(row.source_text && row.source_text.length > 0),
    transcript_source: row.transcript_source ?? null,
  }
}

function mapExtractionAdditionalSourceRow(row: DbExtractionAdditionalSourceRow): DbExtractionAdditionalSource {
  return {
    id: row.id,
    extraction_id: row.extraction_id,
    created_by_user_id: row.created_by_user_id,
    source_type: row.source_type,
    source_label: row.source_label ?? null,
    url: row.url ?? null,
    source_text: row.source_text ?? null,
    source_file_url: row.source_file_url ?? null,
    source_file_name: row.source_file_name ?? null,
    source_file_size_bytes: row.source_file_size_bytes != null ? Number(row.source_file_size_bytes) : null,
    source_file_mime_type: row.source_file_mime_type ?? null,
    analysis_status: row.analysis_status === 'analyzed' ? 'analyzed' : 'pending',
    analyzed_at: row.analyzed_at ? toIso(row.analyzed_at) : null,
    created_at: toIso(row.created_at),
  }
}

function mapExtractionFolderRow(row: DbExtractionFolderRow): DbExtractionFolder {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    parent_id: row.parent_id ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapVideoCacheRow(row: DbVideoCacheRow): DbVideoCache {
  return {
    video_id: row.video_id,
    video_title: row.video_title,
    thumbnail_url: row.thumbnail_url,
    objective: row.objective,
    phases_json: row.phases_json,
    pro_tip: row.pro_tip,
    metadata_json: row.metadata_json,
    transcript_text: row.transcript_text,
    prompt_version: row.prompt_version,
    model: row.model,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapNotionConnectionRow(row: DbNotionConnectionRow): DbNotionConnection {
  return {
    user_id: row.user_id,
    access_token: row.access_token,
    workspace_id: row.workspace_id,
    workspace_name: row.workspace_name,
    workspace_icon: row.workspace_icon,
    bot_id: row.bot_id,
    owner_user_id: row.owner_user_id,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapTrelloConnectionRow(row: DbTrelloConnectionRow): DbTrelloConnection {
  return {
    user_id: row.user_id,
    access_token: row.access_token,
    member_id: row.member_id,
    username: row.username,
    full_name: row.full_name,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapTodoistConnectionRow(row: DbTodoistConnectionRow): DbTodoistConnection {
  return {
    user_id: row.user_id,
    access_token: row.access_token,
    project_id: row.project_id,
    user_email: row.user_email,
    user_name: row.user_name,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapGoogleDocsConnectionRow(row: DbGoogleDocsConnectionRow): DbGoogleDocsConnection {
  return {
    user_id: row.user_id,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_expires_at: row.token_expires_at ? toIso(row.token_expires_at) : null,
    scope: row.scope,
    google_user_id: row.google_user_id,
    user_email: row.user_email,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    last_used_at: toIso(row.last_used_at),
  }
}

function mapExtractionTaskRow(row: DbExtractionTaskRow): DbExtractionTask {
  const parsedPhaseId =
    typeof row.phase_id === 'number' ? row.phase_id : Number.parseInt(String(row.phase_id), 10)
  const parsedItemIndex =
    typeof row.item_index === 'number' ? row.item_index : Number.parseInt(String(row.item_index), 10)
  const parsedDepth =
    typeof row.depth === 'number' ? row.depth : Number.parseInt(String(row.depth ?? ''), 10)
  const nodeId =
    typeof row.node_id === 'string' && row.node_id.trim()
      ? row.node_id.trim()
      : `p${Number.isFinite(parsedPhaseId) ? parsedPhaseId : 0}-i${Number.isFinite(parsedItemIndex) ? parsedItemIndex : 0}`
  const positionPath =
    typeof row.position_path === 'string' && row.position_path.trim()
      ? row.position_path.trim()
      : `${Number.isFinite(parsedPhaseId) ? parsedPhaseId : 0}.${(Number.isFinite(parsedItemIndex) ? parsedItemIndex : 0) + 1}`

  return {
    id: row.id,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    phase_id: Number.isFinite(parsedPhaseId) ? parsedPhaseId : 0,
    phase_title: row.phase_title,
    item_index: Number.isFinite(parsedItemIndex) ? parsedItemIndex : 0,
    item_text: row.item_text,
    node_id: nodeId,
    parent_node_id: row.parent_node_id ?? null,
    depth: Number.isFinite(parsedDepth) ? Math.max(1, parsedDepth) : 1,
    position_path: positionPath,
    checked: row.checked === true,
    status: row.status,
    numeric_value: parseDbNullableFloat(row.numeric_value),
    numeric_formula_json:
      typeof row.numeric_formula_json === 'string' && row.numeric_formula_json.trim()
        ? row.numeric_formula_json
        : '{}',
    due_at: row.due_at ? toIso(row.due_at) : null,
    completed_at: row.completed_at ? toIso(row.completed_at) : null,
    scheduled_start_at: row.scheduled_start_at ? toIso(row.scheduled_start_at) : null,
    scheduled_end_at: row.scheduled_end_at ? toIso(row.scheduled_end_at) : null,
    duration_days: typeof row.duration_days === 'number' ? row.duration_days : (Number.parseInt(String(row.duration_days ?? '1'), 10) || 1),
    flow_node_type: row.flow_node_type ?? 'process',
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapExtractionTaskEventRow(row: DbExtractionTaskEventRow): DbExtractionTaskEvent {
  return {
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    event_type: row.event_type,
    content: row.content,
    metadata_json: row.metadata_json,
    created_at: toIso(row.created_at),
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
  }
}

function normalizeCommunityPostAttachmentType(value: unknown): CommunityPostAttachmentType {
  if (value === 'image' || value === 'audio' || value === 'video' || value === 'file') return value
  return 'link'
}

function normalizeCommunityPostAttachmentStorageProvider(
  value: unknown
): CommunityPostAttachmentStorageProvider {
  return value === 'cloudinary' ? 'cloudinary' : 'external'
}

function parseCommunityPostAttachments(raw: unknown): DbCommunityPostAttachment[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      value = []
    }
  }

  if (!Array.isArray(value)) return []

  const normalized: DbCommunityPostAttachment[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    const url = typeof record.url === 'string' ? record.url.trim() : ''
    if (!id || !url) continue

    const createdAtRaw = record.created_at
    const updatedAtRaw = record.updated_at

    normalized.push({
      id,
      attachment_type: normalizeCommunityPostAttachmentType(record.attachment_type),
      storage_provider: normalizeCommunityPostAttachmentStorageProvider(record.storage_provider),
      url,
      thumbnail_url:
        typeof record.thumbnail_url === 'string' && record.thumbnail_url.trim()
          ? record.thumbnail_url.trim()
          : null,
      title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : null,
      mime_type:
        typeof record.mime_type === 'string' && record.mime_type.trim() ? record.mime_type.trim() : null,
      metadata_json:
        typeof record.metadata_json === 'string' && record.metadata_json.trim() ? record.metadata_json : '{}',
      created_at:
        typeof createdAtRaw === 'string' && createdAtRaw.trim() ? createdAtRaw : toIso(new Date()),
      updated_at:
        typeof updatedAtRaw === 'string' && updatedAtRaw.trim() ? updatedAtRaw : toIso(new Date()),
    })
  }

  return normalized
}

function mapCommunityPostRow(row: DbCommunityPostRow): DbCommunityPost {
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
    content: row.content,
    visibility: normalizeCommunityPostVisibility(row.visibility),
    metadata_json: row.metadata_json || '{}',
    source_extraction_id: row.source_extraction_id ?? null,
    source_task_id: row.source_task_id ?? null,
    source_label: row.source_label ?? null,
    reactions_count: parseDbInteger(row.reactions_count),
    comments_count: parseDbInteger(row.comments_count),
    views_count: parseDbInteger(row.views_count),
    reacted_by_me: row.reacted_by_me === true,
    following_author: row.following_author === true,
    attachments: parseCommunityPostAttachments(row.attachments_json),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapCommunityPostCommentRow(row: DbCommunityPostCommentRow): DbCommunityPostComment {
  return {
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
    content: row.content,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function normalizeChatMessageRole(value: unknown): ChatMessageRole {
  return value === 'assistant' ? 'assistant' : 'user'
}

function mapChatConversationRow(row: DbChatConversationRow): DbChatConversation {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    context_type: row.context_type ?? 'global',
    context_id: row.context_id ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

function mapChatMessageRow(row: DbChatMessageRow): DbChatMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    user_id: row.user_id,
    role: normalizeChatMessageRole(row.role),
    content: row.content,
    metadata_json: row.metadata_json || '{}',
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

const COMMUNITY_POST_CAN_VIEW_SQL = `
  (
    p.user_id = $1
    OR p.visibility = 'public'
    OR (
      p.visibility = 'followers'
      AND EXISTS (
        SELECT 1
        FROM community_follows cf
        WHERE
          cf.follower_user_id = $1
          AND cf.following_user_id = p.user_id
      )
    )
    OR (
      p.visibility = 'circle'
      AND EXISTS (
        SELECT 1
        FROM community_post_sources cps
        INNER JOIN extractions e ON e.id = cps.extraction_id
        LEFT JOIN extraction_members em
          ON em.extraction_id = e.id
         AND em.user_id = $1
        WHERE
          cps.post_id = p.id
          AND (
            e.user_id = $1
            OR em.user_id IS NOT NULL
          )
      )
    )
  )
`

const COMMUNITY_POST_SELECT_SQL = `
  SELECT
    p.id,
    p.user_id,
    u.name AS user_name,
    u.email AS user_email,
    p.content,
    p.visibility,
    p.metadata_json,
    src.extraction_id AS source_extraction_id,
    src.task_id AS source_task_id,
    src.source_label,
    COALESCE(rc.reactions_count, 0)::int AS reactions_count,
    COALESCE(cc.comments_count, 0)::int AS comments_count,
    COALESCE(vc.views_count, 0)::int AS views_count,
    COALESCE(rc.reacted_by_me, FALSE) AS reacted_by_me,
    COALESCE(att.attachments_json, '[]'::json) AS attachments_json,
    EXISTS (
      SELECT 1
      FROM community_follows cf
      WHERE
        cf.follower_user_id = $1
        AND cf.following_user_id = p.user_id
    ) AS following_author,
    p.created_at,
    p.updated_at
  FROM community_posts p
  INNER JOIN users u
    ON u.id = p.user_id
  LEFT JOIN LATERAL (
    SELECT
      cps.extraction_id,
      cps.task_id,
      cps.source_label
    FROM community_post_sources cps
    WHERE cps.post_id = p.id
    ORDER BY cps.created_at ASC, cps.id ASC
    LIMIT 1
  ) src ON TRUE
  LEFT JOIN (
    SELECT
      post_id,
      COUNT(*)::int AS reactions_count,
      BOOL_OR(user_id = $1) AS reacted_by_me
    FROM community_post_reactions
    GROUP BY post_id
  ) rc ON rc.post_id = p.id
  LEFT JOIN (
    SELECT
      post_id,
      COUNT(*)::int AS comments_count
    FROM community_post_comments
    GROUP BY post_id
  ) cc ON cc.post_id = p.id
  LEFT JOIN (
    SELECT
      post_id,
      COUNT(*)::int AS views_count
    FROM community_post_views
    GROUP BY post_id
  ) vc ON vc.post_id = p.id
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', a.id,
            'attachment_type', a.attachment_type,
            'storage_provider', a.storage_provider,
            'url', a.url,
            'thumbnail_url', a.thumbnail_url,
            'title', a.title,
            'mime_type', a.mime_type,
            'metadata_json', a.metadata_json,
            'created_at', a.created_at,
            'updated_at', a.updated_at
          )
          ORDER BY a.created_at ASC, a.id ASC
        ),
        '[]'::json
      ) AS attachments_json
    FROM community_post_attachments a
    WHERE a.post_id = p.id
  ) att ON TRUE
`

export async function ensureDbReady() {
  await getDbReadyPromise()
}

export async function findUserByEmail(email: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      SELECT id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  )
  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function findUserById(id: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      SELECT id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  )
  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function createUser(input: {
  name: string
  email: string
  passwordHash: string
  emailVerifiedAt?: Date | null
}) {
  await ensureDbReady()
  const id = randomUUID()
  const { rows } = await pool.query<DbUserRow>(
    `
      INSERT INTO users (id, name, email, password_hash, email_verified_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
    `,
    [
      id,
      input.name,
      input.email,
      input.passwordHash,
      input.emailVerifiedAt ? input.emailVerifiedAt.toISOString() : null,
    ]
  )
  return mapUserRow(rows[0])
}

export async function updateUserName(userId: string, name: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      UPDATE users
      SET name = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
    `,
    [name, userId]
  )

  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function deleteUserById(userId: string) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM users
      WHERE id = $1
    `,
    [userId]
  )

  return result.rowCount ?? 0
}

export async function createSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, input.userId, input.tokenHash, input.expiresAt.toISOString()]
  )
}

export async function findSessionWithUserByTokenHash(tokenHash: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbSessionWithUserRow>(
    `
      SELECT
        s.id AS session_id,
        s.user_id AS user_id,
        s.expires_at AS expires_at,
        u.name AS user_name,
        u.email AS user_email,
        u.blocked_at AS user_blocked_at
      FROM sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  )
  return rows[0] ? mapSessionRow(rows[0]) : null
}

export async function deleteSessionByTokenHash(tokenHash: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
}

export async function deleteSessionsByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId])
}

export async function deleteOtherSessionsByUserId(userId: string, currentTokenHash: string) {
  await ensureDbReady()
  await pool.query(
    'DELETE FROM sessions WHERE user_id = $1 AND token_hash != $2',
    [userId, currentTokenHash]
  )
}

export async function deleteExpiredSessions() {
  await ensureDbReady()
  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()')
}

export async function createExtraction(input: {
  id?: string
  userId: string
  parentExtractionId?: string | null
  url: string | null
  videoId: string | null
  videoTitle: string | null
  thumbnailUrl: string | null
  extractionMode: string
  objective: string
  phasesJson: string
  proTip: string
  metadataJson: string
  sourceType?: string
  sourceLabel?: string | null
  sourceText?: string | null
  sourceFileUrl?: string | null
  sourceFileName?: string | null
  sourceFileSizeBytes?: number | null
  sourceFileMimeType?: string | null
  transcriptSource?: string | null
  folderId?: string | null
  shareVisibility?: ExtractionShareVisibility
  clonePermission?: ExtractionClonePermission
}) {
  await ensureDbReady()
  await ensureDefaultExtractionFoldersForUser(input.userId)
  const id = input.id ?? randomUUID()
  const sourceType = input.sourceType ?? 'youtube'
  const defaultFolderId = buildSystemExtractionFolderIdForUser({
    userId: input.userId,
    key: 'general',
  })
  const resolvedFolderId = input.folderId?.trim() || defaultFolderId
  const resolvedShareVisibility = input.shareVisibility ?? 'private'
  const resolvedClonePermission = input.clonePermission ?? 'disabled'
  const { rows } = await pool.query<DbExtractionRow>(
    `
      INSERT INTO extractions (
        id,
        user_id,
        parent_extraction_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        share_visibility,
        clone_permission,
        source_type,
        source_label,
        folder_id,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        transcript_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING
        id,
        user_id,
        parent_extraction_id,
        url,
        video_id,
        video_title,
        thumbnail_url,
        extraction_mode,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        share_visibility,
        clone_permission,
        created_at,
        source_type,
        source_label,
        folder_id,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        transcript_source
    `,
    [
      id,
      input.userId,
      input.parentExtractionId ?? null,
      input.url,
      input.videoId,
      input.videoTitle,
      input.thumbnailUrl,
      input.extractionMode,
      input.objective,
      input.phasesJson,
      input.proTip,
      input.metadataJson,
      resolvedShareVisibility,
      resolvedClonePermission,
      sourceType,
      input.sourceLabel ?? null,
      resolvedFolderId,
      input.sourceText ?? null,
      input.sourceFileUrl ?? null,
      input.sourceFileName ?? null,
      input.sourceFileSizeBytes ?? null,
      input.sourceFileMimeType ?? null,
      input.transcriptSource ?? null,
    ]
  )

  return mapExtractionRow(rows[0])
}

// Returns source metadata for an extraction, checking access permissions.
// Access is granted if: user is owner, user is a circle member, or visibility is public/unlisted.
export async function getExtractionSourceData(input: {
  extractionId: string
  requestingUserId: string | null
}): Promise<{
  sourceType: string
  sourceLabel: string | null
  url: string | null
  videoId: string | null
  thumbnailUrl: string | null
  videoTitle: string | null
  sourceText: string | null
  sourceFileUrl: string | null
  sourceFileName: string | null
  sourceFileSizeBytes: number | null
  sourceFileMimeType: string | null
  shareVisibility: ExtractionShareVisibility
  userId: string
} | null> {
  const { getExtractionSourceData: getExtractionSourceDataInModule } = await import('@/lib/db/extractions')
  return getExtractionSourceDataInModule(input)
}

export async function listExtractionAdditionalSources(input: {
  extractionId: string
  requestingUserId: string | null
}): Promise<DbExtractionAdditionalSource[] | null> {
  const { listExtractionAdditionalSources: listExtractionAdditionalSourcesInModule } = await import(
    '@/lib/db/extractions'
  )
  return listExtractionAdditionalSourcesInModule(input)
}

export async function createExtractionAdditionalSourceForUser(input: {
  extractionId: string
  userId: string
  sourceType: 'youtube' | 'web_url' | 'pdf' | 'docx' | 'text'
  sourceLabel: string | null
  url: string | null
  sourceText?: string | null
  sourceFileUrl?: string | null
  sourceFileName?: string | null
  sourceFileSizeBytes?: number | null
  sourceFileMimeType?: string | null
  analysisStatus?: 'pending' | 'analyzed'
  analyzedAt?: string | null
}): Promise<DbExtractionAdditionalSource | null> {
  const { createExtractionAdditionalSourceForUser: createExtractionAdditionalSourceForUserInModule } =
    await import('@/lib/db/extractions')
  return createExtractionAdditionalSourceForUserInModule(input)
}

export async function deleteExtractionAdditionalSourceForUser(input: {
  extractionId: string
  sourceId: string
  userId: string
}): Promise<boolean> {
  const { deleteExtractionAdditionalSourceForUser: deleteExtractionAdditionalSourceForUserInModule } =
    await import('@/lib/db/extractions')
  return deleteExtractionAdditionalSourceForUserInModule(input)
}

export async function markExtractionAdditionalSourcesAnalyzedForUser(input: {
  extractionId: string
  userId: string
  sourceIds: string[]
}) {
  const {
    markExtractionAdditionalSourcesAnalyzedForUser: markExtractionAdditionalSourcesAnalyzedForUserInModule,
  } = await import('@/lib/db/extractions')
  return markExtractionAdditionalSourcesAnalyzedForUserInModule(input)
}

// Returns the full transcript for a YouTube video from the shared cache.
export async function getVideoCacheTranscript(videoId: string): Promise<string | null> {
  await ensureDbReady()
  const { rows } = await pool.query<{ transcript_text: string | null }>(
    `SELECT transcript_text FROM video_cache WHERE video_id = $1 LIMIT 1`,
    [videoId]
  )
  return rows[0]?.transcript_text ?? null
}

export async function listExtractionsByUser(userId: string, limit = 30) {
  const { listExtractionsByUser: listExtractionsByUserInModule } = await import('@/lib/db/extractions')
  return listExtractionsByUserInModule(userId, limit)
}

export async function listAdminExtractionsByUser(
  userId: string,
  limit = 30
): Promise<AdminUserExtractionCostDetail[]> {
  const { listAdminExtractionsByUser: listAdminExtractionsByUserInModule } = await import(
    '@/lib/db/extractions'
  )
  return listAdminExtractionsByUserInModule(userId, limit)
}

export async function setExtractionStarredForUser(input: {
  id: string
  userId: string
  starred: boolean
}): Promise<DbExtraction | null> {
  const {
    setExtractionStarredForUser: setExtractionStarredForUserInModule,
  } = await import('@/lib/db/extractions')
  return setExtractionStarredForUserInModule(input)
}

export async function assignUnfolderedExtractionsToGeneralForUser(userId: string) {
  const {
    assignUnfolderedExtractionsToGeneralForUser: assignUnfolderedExtractionsToGeneralForUserInModule,
  } = await import('@/lib/db/extractions')
  return assignUnfolderedExtractionsToGeneralForUserInModule(userId)
}

export async function listCircleExtractionsForMember(userId: string, limit = 30) {
  const {
    listCircleExtractionsForMember: listCircleExtractionsForMemberInModule,
  } = await import('@/lib/db/extractions')
  return listCircleExtractionsForMemberInModule(userId, limit)
}

export async function listExtractionsSharedViaFoldersForMember(userId: string, limit = 80) {
  const {
    listExtractionsSharedViaFoldersForMember: listExtractionsSharedViaFoldersForMemberInModule,
  } = await import('@/lib/db/extractions')
  return listExtractionsSharedViaFoldersForMemberInModule(userId, limit)
}

export async function findExtractionOrderNumberForUser(input: { id: string; userId: string }) {
  const { findExtractionOrderNumberForUser: findExtractionOrderNumberForUserInModule } = await import(
    '@/lib/db/extractions'
  )
  return findExtractionOrderNumberForUserInModule(input)
}

export async function deleteExtractionByIdForUser(input: { id: string; userId: string }) {
  const {
    deleteExtractionByIdForUser: deleteExtractionByIdForUserInModule,
  } = await import('@/lib/db/extractions')
  return deleteExtractionByIdForUserInModule(input)
}

export async function deleteExtractionsByUser(userId: string) {
  const { deleteExtractionsByUser: deleteExtractionsByUserInModule } = await import('@/lib/db/extractions')
  return deleteExtractionsByUserInModule(userId)
}

export async function findExtractionById(id: string) {
  const { findExtractionById: findExtractionByIdInModule } = await import('@/lib/db/extractions')
  return findExtractionByIdInModule(id)
}

export async function findPublicExtractionById(id: string) {
  const {
    findPublicExtractionById: findPublicExtractionByIdInModule,
  } = await import('@/lib/db/extractions')
  return findPublicExtractionByIdInModule(id)
}

export async function listPublicExtractionsForSearch(input: { query: string; limit: number }) {
  const {
    listPublicExtractionsForSearch: listPublicExtractionsForSearchInModule,
  } = await import('@/lib/db/extractions')
  return listPublicExtractionsForSearchInModule(input)
}

export async function findExtractionAccessForUser(input: { id: string; userId: string }) {
  const { findExtractionAccessForUser: findExtractionAccessForUserInModule } = await import(
    '@/lib/db/extractions'
  )
  return findExtractionAccessForUserInModule(input)
}

export async function findCloneableExtractionAccessForUser(input: { id: string; userId: string }) {
  const {
    findCloneableExtractionAccessForUser: findCloneableExtractionAccessForUserInModule,
  } = await import('@/lib/db/extractions')
  return findCloneableExtractionAccessForUserInModule(input)
}

export interface DbPlaybookLineageNode {
  depth: number
  isCurrent: boolean
  isOriginal: boolean
  accessible: boolean
  title: string | null
  ownerName: string | null
  ownerEmail: string | null
  createdAt: string | null
}

export interface DbPlaybookRecentCopy {
  depth: number
  title: string
  copiedByName: string | null
  copiedByEmail: string | null
  createdAt: string
  copiedFromTitle: string | null
}

export interface DbPlaybookLineageData {
  generation: number
  nodes: DbPlaybookLineageNode[]
  copies:
    | {
        directCount: number
        totalCount: number
        recent: DbPlaybookRecentCopy[]
      }
    | null
}

export async function buildExtractionLineageForUser(input: {
  extractionId: string
  userId: string
  includeCopyStats: boolean
}) {
  const {
    buildExtractionLineageForUser: buildExtractionLineageForUserInModule,
  } = await import('@/lib/db/extractions')
  return buildExtractionLineageForUserInModule(input)
}

export async function findExtractionByIdForUser(input: { id: string; userId: string }) {
  const { findExtractionByIdForUser: findExtractionByIdForUserInModule } = await import('@/lib/db/extractions')
  return findExtractionByIdForUserInModule(input)
}

export async function listExtractionMembersForOwner(input: { extractionId: string; ownerUserId: string }) {
  const {
    listExtractionMembersForOwner: listExtractionMembersForOwnerInModule,
  } = await import('@/lib/db/extractions')
  return listExtractionMembersForOwnerInModule(input)
}

export async function upsertExtractionMemberForOwner(input: {
  extractionId: string
  ownerUserId: string
  memberUserId: string
  role: ExtractionMemberRole
}) {
  const {
    upsertExtractionMemberForOwner: upsertExtractionMemberForOwnerInModule,
  } = await import('@/lib/db/extractions')
  return upsertExtractionMemberForOwnerInModule(input)
}

export async function removeExtractionMemberForOwner(input: {
  extractionId: string
  ownerUserId: string
  memberUserId: string
}) {
  const {
    removeExtractionMemberForOwner: removeExtractionMemberForOwnerInModule,
  } = await import('@/lib/db/extractions')
  return removeExtractionMemberForOwnerInModule(input)
}

export async function listExtractionFolderMembersForOwner(input: {
  folderId: string
  ownerUserId: string
}) {
  const {
    listExtractionFolderMembersForOwner: listExtractionFolderMembersForOwnerInModule,
  } = await import('@/lib/db/extractions')
  return listExtractionFolderMembersForOwnerInModule(input)
}

export async function upsertExtractionFolderMemberForOwner(input: {
  folderId: string
  ownerUserId: string
  memberUserId: string
  role: ExtractionFolderMemberRole
}) {
  const {
    upsertExtractionFolderMemberForOwner: upsertExtractionFolderMemberForOwnerInModule,
  } = await import('@/lib/db/extractions')
  return upsertExtractionFolderMemberForOwnerInModule(input)
}

export async function removeExtractionFolderMemberForOwner(input: {
  folderId: string
  ownerUserId: string
  memberUserId: string
}) {
  const {
    removeExtractionFolderMemberForOwner: removeExtractionFolderMemberForOwnerInModule,
  } = await import('@/lib/db/extractions')
  return removeExtractionFolderMemberForOwnerInModule(input)
}

export async function listSharedExtractionFoldersForMember(userId: string) {
  const {
    listSharedExtractionFoldersForMember: listSharedExtractionFoldersForMemberInModule,
  } = await import('@/lib/db/extractions')
  return listSharedExtractionFoldersForMemberInModule(userId)
}

export async function updateExtractionShareVisibilityForUser(input: {
  id: string
  userId: string
  shareVisibility: ExtractionShareVisibility
}) {
  const {
    updateExtractionShareVisibilityForUser: updateExtractionShareVisibilityForUserInModule,
  } = await import('@/lib/db/extractions')
  return updateExtractionShareVisibilityForUserInModule(input)
}

export async function updateExtractionClonePermissionForUser(input: {
  id: string
  userId: string
  clonePermission: ExtractionClonePermission
}) {
  const {
    updateExtractionClonePermissionForUser: updateExtractionClonePermissionForUserInModule,
  } = await import('@/lib/db/extractions')
  return updateExtractionClonePermissionForUserInModule(input)
}

export async function updateExtractionPhasesForUser(input: {
  id: string
  userId: string
  phasesJson: string
}) {
  const {
    updateExtractionPhasesForUser: updateExtractionPhasesForUserInModule,
  } = await import('@/lib/db/extractions')
  return updateExtractionPhasesForUserInModule(input)
}

export async function updateExtractionGeneratedContentForUser(input: {
  id: string
  userId: string
  objective: string
  phasesJson: string
  proTip: string
  metadataJson: string
}) {
  const {
    updateExtractionGeneratedContentForUser: updateExtractionGeneratedContentForUserInModule,
  } = await import('@/lib/db/extractions')
  return updateExtractionGeneratedContentForUserInModule(input)
}

export async function updateExtractionMetaForUser(input: {
  id: string
  userId: string
  videoTitle: string
  sourceLabel: string
  thumbnailUrl: string | null
  objective: string
}) {
  const {
    updateExtractionMetaForUser: updateExtractionMetaForUserInModule,
  } = await import('@/lib/db/extractions')
  return updateExtractionMetaForUserInModule(input)
}

export async function cloneExtractionForUser(input: {
  sourceExtractionId: string
  targetUserId: string
  folderId?: string | null
  mode: 'full' | 'template'
  name: string
}) {
  const { cloneExtractionForUser: cloneExtractionForUserInModule } = await import('@/lib/db/extractions')
  return cloneExtractionForUserInModule(input)
}

export async function listExtractionFoldersByUser(userId: string) {
  const { listExtractionFoldersByUser: listExtractionFoldersByUserInModule } =
    await import('@/lib/db/extractions')
  return listExtractionFoldersByUserInModule(userId)
}

export async function ensureDefaultExtractionFoldersForUser(userId: string) {
  await ensureDbReady()

  const systemFolders = listSystemExtractionFoldersForUser(userId)
  if (systemFolders.length === 0) return [] as DbExtractionFolder[]

  const values: string[] = []
  const placeholders = systemFolders.map((folder, index) => {
    const offset = index * 4
    values.push(folder.id, userId, folder.name, folder.color)
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, NULL)`
  })

  const { rows } = await pool.query<DbExtractionFolderRow>(
    `
      INSERT INTO extraction_folders (
        id,
        user_id,
        name,
        color,
        parent_id
      )
      VALUES
        ${placeholders.join(',\n        ')}
      ON CONFLICT (id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        name = EXCLUDED.name,
        color = EXCLUDED.color,
        parent_id = NULL,
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        name,
        color,
        parent_id,
        created_at,
        updated_at
    `,
    values
  )

  return rows.map(mapExtractionFolderRow)
}

export async function findExtractionFolderByIdForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionFolderRow>(
    `
      SELECT
        id,
        user_id,
        name,
        color,
        parent_id,
        created_at,
        updated_at
      FROM extraction_folders
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [input.id, input.userId]
  )
  return rows[0] ? mapExtractionFolderRow(rows[0]) : null
}

export async function createExtractionFolderForUser(input: {
  userId: string
  name: string
  color: string
  parentId: string | null
  id?: string
}) {
  const { createExtractionFolderForUser: createExtractionFolderForUserInModule } =
    await import('@/lib/db/extractions')
  return createExtractionFolderForUserInModule(input)
}

export async function deleteExtractionFolderTreeForUser(input: { id: string; userId: string }) {
  const { deleteExtractionFolderTreeForUser: deleteExtractionFolderTreeForUserInModule } =
    await import('@/lib/db/extractions')
  return deleteExtractionFolderTreeForUserInModule(input)
}

export async function updateExtractionFolderForUser(input: {
  id: string
  userId: string
  folderId: string | null
}): Promise<boolean> {
  const { updateExtractionFolderForUser: updateExtractionFolderForUserInModule } =
    await import('@/lib/db/extractions')
  return updateExtractionFolderForUserInModule(input)
}

export async function findOrCreateChatConversationForUser(userId: string) {
  await ensureDbReady()

  // Find the most recent global conversation for this user
  const { rows: existing } = await pool.query<DbChatConversationRow>(
    `
      SELECT id, user_id, title, context_type, context_id, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = $1 AND context_type = 'global'
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [userId]
  )

  if (existing[0]) return mapChatConversationRow(existing[0])

  // Create a new global conversation if none exists
  const { rows } = await pool.query<DbChatConversationRow>(
    `
      INSERT INTO chat_conversations (id, user_id, title, context_type)
      VALUES ($1, $2, 'Asistente de Contenidos', 'global')
      RETURNING id, user_id, title, context_type, context_id, created_at, updated_at
    `,
    [randomUUID(), userId]
  )

  return rows[0] ? mapChatConversationRow(rows[0]) : null
}

export async function listChatConversationsForUser(userId: string, limit = 30) {
  await ensureDbReady()
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)))
  const { rows } = await pool.query<DbChatConversationRow>(
    `
      SELECT id, user_id, title, context_type, context_id, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `,
    [userId, safeLimit]
  )
  return rows.map(mapChatConversationRow)
}

export async function findChatConversationByContextForUser(input: {
  userId: string
  contextType: string
  contextId: string
}) {
  await ensureDbReady()
  const contextType = input.contextType.trim()
  const contextId = input.contextId.trim()
  if (!contextType || !contextId) return null

  const { rows } = await pool.query<DbChatConversationRow>(
    `
      SELECT id, user_id, title, context_type, context_id, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = $1 AND context_type = $2 AND context_id = $3
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [input.userId, contextType, contextId]
  )

  return rows[0] ? mapChatConversationRow(rows[0]) : null
}

export async function createChatConversationForUser(input: {
  userId: string
  title?: string
  contextType?: string
  contextId?: string
}) {
  await ensureDbReady()
  const title = input.title?.trim() || 'Nueva conversación'
  const contextType = input.contextType?.trim() || 'global'
  const contextId = input.contextId?.trim() || null

  const { rows } = await pool.query<DbChatConversationRow>(
    `
      INSERT INTO chat_conversations (id, user_id, title, context_type, context_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, title, context_type, context_id, created_at, updated_at
    `,
    [randomUUID(), input.userId, title, contextType, contextId]
  )
  return rows[0] ? mapChatConversationRow(rows[0]) : null
}

export async function renameChatConversationForUser(input: {
  userId: string
  conversationId: string
  title: string
}) {
  await ensureDbReady()
  const title = input.title.trim()
  if (!title) return null
  const { rows } = await pool.query<DbChatConversationRow>(
    `
      UPDATE chat_conversations
      SET title = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, title, context_type, context_id, created_at, updated_at
    `,
    [input.conversationId, input.userId, title]
  )
  return rows[0] ? mapChatConversationRow(rows[0]) : null
}

export async function deleteChatConversationForUser(input: {
  userId: string
  conversationId: string
}) {
  await ensureDbReady()
  const result = await pool.query(
    `DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2`,
    [input.conversationId, input.userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function listChatMessagesForUser(input: {
  userId: string
  conversationId?: string
  limit?: number
}) {
  await ensureDbReady()
  const limit = Number.isFinite(input.limit)
    ? Math.min(200, Math.max(1, Math.trunc(input.limit ?? 60)))
    : 60

  let conversationId = input.conversationId?.trim() || ''
  if (!conversationId) {
    const conversation = await findOrCreateChatConversationForUser(input.userId)
    if (!conversation) return [] as DbChatMessage[]
    conversationId = conversation.id
  }

  const { rows } = await pool.query<DbChatMessageRow>(
    `
      SELECT m.id, m.conversation_id, m.user_id, m.role, m.content,
             m.metadata_json, m.created_at, m.updated_at
      FROM (
        SELECT id, conversation_id, user_id, role, content, metadata_json, created_at, updated_at
        FROM chat_messages
        WHERE conversation_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      ) AS m
      ORDER BY m.created_at ASC
    `,
    [conversationId, input.userId, limit]
  )

  return rows.map(mapChatMessageRow)
}

export async function createChatMessageForUser(input: {
  userId: string
  role: ChatMessageRole
  content: string
  metadataJson?: string
  conversationId?: string
}) {
  await ensureDbReady()
  const content = input.content.trim()
  if (!content) return null

  let resolvedConversationId = input.conversationId?.trim() || ''
  if (!resolvedConversationId) {
    const conversation = await findOrCreateChatConversationForUser(input.userId)
    if (!conversation) return null
    resolvedConversationId = conversation.id
  }

  const { rows } = await pool.query<DbChatMessageRow>(
    `
      INSERT INTO chat_messages (
        id,
        conversation_id,
        user_id,
        role,
        content,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        conversation_id,
        user_id,
        role,
        content,
        metadata_json,
        created_at,
        updated_at
    `,
    [
      randomUUID(),
      resolvedConversationId,
      input.userId,
      input.role,
      content,
      input.metadataJson ?? '{}',
    ]
  )

  await pool.query(
    `
      UPDATE chat_conversations
      SET updated_at = NOW()
      WHERE id = $1
    `,
    [resolvedConversationId]
  )

  return rows[0] ? mapChatMessageRow(rows[0]) : null
}

export async function clearChatMessagesForUser(userId: string, conversationId?: string) {
  await ensureDbReady()
  const resolvedId = conversationId?.trim() || ''

  let result
  if (resolvedId) {
    result = await pool.query(
      `DELETE FROM chat_messages WHERE user_id = $1 AND conversation_id = $2`,
      [userId, resolvedId]
    )
    await pool.query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`,
      [resolvedId]
    )
  } else {
    result = await pool.query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId])
    await pool.query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE user_id = $1`,
      [userId]
    )
  }

  return result.rowCount ?? 0
}

export async function syncExtractionTasksForUser(input: {
  userId: string
  extractionId: string
  phases: unknown
}) {
  const { syncExtractionTasksForUser: syncExtractionTasksForUserInModule } = await import('@/lib/db/extractions')
  return syncExtractionTasksForUserInModule(input)
}

export async function listExtractionTasksWithEventsForUser(input: { extractionId: string }) {
  const { listExtractionTasksWithEventsForUser: listExtractionTasksWithEventsForUserInModule } =
    await import('@/lib/db/extractions')
  return listExtractionTasksWithEventsForUserInModule(input)
}

export async function listExtractionTasksWithEventsForSharedExtraction(extractionId: string) {
  const {
    listExtractionTasksWithEventsForSharedExtraction:
      listExtractionTasksWithEventsForSharedExtractionInModule,
  } = await import('@/lib/db/extractions')
  return listExtractionTasksWithEventsForSharedExtractionInModule(extractionId)
}

export async function findExtractionTaskByIdForUser(input: {
  taskId: string
  extractionId: string
}) {
  const { findExtractionTaskByIdForUser: findExtractionTaskByIdForUserInModule } =
    await import('@/lib/db/extractions')
  return findExtractionTaskByIdForUserInModule(input)
}

export async function updateExtractionTaskStateForUser(input: {
  taskId: string
  extractionId: string
  checked: boolean
  status: ExtractionTaskStatus
  numericValue: number | null
  numericFormulaJson: string
}) {
  const { updateExtractionTaskStateForUser: updateExtractionTaskStateForUserInModule } =
    await import('@/lib/db/extractions')
  return updateExtractionTaskStateForUserInModule(input)
}

export async function updateExtractionTaskScheduleForUser(input: {
  taskId: string
  extractionId: string
  scheduledStartAt: string | null
  scheduledEndAt: string | null
}): Promise<DbExtractionTask | null> {
  const { updateExtractionTaskScheduleForUser: updateExtractionTaskScheduleForUserInModule } =
    await import('@/lib/db/extractions')
  return updateExtractionTaskScheduleForUserInModule(input)
}

export async function listExtractionTaskDependencies(
  extractionId: string
): Promise<Map<string, string[]>> {
  const {
    listExtractionTaskDependencies: listExtractionTaskDependenciesInModule,
  } = await import('@/lib/db/extractions')
  return listExtractionTaskDependenciesInModule(extractionId)
}

export async function updateExtractionTaskPlanningForUser(input: {
  taskId: string
  extractionId: string
  durationDays: number
  predecessorIds: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const {
    updateExtractionTaskPlanningForUser: updateExtractionTaskPlanningForUserInModule,
  } = await import('@/lib/db/extractions')
  return updateExtractionTaskPlanningForUserInModule(input)
}

export async function updateExtractionTaskStatusCatalogById(input: {
  extractionId: string
  taskStatusCatalog: string[]
}) {
  const {
    updateExtractionTaskStatusCatalogById: updateExtractionTaskStatusCatalogByIdInModule,
  } = await import('@/lib/db/extractions')
  return updateExtractionTaskStatusCatalogByIdInModule(input)
}

export async function replaceExtractionTaskStatusForExtraction(input: {
  extractionId: string
  previousStatus: ExtractionTaskStatus
  nextStatus: ExtractionTaskStatus
}) {
  const {
    replaceExtractionTaskStatusForExtraction: replaceExtractionTaskStatusForExtractionInModule,
  } = await import('@/lib/db/extractions')
  return replaceExtractionTaskStatusForExtractionInModule(input)
}

export async function createExtractionTaskEventForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  eventType: ExtractionTaskEventType
  content: string
  metadataJson?: string
}) {
  const { createExtractionTaskEventForUser: createExtractionTaskEventForUserInModule } =
    await import('@/lib/db/extractions')
  return createExtractionTaskEventForUserInModule(input)
}

export async function listExtractionTaskAttachmentsForUser(input: {
  taskId: string
  extractionId: string
}) {
  const { listExtractionTaskAttachmentsForUser: listExtractionTaskAttachmentsForUserInModule } =
    await import('@/lib/db/extractions')
  return listExtractionTaskAttachmentsForUserInModule(input)
}

export async function listExtractionTaskAttachmentsForSharedExtraction(extractionId: string) {
  const {
    listExtractionTaskAttachmentsForSharedExtraction:
      listExtractionTaskAttachmentsForSharedExtractionInModule,
  } = await import('@/lib/db/extractions')
  return listExtractionTaskAttachmentsForSharedExtractionInModule(extractionId)
}

export async function createExtractionTaskAttachmentForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  attachmentType: ExtractionTaskAttachmentType
  storageProvider: ExtractionTaskAttachmentStorageProvider
  url: string
  thumbnailUrl?: string | null
  title?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  metadataJson?: string
}) {
  const { createExtractionTaskAttachmentForUser: createExtractionTaskAttachmentForUserInModule } =
    await import('@/lib/db/extractions')
  return createExtractionTaskAttachmentForUserInModule(input)
}

export async function deleteExtractionTaskAttachmentByIdForUser(input: {
  attachmentId: string
  taskId: string
  extractionId: string
}) {
  const {
    deleteExtractionTaskAttachmentByIdForUser: deleteExtractionTaskAttachmentByIdForUserInModule,
  } = await import('@/lib/db/extractions')
  return deleteExtractionTaskAttachmentByIdForUserInModule(input)
}

export async function listExtractionTaskCommentsForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  const { listExtractionTaskCommentsForUser: listExtractionTaskCommentsForUserInModule } =
    await import('@/lib/db/extractions')
  return listExtractionTaskCommentsForUserInModule(input)
}

export async function createExtractionTaskCommentForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  content: string
  parentCommentId?: string | null
}) {
  const { createExtractionTaskCommentForUser: createExtractionTaskCommentForUserInModule } =
    await import('@/lib/db/extractions')
  return createExtractionTaskCommentForUserInModule(input)
}

export async function deleteExtractionTaskCommentByIdForUser(input: {
  commentId: string
  taskId: string
  extractionId: string
  userId: string
}) {
  const {
    deleteExtractionTaskCommentByIdForUser: deleteExtractionTaskCommentByIdForUserInModule,
  } = await import('@/lib/db/extractions')
  return deleteExtractionTaskCommentByIdForUserInModule(input)
}

export async function setExtractionTaskCommentHiddenByOwner(input: {
  commentId: string
  taskId: string
  extractionId: string
  ownerUserId: string
  hidden: boolean
}) {
  const {
    setExtractionTaskCommentHiddenByOwner: setExtractionTaskCommentHiddenByOwnerInModule,
  } = await import('@/lib/db/extractions')
  return setExtractionTaskCommentHiddenByOwnerInModule(input)
}

export async function getExtractionTaskLikeSummaryForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  const { getExtractionTaskLikeSummaryForUser: getExtractionTaskLikeSummaryForUserInModule } =
    await import('@/lib/db/extractions')
  return getExtractionTaskLikeSummaryForUserInModule(input)
}

export async function toggleExtractionTaskLikeForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  const { toggleExtractionTaskLikeForUser: toggleExtractionTaskLikeForUserInModule } =
    await import('@/lib/db/extractions')
  return toggleExtractionTaskLikeForUserInModule(input)
}

export async function toggleExtractionTaskFollowForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  const { toggleExtractionTaskFollowForUser: toggleExtractionTaskFollowForUserInModule } =
    await import('@/lib/db/extractions')
  return toggleExtractionTaskFollowForUserInModule(input)
}

export async function recordExtractionTaskShareForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  const { recordExtractionTaskShareForUser: recordExtractionTaskShareForUserInModule } =
    await import('@/lib/db/extractions')
  return recordExtractionTaskShareForUserInModule(input)
}

export async function recordExtractionTaskViewForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  const { recordExtractionTaskViewForUser: recordExtractionTaskViewForUserInModule } =
    await import('@/lib/db/extractions')
  return recordExtractionTaskViewForUserInModule(input)
}

export async function createOrGetShareToken(input: { extractionId: string; userId: string }) {
  const { createOrGetShareToken: createOrGetShareTokenInModule } =
    await import('@/lib/db/extractions')
  return createOrGetShareTokenInModule(input)
}

export async function findSharedExtractionByToken(token: string) {
  const { findSharedExtractionByToken: findSharedExtractionByTokenInModule } =
    await import('@/lib/db/extractions')
  return findSharedExtractionByTokenInModule(token)
}

export interface CreateCommunityPostAttachmentInput {
  attachmentType: CommunityPostAttachmentType
  storageProvider: CommunityPostAttachmentStorageProvider
  url: string
  thumbnailUrl?: string | null
  title?: string | null
  mimeType?: string | null
  metadataJson?: string
}

export interface CreateCommunityPostInput {
  userId: string
  content: string
  visibility: CommunityPostVisibility
  metadataJson?: string
  source?: {
    extractionId?: string | null
    taskId?: string | null
    sourceLabel?: string | null
  } | null
  attachments?: CreateCommunityPostAttachmentInput[]
}

function normalizeQueryLimit(value: number | undefined, fallback = 20, max = 100) {
  if (!Number.isFinite(value)) return fallback
  const parsed = Math.trunc(value as number)
  if (parsed <= 0) return fallback
  return Math.min(parsed, max)
}

export async function getCommunityPostAccessForUser(input: { postId: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<{
    id: string
    user_id: string
    visibility: string
    can_view: boolean | null
  }>(
    `
      SELECT
        p.id,
        p.user_id,
        p.visibility,
        ${COMMUNITY_POST_CAN_VIEW_SQL} AS can_view
      FROM community_posts p
      WHERE p.id = $2
      LIMIT 1
    `,
    [input.userId, input.postId]
  )

  const row = rows[0]
  if (!row) {
    return {
      post: null,
      can_view: false,
    }
  }

  return {
    post: {
      id: row.id,
      user_id: row.user_id,
      visibility: normalizeCommunityPostVisibility(row.visibility),
    },
    can_view: row.can_view === true,
  }
}

export async function findCommunityPostByIdForUser(input: { postId: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        p.id = $2
        AND ${COMMUNITY_POST_CAN_VIEW_SQL}
      LIMIT 1
    `,
    [input.userId, input.postId]
  )
  return rows[0] ? mapCommunityPostRow(rows[0]) : null
}

export async function listCommunityExplorePostsForUser(input: {
  userId: string
  limit?: number
}) {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 20, 100)

  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        ${COMMUNITY_POST_CAN_VIEW_SQL}
        AND p.visibility = 'public'
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $2
    `,
    [input.userId, safeLimit]
  )

  return rows.map(mapCommunityPostRow)
}

export async function listCommunityHomePostsForUser(input: {
  userId: string
  limit?: number
}) {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 20, 100)

  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        ${COMMUNITY_POST_CAN_VIEW_SQL}
        AND (
          p.user_id = $1
          OR p.visibility = 'circle'
          OR EXISTS (
            SELECT 1
            FROM community_follows cf
            WHERE
              cf.follower_user_id = $1
              AND cf.following_user_id = p.user_id
          )
        )
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $2
    `,
    [input.userId, safeLimit]
  )

  return rows.map(mapCommunityPostRow)
}

export async function listCommunityPostsByExtractionForUser(input: {
  userId: string
  extractionId: string
  limit?: number
}) {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 20, 100)

  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        ${COMMUNITY_POST_CAN_VIEW_SQL}
        AND EXISTS (
          SELECT 1
          FROM community_post_sources cps
          WHERE
            cps.post_id = p.id
            AND cps.extraction_id = $2
        )
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $3
    `,
    [input.userId, input.extractionId, safeLimit]
  )

  return rows.map(mapCommunityPostRow)
}

export async function createCommunityPostForUser(input: CreateCommunityPostInput) {
  await ensureDbReady()

  const client = await pool.connect()
  const postId = randomUUID()
  try {
    await client.query('BEGIN')

    await client.query(
      `
        INSERT INTO community_posts (
          id,
          user_id,
          content,
          visibility,
          metadata_json
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [postId, input.userId, input.content, input.visibility, input.metadataJson ?? '{}']
    )

    const source = input.source ?? null
    if (source && (source.extractionId || source.taskId || source.sourceLabel)) {
      await client.query(
        `
          INSERT INTO community_post_sources (
            id,
            post_id,
            extraction_id,
            task_id,
            source_label
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          randomUUID(),
          postId,
          source.extractionId ?? null,
          source.taskId ?? null,
          source.sourceLabel ?? null,
        ]
      )
    }

    const attachments = Array.isArray(input.attachments) ? input.attachments : []
    for (const attachment of attachments) {
      await client.query(
        `
          INSERT INTO community_post_attachments (
            id,
            post_id,
            attachment_type,
            storage_provider,
            url,
            thumbnail_url,
            title,
            mime_type,
            metadata_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          postId,
          attachment.attachmentType,
          attachment.storageProvider,
          attachment.url,
          attachment.thumbnailUrl ?? null,
          attachment.title ?? null,
          attachment.mimeType ?? null,
          attachment.metadataJson ?? '{}',
        ]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return findCommunityPostByIdForUser({ postId, userId: input.userId })
}

export async function recordCommunityPostViewsForUser(input: {
  userId: string
  postIds: string[]
}) {
  await ensureDbReady()
  const uniqueIds = Array.from(
    new Set(
      input.postIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  )

  if (uniqueIds.length === 0) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const postId of uniqueIds) {
      await client.query(
        `
          INSERT INTO community_post_views (
            id,
            post_id,
            user_id
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (post_id, user_id)
          DO NOTHING
        `,
        [randomUUID(), postId, input.userId]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function toggleCommunityPostReactionForUser(input: {
  postId: string
  userId: string
  reactionType?: CommunityPostReactionType
}) {
  await ensureDbReady()
  const reactionType: CommunityPostReactionType = input.reactionType ?? 'like'

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existing = await client.query<{ id: string }>(
      `
        SELECT id
        FROM community_post_reactions
        WHERE
          post_id = $1
          AND user_id = $2
          AND reaction_type = $3
        LIMIT 1
      `,
      [input.postId, input.userId, reactionType]
    )

    let reactedByMe = false
    if (existing.rows[0]) {
      await client.query(
        `
          DELETE FROM community_post_reactions
          WHERE id = $1
        `,
        [existing.rows[0].id]
      )
      reactedByMe = false
    } else {
      await client.query(
        `
          INSERT INTO community_post_reactions (
            id,
            post_id,
            user_id,
            reaction_type
          )
          VALUES ($1, $2, $3, $4)
        `,
        [randomUUID(), input.postId, input.userId, reactionType]
      )
      reactedByMe = true
    }

    const summary = await client.query<{ reactions_count: number | string }>(
      `
        SELECT COUNT(*)::int AS reactions_count
        FROM community_post_reactions
        WHERE
          post_id = $1
          AND reaction_type = $2
      `,
      [input.postId, reactionType]
    )

    await client.query('COMMIT')
    return {
      post_id: input.postId,
      reaction_type: reactionType,
      reactions_count: summary.rows[0] ? parseDbInteger(summary.rows[0].reactions_count) : 0,
      reacted_by_me: reactedByMe,
    } satisfies DbCommunityPostReactionSummary
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listCommunityPostCommentsForUser(input: {
  postId: string
  limit?: number
}) {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 100, 300)

  const { rows } = await pool.query<DbCommunityPostCommentRow>(
    `
      SELECT
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM community_post_comments c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT $2
    `,
    [input.postId, safeLimit]
  )

  return rows.map(mapCommunityPostCommentRow)
}

export async function createCommunityPostCommentForUser(input: {
  postId: string
  userId: string
  content: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbCommunityPostCommentRow>(
    `
      WITH inserted AS (
        INSERT INTO community_post_comments (
          id,
          post_id,
          user_id,
          content
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          post_id,
          user_id,
          content,
          created_at,
          updated_at
      )
      SELECT
        i.id,
        i.post_id,
        i.user_id,
        i.content,
        i.created_at,
        i.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM inserted i
      INNER JOIN users u ON u.id = i.user_id
      LIMIT 1
    `,
    [randomUUID(), input.postId, input.userId, input.content]
  )

  return rows[0] ? mapCommunityPostCommentRow(rows[0]) : null
}

export async function deleteCommunityPostCommentByIdForUser(input: {
  postId: string
  commentId: string
  actorUserId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbCommunityPostCommentRow>(
    `
      WITH deleted AS (
        DELETE FROM community_post_comments c
        USING community_posts p
        WHERE
          c.id = $1
          AND c.post_id = $2
          AND p.id = c.post_id
          AND (
            c.user_id = $3
            OR p.user_id = $3
          )
        RETURNING
          c.id,
          c.post_id,
          c.user_id,
          c.content,
          c.created_at,
          c.updated_at
      )
      SELECT
        d.id,
        d.post_id,
        d.user_id,
        d.content,
        d.created_at,
        d.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM deleted d
      LEFT JOIN users u ON u.id = d.user_id
      LIMIT 1
    `,
    [input.commentId, input.postId, input.actorUserId]
  )

  return rows[0] ? mapCommunityPostCommentRow(rows[0]) : null
}

export async function isCommunityUserFollowedBy(input: {
  followerUserId: string
  followingUserId: string
}) {
  await ensureDbReady()
  if (!input.followerUserId || !input.followingUserId) return false
  if (input.followerUserId === input.followingUserId) return false

  const { rows } = await pool.query<{ followed: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM community_follows
        WHERE
          follower_user_id = $1
          AND following_user_id = $2
      ) AS followed
    `,
    [input.followerUserId, input.followingUserId]
  )

  return rows[0]?.followed === true
}

export async function followCommunityUser(input: {
  followerUserId: string
  followingUserId: string
}) {
  await ensureDbReady()
  if (!input.followerUserId || !input.followingUserId) return false
  if (input.followerUserId === input.followingUserId) return false

  await pool.query(
    `
      INSERT INTO community_follows (
        follower_user_id,
        following_user_id
      )
      VALUES ($1, $2)
      ON CONFLICT (follower_user_id, following_user_id)
      DO NOTHING
    `,
    [input.followerUserId, input.followingUserId]
  )

  return true
}

export async function unfollowCommunityUser(input: {
  followerUserId: string
  followingUserId: string
}) {
  await ensureDbReady()
  if (!input.followerUserId || !input.followingUserId) return false
  if (input.followerUserId === input.followingUserId) return false

  const result = await pool.query(
    `
      DELETE FROM community_follows
      WHERE
        follower_user_id = $1
        AND following_user_id = $2
    `,
    [input.followerUserId, input.followingUserId]
  )

  return (result.rowCount ?? 0) > 0
}

export interface DbCommunityUserCard {
  userId: string
  name: string | null
  email: string | null
  postCount: number
  followerCount: number
  followingCount: number
  isFollowing: boolean
}

export async function searchCommunityUsers(input: {
  currentUserId: string
  q: string
  limit: number
  offset: number
}): Promise<DbCommunityUserCard[]> {
  await ensureDbReady()

  const { currentUserId, q, limit, offset } = input
  const qTrimmed = q.trim()
  const qLike = `%${qTrimmed}%`

  const { rows } = await pool.query<{
    user_id: string
    name: string | null
    email: string | null
    post_count: string
    follower_count: string
    following_count: string
    is_following: boolean
  }>(
    `
      SELECT
        u.id AS user_id,
        u.name,
        u.email,
        COUNT(DISTINCT cp.id) AS post_count,
        COUNT(DISTINCT cf_in.follower_user_id) AS follower_count,
        COUNT(DISTINCT cf_out.following_user_id) AS following_count,
        CASE WHEN me.follower_user_id IS NOT NULL THEN true ELSE false END AS is_following
      FROM users u
      LEFT JOIN community_posts cp ON cp.user_id = u.id AND cp.visibility != 'private'
      LEFT JOIN community_follows cf_in ON cf_in.following_user_id = u.id
      LEFT JOIN community_follows cf_out ON cf_out.follower_user_id = u.id
      LEFT JOIN community_follows me ON me.follower_user_id = $1 AND me.following_user_id = u.id
      WHERE u.id != $1
        AND ($2 = '' OR u.name ILIKE $3 OR u.email ILIKE $3)
      GROUP BY u.id, me.follower_user_id
      ORDER BY COUNT(DISTINCT cp.id) DESC, COUNT(DISTINCT cf_in.follower_user_id) DESC
      LIMIT $4 OFFSET $5
    `,
    [currentUserId, qTrimmed, qLike, limit, offset]
  )

  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    postCount: Number(row.post_count),
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    isFollowing: row.is_following,
  }))
}

export async function getCommunityUserProfile(
  currentUserId: string,
  targetUserId: string
): Promise<(DbCommunityUserCard & { createdAt: string }) | null> {
  await ensureDbReady()

  const { rows } = await pool.query<{
    user_id: string
    name: string | null
    email: string | null
    post_count: string
    follower_count: string
    following_count: string
    is_following: boolean
    created_at: string
  }>(
    `
      SELECT
        u.id AS user_id,
        u.name,
        u.email,
        COUNT(DISTINCT cp.id) AS post_count,
        COUNT(DISTINCT cf_in.follower_user_id) AS follower_count,
        COUNT(DISTINCT cf_out.following_user_id) AS following_count,
        CASE WHEN me.follower_user_id IS NOT NULL THEN true ELSE false END AS is_following,
        u.created_at
      FROM users u
      LEFT JOIN community_posts cp ON cp.user_id = u.id AND cp.visibility != 'private'
      LEFT JOIN community_follows cf_in ON cf_in.following_user_id = u.id
      LEFT JOIN community_follows cf_out ON cf_out.follower_user_id = u.id
      LEFT JOIN community_follows me ON me.follower_user_id = $1 AND me.following_user_id = u.id
      WHERE u.id = $2
      GROUP BY u.id, me.follower_user_id
    `,
    [currentUserId, targetUserId]
  )

  const row = rows[0]
  if (!row) return null

  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    postCount: Number(row.post_count),
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    isFollowing: row.is_following,
    createdAt: toIso(row.created_at),
  }
}

export async function listCommunityUserPosts(input: {
  currentUserId: string
  targetUserId: string
  limit: number
  offset: number
}): Promise<DbCommunityPost[]> {
  await ensureDbReady()
  const safeLimit = normalizeQueryLimit(input.limit, 20, 100)
  const safeOffset = Math.max(0, input.offset)

  const { rows } = await pool.query<DbCommunityPostRow>(
    `
      ${COMMUNITY_POST_SELECT_SQL}
      WHERE
        p.user_id = $2
        AND ${COMMUNITY_POST_CAN_VIEW_SQL}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $3 OFFSET $4
    `,
    [input.currentUserId, input.targetUserId, safeLimit, safeOffset]
  )

  return rows.map(mapCommunityPostRow)
}

export async function findNotionConnectionByUserId(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbNotionConnectionRow>(
    `
      SELECT
        user_id,
        access_token,
        workspace_id,
        workspace_name,
        workspace_icon,
        bot_id,
        owner_user_id,
        created_at,
        updated_at,
        last_used_at
      FROM notion_connections
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE notion_connections
      SET last_used_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return mapNotionConnectionRow({
    ...row,
    last_used_at: new Date().toISOString(),
  })
}

export async function upsertNotionConnection(input: {
  userId: string
  accessToken: string
  workspaceId: string | null
  workspaceName: string | null
  workspaceIcon: string | null
  botId: string | null
  ownerUserId: string | null
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbNotionConnectionRow>(
    `
      INSERT INTO notion_connections (
        user_id,
        access_token,
        workspace_id,
        workspace_name,
        workspace_icon,
        bot_id,
        owner_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        workspace_id = EXCLUDED.workspace_id,
        workspace_name = EXCLUDED.workspace_name,
        workspace_icon = EXCLUDED.workspace_icon,
        bot_id = EXCLUDED.bot_id,
        owner_user_id = EXCLUDED.owner_user_id,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        user_id,
        access_token,
        workspace_id,
        workspace_name,
        workspace_icon,
        bot_id,
        owner_user_id,
        created_at,
        updated_at,
        last_used_at
    `,
    [
      input.userId,
      input.accessToken,
      input.workspaceId,
      input.workspaceName,
      input.workspaceIcon,
      input.botId,
      input.ownerUserId,
    ]
  )

  return mapNotionConnectionRow(rows[0])
}

export async function deleteNotionConnectionByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM notion_connections WHERE user_id = $1', [userId])
}

export async function findTrelloConnectionByUserId(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbTrelloConnectionRow>(
    `
      SELECT
        user_id,
        access_token,
        member_id,
        username,
        full_name,
        created_at,
        updated_at,
        last_used_at
      FROM trello_connections
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE trello_connections
      SET last_used_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return mapTrelloConnectionRow({
    ...row,
    last_used_at: new Date().toISOString(),
  })
}

export async function upsertTrelloConnection(input: {
  userId: string
  accessToken: string
  memberId: string | null
  username: string | null
  fullName: string | null
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbTrelloConnectionRow>(
    `
      INSERT INTO trello_connections (
        user_id,
        access_token,
        member_id,
        username,
        full_name
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        member_id = EXCLUDED.member_id,
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        user_id,
        access_token,
        member_id,
        username,
        full_name,
        created_at,
        updated_at,
        last_used_at
    `,
    [input.userId, input.accessToken, input.memberId, input.username, input.fullName]
  )

  return mapTrelloConnectionRow(rows[0])
}

export async function deleteTrelloConnectionByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM trello_connections WHERE user_id = $1', [userId])
}

export async function findTodoistConnectionByUserId(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbTodoistConnectionRow>(
    `
      SELECT
        user_id,
        access_token,
        project_id,
        user_email,
        user_name,
        created_at,
        updated_at,
        last_used_at
      FROM todoist_connections
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE todoist_connections
      SET last_used_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return mapTodoistConnectionRow({
    ...row,
    last_used_at: new Date().toISOString(),
  })
}

export async function upsertTodoistConnection(input: {
  userId: string
  accessToken: string
  projectId: string | null
  userEmail: string | null
  userName: string | null
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbTodoistConnectionRow>(
    `
      INSERT INTO todoist_connections (
        user_id,
        access_token,
        project_id,
        user_email,
        user_name
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        project_id = EXCLUDED.project_id,
        user_email = EXCLUDED.user_email,
        user_name = EXCLUDED.user_name,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        user_id,
        access_token,
        project_id,
        user_email,
        user_name,
        created_at,
        updated_at,
        last_used_at
    `,
    [input.userId, input.accessToken, input.projectId, input.userEmail, input.userName]
  )

  return mapTodoistConnectionRow(rows[0])
}

export async function deleteTodoistConnectionByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM todoist_connections WHERE user_id = $1', [userId])
}

export async function findGoogleDocsConnectionByUserId(userId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbGoogleDocsConnectionRow>(
    `
      SELECT
        user_id,
        access_token,
        refresh_token,
        token_expires_at,
        scope,
        google_user_id,
        user_email,
        created_at,
        updated_at,
        last_used_at
      FROM google_docs_connections
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE google_docs_connections
      SET last_used_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  )

  return mapGoogleDocsConnectionRow({
    ...row,
    last_used_at: new Date().toISOString(),
  })
}

export async function upsertGoogleDocsConnection(input: {
  userId: string
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: string | null
  scope: string | null
  googleUserId: string | null
  userEmail: string | null
}) {
  await ensureDbReady()

  const tokenExpiresAtValue =
    input.tokenExpiresAt && input.tokenExpiresAt.trim() ? input.tokenExpiresAt : null

  const { rows } = await pool.query<DbGoogleDocsConnectionRow>(
    `
      INSERT INTO google_docs_connections (
        user_id,
        access_token,
        refresh_token,
        token_expires_at,
        scope,
        google_user_id,
        user_email
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, google_docs_connections.refresh_token),
        token_expires_at = EXCLUDED.token_expires_at,
        scope = EXCLUDED.scope,
        google_user_id = EXCLUDED.google_user_id,
        user_email = EXCLUDED.user_email,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        user_id,
        access_token,
        refresh_token,
        token_expires_at,
        scope,
        google_user_id,
        user_email,
        created_at,
        updated_at,
        last_used_at
    `,
    [
      input.userId,
      input.accessToken,
      input.refreshToken,
      tokenExpiresAtValue,
      input.scope,
      input.googleUserId,
      input.userEmail,
    ]
  )

  return mapGoogleDocsConnectionRow(rows[0])
}

export async function deleteGoogleDocsConnectionByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM google_docs_connections WHERE user_id = $1', [userId])
}

export async function consumeExtractionRateLimitByUser(input: {
  userId: string
  limit: number
}): Promise<UserExtractionRateLimitUsage> {
  await ensureDbReady()

  const { rows } = await pool.query<DbExtractionRateLimitRow>(
    `
      WITH current_window AS (
        SELECT date_trunc('hour', NOW()) AS window_start
      )
      INSERT INTO extraction_rate_limits (user_id, window_start, request_count)
      SELECT $1, cw.window_start, 1
      FROM current_window cw
      ON CONFLICT (user_id, window_start)
      DO UPDATE SET
        request_count = extraction_rate_limits.request_count + 1,
        updated_at = NOW()
      RETURNING window_start, request_count
    `,
    [input.userId]
  )

  const row = rows[0]
  if (!row) {
    throw new Error('No se pudo registrar el consumo del rate limit.')
  }

  const usedRaw =
    typeof row.request_count === 'number'
      ? row.request_count
      : Number.parseInt(String(row.request_count), 10)
  const used = Number.isFinite(usedRaw) ? usedRaw : input.limit + 1

  const windowStart = new Date(toIso(row.window_start))
  const resetAtMs = windowStart.getTime() + 60 * 60 * 1000
  const resetAt = Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : new Date().toISOString()

  return {
    limit: input.limit,
    used,
    remaining: Math.max(0, input.limit - used),
    reset_at: resetAt,
    allowed: used <= input.limit,
  }
}

export async function getExtractionRateLimitUsageByUser(input: {
  userId: string
  limit: number
}): Promise<UserExtractionRateLimitUsage> {
  await ensureDbReady()

  const { rows } = await pool.query<DbExtractionRateLimitRow>(
    `
      WITH current_window AS (
        SELECT date_trunc('hour', NOW()) AS window_start
      )
      SELECT
        cw.window_start AS window_start,
        COALESCE(erl.request_count, 0) AS request_count
      FROM current_window cw
      LEFT JOIN extraction_rate_limits erl
        ON erl.user_id = $1
       AND erl.window_start = cw.window_start
      LIMIT 1
    `,
    [input.userId]
  )

  const row = rows[0]
  const usedRaw =
    typeof row?.request_count === 'number'
      ? row.request_count
      : Number.parseInt(String(row?.request_count ?? 0), 10)
  const used = Number.isFinite(usedRaw) ? Math.max(0, usedRaw) : 0

  const windowStart = row?.window_start ? new Date(toIso(row.window_start)) : new Date()
  const resetAtMs = windowStart.getTime() + 60 * 60 * 1000
  const resetAt = Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : new Date().toISOString()

  return {
    limit: input.limit,
    used,
    remaining: Math.max(0, input.limit - used),
    reset_at: resetAt,
    allowed: used < input.limit,
  }
}

export async function consumeCommunityActionRateLimitByUser(input: {
  userId: string
  actionKey: string
  limit: number
  windowMinutes: number
}): Promise<UserExtractionRateLimitUsage> {
  await ensureDbReady()

  const windowMinutes = Number.isFinite(input.windowMinutes)
    ? Math.min(24 * 60, Math.max(1, Math.trunc(input.windowMinutes)))
    : 60

  const { rows } = await pool.query<DbCommunityActionRateLimitRow>(
    `
      WITH current_window AS (
        SELECT to_timestamp(
          floor(extract(epoch from NOW()) / ($3::int * 60))
          * ($3::int * 60)
        ) AS window_start
      )
      INSERT INTO community_action_rate_limits (
        user_id,
        action_key,
        window_start,
        request_count
      )
      SELECT
        $1,
        $2,
        cw.window_start,
        1
      FROM current_window cw
      ON CONFLICT (user_id, action_key, window_start)
      DO UPDATE SET
        request_count = community_action_rate_limits.request_count + 1,
        updated_at = NOW()
      RETURNING window_start, request_count
    `,
    [input.userId, input.actionKey, windowMinutes]
  )

  const row = rows[0]
  if (!row) {
    throw new Error('No se pudo registrar el consumo del rate limit de comunidad.')
  }

  const usedRaw =
    typeof row.request_count === 'number'
      ? row.request_count
      : Number.parseInt(String(row.request_count), 10)
  const used = Number.isFinite(usedRaw) ? usedRaw : input.limit + 1

  const windowStart = new Date(toIso(row.window_start))
  const resetAtMs = windowStart.getTime() + windowMinutes * 60 * 1000
  const resetAt = Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : new Date().toISOString()

  return {
    limit: input.limit,
    used,
    remaining: Math.max(0, input.limit - used),
    reset_at: resetAt,
    allowed: used <= input.limit,
  }
}

export async function getCommunityActionRateLimitUsageByUser(input: {
  userId: string
  actionKey: string
  limit: number
  windowMinutes: number
}): Promise<UserExtractionRateLimitUsage> {
  await ensureDbReady()

  const windowMinutes = Number.isFinite(input.windowMinutes)
    ? Math.min(24 * 60, Math.max(1, Math.trunc(input.windowMinutes)))
    : 60

  const { rows } = await pool.query<DbCommunityActionRateLimitRow>(
    `
      WITH current_window AS (
        SELECT to_timestamp(
          floor(extract(epoch from NOW()) / ($3::int * 60))
          * ($3::int * 60)
        ) AS window_start
      )
      SELECT
        cw.window_start AS window_start,
        COALESCE(carl.request_count, 0) AS request_count
      FROM current_window cw
      LEFT JOIN community_action_rate_limits carl
        ON carl.user_id = $1
       AND carl.action_key = $2
       AND carl.window_start = cw.window_start
      LIMIT 1
    `,
    [input.userId, input.actionKey, windowMinutes]
  )

  const row = rows[0]
  const usedRaw =
    typeof row?.request_count === 'number'
      ? row.request_count
      : Number.parseInt(String(row?.request_count ?? 0), 10)
  const used = Number.isFinite(usedRaw) ? Math.max(0, usedRaw) : 0

  const windowStart = row?.window_start ? new Date(toIso(row.window_start)) : new Date()
  const resetAtMs = windowStart.getTime() + windowMinutes * 60 * 1000
  const resetAt = Number.isFinite(resetAtMs) ? new Date(resetAtMs).toISOString() : new Date().toISOString()

  return {
    limit: input.limit,
    used,
    remaining: Math.max(0, input.limit - used),
    reset_at: resetAt,
    allowed: used < input.limit,
  }
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
  ): AdminTranscriptResolutionKind => {
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

function normalizeAdminUserVerificationFilter(
  value: string | null | undefined
): AdminUserVerificationFilter {
  if (value === 'verified' || value === 'unverified') return value
  return 'all'
}

function normalizeAdminUserBlockedFilter(value: string | null | undefined): AdminUserBlockedFilter {
  if (value === 'blocked' || value === 'active') return value
  return 'all'
}

export async function listAdminUsers(input?: {
  query?: string
  verification?: string
  blocked?: string
  limit?: number
  offset?: number
}): Promise<AdminUserListResult> {
  await ensureDbReady()

  const query = typeof input?.query === 'string' ? input.query.trim().slice(0, 120) : ''
  const verification = normalizeAdminUserVerificationFilter(input?.verification)
  const blocked = normalizeAdminUserBlockedFilter(input?.blocked)
  const limit = Number.isFinite(input?.limit)
    ? Math.min(200, Math.max(1, Math.trunc(input?.limit ?? 50)))
    : 50
  const offset = Number.isFinite(input?.offset)
    ? Math.max(0, Math.trunc(input?.offset ?? 0))
    : 0

  const filterParams = [query, verification, blocked]

  const countResult = await pool.query<DbCountRow>(
    `
      SELECT COUNT(*)::int AS total
      FROM users u
      WHERE
        ($1 = '' OR u.name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%'))
        AND (
          $2 = 'all'
          OR ($2 = 'verified' AND u.email_verified_at IS NOT NULL)
          OR ($2 = 'unverified' AND u.email_verified_at IS NULL)
        )
        AND (
          $3 = 'all'
          OR ($3 = 'blocked' AND u.blocked_at IS NOT NULL)
          OR ($3 = 'active' AND u.blocked_at IS NULL)
        )
    `,
    filterParams
  )

  const usersResult = await pool.query<DbAdminUserListRow>(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.email_verified_at,
        u.blocked_at,
        COUNT(DISTINCT e.id)::int AS total_extractions,
        MAX(e.created_at) AS last_extraction_at,
        COALESCE(ai.ai_calls, 0)::int AS ai_calls,
        COALESCE(ai.ai_input_tokens, 0)::bigint AS ai_input_tokens,
        COALESCE(ai.ai_output_tokens, 0)::bigint AS ai_output_tokens,
        COALESCE(ai.ai_cost_usd, 0) AS ai_cost_usd
      FROM users u
      LEFT JOIN extractions e ON e.user_id = u.id
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*)::int AS ai_calls,
          SUM(input_tokens)::bigint AS ai_input_tokens,
          SUM(output_tokens)::bigint AS ai_output_tokens,
          SUM(cost_usd) AS ai_cost_usd
        FROM ai_usage_log
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ) ai ON ai.user_id = u.id
      WHERE
        ($1 = '' OR u.name ILIKE ('%' || $1 || '%') OR u.email ILIKE ('%' || $1 || '%'))
        AND (
          $2 = 'all'
          OR ($2 = 'verified' AND u.email_verified_at IS NOT NULL)
          OR ($2 = 'unverified' AND u.email_verified_at IS NULL)
        )
        AND (
          $3 = 'all'
          OR ($3 = 'blocked' AND u.blocked_at IS NOT NULL)
          OR ($3 = 'active' AND u.blocked_at IS NULL)
        )
      GROUP BY u.id, ai.ai_calls, ai.ai_input_tokens, ai.ai_output_tokens, ai.ai_cost_usd
      ORDER BY u.created_at DESC
      LIMIT $4
      OFFSET $5
    `,
    [...filterParams, limit, offset]
  )

  return {
    total: parseDbInteger(countResult.rows[0]?.total),
    users: usersResult.rows.map(mapAdminUserListRow),
  }
}

export async function findAdminUserById(userId: string): Promise<AdminUserListItem | null> {
  await ensureDbReady()

  const { rows } = await pool.query<DbAdminUserListRow>(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.email_verified_at,
        u.blocked_at,
        COUNT(DISTINCT e.id)::int AS total_extractions,
        MAX(e.created_at) AS last_extraction_at,
        COALESCE(ai.ai_calls, 0)::int AS ai_calls,
        COALESCE(ai.ai_input_tokens, 0)::bigint AS ai_input_tokens,
        COALESCE(ai.ai_output_tokens, 0)::bigint AS ai_output_tokens,
        COALESCE(ai.ai_cost_usd, 0) AS ai_cost_usd
      FROM users u
      LEFT JOIN extractions e ON e.user_id = u.id
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*)::int AS ai_calls,
          SUM(input_tokens)::bigint AS ai_input_tokens,
          SUM(output_tokens)::bigint AS ai_output_tokens,
          SUM(cost_usd) AS ai_cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
        GROUP BY user_id
      ) ai ON ai.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, ai.ai_calls, ai.ai_input_tokens, ai.ai_output_tokens, ai.ai_cost_usd
      LIMIT 1
    `,
    [userId]
  )

  return rows[0] ? mapAdminUserListRow(rows[0]) : null
}

export async function updateUserBlockedState(input: { userId: string; blocked: boolean }) {
  await ensureDbReady()

  const { rows } = await pool.query<DbUserRow>(
    `
      UPDATE users
      SET
        blocked_at = CASE WHEN $2::boolean THEN COALESCE(blocked_at, NOW()) ELSE NULL END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
    `,
    [input.userId, input.blocked]
  )

  const user = rows[0] ? mapUserRow(rows[0]) : null
  if (!user) return null

  if (input.blocked) {
    await deleteSessionsByUserId(input.userId)
  }

  return user
}

export async function findVideoCacheByVideoId(input: {
  videoId: string
  promptVersion: string
  model: string
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbVideoCacheRow>(
    `
      SELECT
        video_id,
        video_title,
        thumbnail_url,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        transcript_text,
        prompt_version,
        model,
        created_at,
        updated_at,
        last_used_at
      FROM video_cache
      WHERE video_id = $1
        AND prompt_version = $2
        AND model = $3
      LIMIT 1
    `,
    [input.videoId, input.promptVersion, input.model]
  )

  const row = rows[0]
  if (!row) return null

  const touchedAt = new Date().toISOString()
  void pool
    .query(
      `
        UPDATE video_cache
        SET last_used_at = NOW()
        WHERE video_id = $1
      `,
      [input.videoId]
    )
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown video cache touch error'
      console.error(`[db] Failed to update video cache last_used_at for ${input.videoId}: ${message}`)
    })

  return mapVideoCacheRow({
    ...row,
    last_used_at: touchedAt,
  })
}

export async function findAnyVideoCacheByVideoId(videoId: string) {
  await ensureDbReady()

  const { rows } = await pool.query<DbVideoCacheRow>(
    `
      SELECT
        video_id,
        video_title,
        thumbnail_url,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        transcript_text,
        prompt_version,
        model,
        created_at,
        updated_at,
        last_used_at
      FROM video_cache
      WHERE video_id = $1
      LIMIT 1
    `,
    [videoId]
  )

  const row = rows[0]
  if (!row) return null

  const touchedAt = new Date().toISOString()
  void pool
    .query(
      `
        UPDATE video_cache
        SET last_used_at = NOW()
        WHERE video_id = $1
      `,
      [videoId]
    )
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown video cache touch error'
      console.error(`[db] Failed to update video cache last_used_at for ${videoId}: ${message}`)
    })

  return mapVideoCacheRow({
    ...row,
    last_used_at: touchedAt,
  })
}

export async function upsertVideoCache(input: {
  videoId: string
  videoTitle: string | null
  thumbnailUrl: string | null
  objective: string
  phasesJson: string
  proTip: string
  metadataJson: string
  transcriptText?: string | null
  promptVersion: string
  model: string
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbVideoCacheRow>(
    `
      INSERT INTO video_cache (
        video_id,
        video_title,
        thumbnail_url,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        transcript_text,
        prompt_version,
        model
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (video_id)
      DO UPDATE SET
        video_title = EXCLUDED.video_title,
        thumbnail_url = EXCLUDED.thumbnail_url,
        objective = EXCLUDED.objective,
        phases_json = EXCLUDED.phases_json,
        pro_tip = EXCLUDED.pro_tip,
        metadata_json = EXCLUDED.metadata_json,
        transcript_text = COALESCE(EXCLUDED.transcript_text, video_cache.transcript_text),
        prompt_version = EXCLUDED.prompt_version,
        model = EXCLUDED.model,
        updated_at = NOW(),
        last_used_at = NOW()
      RETURNING
        video_id,
        video_title,
        thumbnail_url,
        objective,
        phases_json,
        pro_tip,
        metadata_json,
        transcript_text,
        prompt_version,
        model,
        created_at,
        updated_at,
        last_used_at
    `,
    [
      input.videoId,
      input.videoTitle,
      input.thumbnailUrl,
      input.objective,
      input.phasesJson,
      input.proTip,
      input.metadataJson,
      input.transcriptText ?? null,
      input.promptVersion,
      input.model,
    ]
  )

  return mapVideoCacheRow(rows[0])
}

export async function createPasswordResetToken(input: {
  userId: string
  tokenHash: string
  expiresAt: Date
}) {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, input.userId, input.tokenHash, input.expiresAt.toISOString()]
  )
}

export async function findPasswordResetTokenByHash(tokenHash: string) {
  await ensureDbReady()
  const { rows } = await pool.query<{ user_id: string; expires_at: string }>(
    `
      SELECT user_id, expires_at
      FROM password_reset_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  )
  if (!rows[0]) return null
  return {
    user_id: rows[0].user_id,
    expires_at: toIso(rows[0].expires_at),
  }
}

export async function deletePasswordResetTokenByHash(tokenHash: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = $1', [tokenHash])
}

export async function deletePasswordResetTokensByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId])
}

export async function createEmailVerificationToken(input: {
  userId: string
  tokenHash: string
  expiresAt: Date
}) {
  await ensureDbReady()
  const id = randomUUID()
  await pool.query(
    `
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, input.userId, input.tokenHash, input.expiresAt.toISOString()]
  )
}

export async function findEmailVerificationTokenByHash(tokenHash: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbEmailVerificationTokenRow>(
    `
      SELECT user_id, expires_at
      FROM email_verification_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  )
  if (!rows[0]) return null
  return {
    user_id: rows[0].user_id,
    expires_at: toIso(rows[0].expires_at),
  }
}

export async function deleteEmailVerificationTokenByHash(tokenHash: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM email_verification_tokens WHERE token_hash = $1', [tokenHash])
}

export async function deleteEmailVerificationTokensByUserId(userId: string) {
  await ensureDbReady()
  await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId])
}

export async function markUserEmailAsVerified(userId: string) {
  await ensureDbReady()
  await pool.query(
    `
      UPDATE users
      SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
      WHERE id = $1
    `,
    [userId]
  )
}

export async function updateUserPassword(userId: string, passwordHash: string) {
  await ensureDbReady()
  await pool.query(
    `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [passwordHash, userId]
  )
}

export async function updateUnverifiedUserRegistration(input: {
  userId: string
  name: string
  passwordHash: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbUserRow>(
    `
      UPDATE users
      SET name = $1, password_hash = $2, updated_at = NOW()
      WHERE id = $3 AND email_verified_at IS NULL
      RETURNING id, name, email, password_hash, email_verified_at, blocked_at, created_at, updated_at
    `,
    [input.name, input.passwordHash, input.userId]
  )

  return rows[0] ? mapUserRow(rows[0]) : null
}

export async function getAppSetting(key: string): Promise<string | null> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = $1',
    [key]
  )
  return rows[0]?.value ?? null
}

export async function upsertAppSetting(key: string, value: string): Promise<void> {
  await getDbReadyPromise()
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  )
}

export async function getBusinessAssumptions(): Promise<BusinessAssumptions> {
  const { getBusinessAssumptions: getBusinessAssumptionsInModule } = await import('@/lib/db/billing')
  return getBusinessAssumptionsInModule()
}

export async function upsertBusinessAssumptions(
  input: Partial<BusinessAssumptions> | BusinessAssumptions
): Promise<BusinessAssumptions> {
  const { upsertBusinessAssumptions: upsertBusinessAssumptionsInModule } = await import('@/lib/db/billing')
  return upsertBusinessAssumptionsInModule(input)
}

export function mapUserForClient(user: Pick<DbUser, 'id' | 'name' | 'email'>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  }
}

export function mapSessionUserForClient(session: DbSessionWithUser) {
  return {
    id: session.user_id,
    name: session.user_name,
    email: session.user_email,
  }
}

// ─── AI Usage Log ────────────────────────────────────────────────────────────

export interface AdminAiCostByModel {
  provider: string
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface AdminAiCostByDay {
  date: string
  cost_usd: number
  calls: number
}

export interface AdminAiCostStats {
  period_days: number
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_model: AdminAiCostByModel[]
  by_day: AdminAiCostByDay[]
}

export interface AdminAiCostByUseType {
  use_type: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface AdminAiCostBySourceType {
  source_type: string
  calls: number
  cost_usd: number
}

export interface AdminAiCostRecentCall {
  id: string
  created_at: string
  use_type: string
  source_type: string | null
  user_id: string | null
  user_email: string | null
  extraction_id: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface AdminAiCostModelDetail {
  period_days: number
  provider: string
  model: string
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_use_type: AdminAiCostByUseType[]
  by_source_type: AdminAiCostBySourceType[]
  recent_calls: AdminAiCostRecentCall[]
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

export interface AdminUserAiCostDetail {
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_model: AdminAiCostByModel[]
  by_use_type: Array<{ use_type: string; calls: number; cost_usd: number }>
}

export async function getAdminUserAiCostDetail(userId: string): Promise<AdminUserAiCostDetail> {
  await ensureDbReady()

  const [totalsResult, byModelResult, byUseTypeResult] = await Promise.all([
    pool.query<{ total_calls: number | string; total_input: number | string; total_output: number | string; total_cost: string | number }>(
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

export interface UserAiDailyStat {
  date: string   // YYYY-MM-DD
  calls: number
  tokens: number
  costUsd: number
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

export interface AdminUserMonthStat {
  month: string          // 'YYYY-MM'
  month_label: string    // 'Feb 2026'
  ai_calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  extractions: number
}

export interface AdminUserMonthlyStats {
  user_id: string
  months: AdminUserMonthStat[]
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

  // Merge AI stats and extractions by month
  const extractionsByMonth = new Map(
    extractionsResult.rows.map((r) => [r.month, parseDbInteger(r.extractions)])
  )

  const months: AdminUserMonthStat[] = aiResult.rows.map((row) => {
    const [year, month] = row.month.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    const month_label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    return {
      month: row.month,
      month_label: month_label.charAt(0).toUpperCase() + month_label.slice(1),
      ai_calls: parseDbInteger(row.ai_calls),
      input_tokens: Number(row.input_tokens),
      output_tokens: Number(row.output_tokens),
      cost_usd: Number(row.cost_usd),
      extractions: extractionsByMonth.get(row.month) ?? 0,
    }
  })

  // Add months that have extractions but no AI calls (pre-tracking)
  for (const [month, count] of Array.from(extractionsByMonth)) {
    if (!months.find((m) => m.month === month)) {
      const [year, mon] = month.split('-')
      const date = new Date(Number(year), Number(mon) - 1, 1)
      const month_label = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      months.push({
        month,
        month_label: month_label.charAt(0).toUpperCase() + month_label.slice(1),
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
    pool.query<{ total_calls: number | string; total_input: number | string; total_output: number | string; total_cost: string | number }>(
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

export interface ExtractionCostBreakdownRow {
  use_type: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface ExtractionCostBreakdown {
  extraction_id: string
  total_calls: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  by_use_type: ExtractionCostBreakdownRow[]
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

export interface AdminUserProfitabilitySnapshot {
  user_id: string
  plan_name: string
  plan_display_name: string
  period_days: number
  price_monthly_usd: number
  target_gross_margin_pct: number
  profitability_alert_enabled: boolean
  estimated_monthly_fixed_cost_usd: number
  ai_cost_period_usd: number
  ai_cost_monthly_run_rate_usd: number
  extraction_related_cost_period_usd: number
  chat_cost_period_usd: number
  chat_tokens_period: number
  extractions_period: number
  storage_used_bytes: number
  storage_cost_monthly_usd: number
  allocated_shared_fixed_cost_usd: number
  shared_cost_allocation_strategy: SharedCostAllocationStrategy
  payment_fee_monthly_usd: number
  monthly_variable_cost_run_rate_usd: number
  monthly_total_cost_run_rate_usd: number
  max_variable_cost_allowed_usd: number
  actual_gross_margin_pct: number | null
  status: ProfitabilityStatus
}

export interface AdminPlanProfitabilityStat {
  plan_id: string
  plan_name: string
  plan_display_name: string
  period_days: number
  active_users: number
  price_monthly_usd: number
  target_gross_margin_pct: number
  profitability_alert_enabled: boolean
  estimated_monthly_fixed_cost_usd: number
  allocated_shared_fixed_cost_per_user_usd: number
  shared_cost_allocation_strategy: SharedCostAllocationStrategy
  payment_fee_monthly_usd: number
  avg_monthly_ai_cost_per_user_usd: number
  avg_monthly_storage_cost_per_user_usd: number
  avg_monthly_variable_cost_per_user_usd: number
  avg_monthly_total_cost_per_user_usd: number
  p95_monthly_total_cost_per_user_usd: number
  total_monthly_run_rate_cost_usd: number
  actual_gross_margin_pct: number | null
  p95_gross_margin_pct: number | null
  avg_extraction_cost_usd: number
  avg_chat_cost_per_token_usd: number
  avg_storage_used_bytes: number
  p95_storage_used_bytes: number
  recommended_storage_limit_bytes: number
  projected_cost_at_current_caps_usd: number
  projected_gross_margin_pct: number | null
  recommended_extractions_per_day: number | null
  recommended_chat_tokens_per_day: number | null
  upgrade_pressure_score: number
  scenario_recommendation: ScenarioRecommendation
  scenario_reason: string
  current_extractions_per_day: number
  current_chat_tokens_per_day: number
  storage_limit_bytes: number
  unprofitable_users: number
  at_risk_users: number
  status: ProfitabilityStatus
}

export interface AdminPlanScenarioSnapshot {
  preset: 'conservative' | 'recommended'
  label: string
  plan_id: string
  plan_name: string
  plan_display_name: string
  current_price_monthly_usd: number
  scenario_price_monthly_usd: number
  current_extractions_per_day: number
  scenario_extractions_per_day: number
  current_chat_tokens_per_day: number
  scenario_chat_tokens_per_day: number
  current_storage_limit_bytes: number
  scenario_storage_limit_bytes: number
  scenario_projected_cost_usd: number
  scenario_projected_margin_pct: number | null
  recommendation: ScenarioRecommendation
  reason: string
}

export interface AdminInvestorCostDriver {
  key: 'ai' | 'storage' | 'payment_fees' | 'plan_fixed' | 'shared_fixed'
  label: string
  monthly_cost_usd: number
  share_of_total_cost_pct: number
}

export interface AdminInvestorPlanSnapshot {
  plan_id: string
  plan_name: string
  plan_display_name: string
  active_users: number
  price_monthly_usd: number
  monthly_revenue_run_rate_usd: number
  monthly_cost_run_rate_usd: number
  monthly_projected_cost_at_caps_usd: number
  actual_gross_margin_pct: number | null
  projected_gross_margin_pct: number | null
  share_of_mrr_pct: number
  share_of_cost_pct: number
  unprofitable_users: number
  at_risk_users: number
  upgrade_pressure_score: number
  recommended_extractions_per_day: number | null
  recommended_chat_tokens_per_day: number | null
  recommended_storage_limit_bytes: number
  scenario_recommendation: ScenarioRecommendation
  scenario_reason: string
}

export interface AdminInvestorMetricsSummary {
  active_users: number
  active_paid_users: number
  free_users: number
  mrr_run_rate_usd: number
  arr_run_rate_usd: number
  monthly_cost_run_rate_usd: number
  monthly_projected_cost_at_caps_usd: number
  blended_gross_margin_pct: number | null
  projected_blended_gross_margin_pct: number | null
  at_risk_users: number
  unprofitable_users: number
  target_gross_margin_pct: number
  assumed_monthly_churn_pct: number
  implied_customer_lifetime_months: number | null
  assumed_trial_to_paid_pct: number
  target_payback_months: number
}

export interface AdminInvestorMetricsPack {
  generated_at: string
  period_days: number
  business_assumptions: BusinessAssumptions
  summary: AdminInvestorMetricsSummary
  cost_drivers: AdminInvestorCostDriver[]
  recommendation_counts: Record<ScenarioRecommendation, number>
  plans: AdminInvestorPlanSnapshot[]
  scenarios: AdminPlanScenarioSnapshot[]
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

export async function getAdminUserProfitability(
  userId: string,
  periodDays = 30
): Promise<AdminUserProfitabilitySnapshot | null> {
  const { getAdminUserProfitability: getAdminUserProfitabilityInModule } = await import('@/lib/db/billing')
  return getAdminUserProfitabilityInModule(userId, periodDays)
}

export async function getAdminPlanProfitabilityStats(
  periodDays = 30
): Promise<{ period_days: number; plans: AdminPlanProfitabilityStat[] }> {
  const { getAdminPlanProfitabilityStats: getAdminPlanProfitabilityStatsInModule } = await import('@/lib/db/billing')
  return getAdminPlanProfitabilityStatsInModule(periodDays)
}

export async function getAdminPlanProfitabilityScenarios(
  periodDays = 30
): Promise<{ period_days: number; assumptions: BusinessAssumptions; scenarios: AdminPlanScenarioSnapshot[] }> {
  const { getAdminPlanProfitabilityScenarios: getAdminPlanProfitabilityScenariosInModule } =
    await import('@/lib/db/billing')
  return getAdminPlanProfitabilityScenariosInModule(periodDays)
}

export async function getAdminInvestorMetricsPack(
  periodDays = 30
): Promise<AdminInvestorMetricsPack> {
  const { getAdminInvestorMetricsPack: getAdminInvestorMetricsPackInModule } = await import('@/lib/db/billing')
  return getAdminInvestorMetricsPackInModule(periodDays)
}

// ── Plan Catalog (admin-managed) ─────────────────────────────────────────────

export interface DbPlan {
  id: string
  name: string
  display_name: string
  price_monthly_usd: number
  stripe_price_id: string | null
  extractions_per_hour: number
  extractions_per_day: number
  chat_tokens_per_day: number
  storage_limit_bytes: number
  target_gross_margin_pct: number
  profitability_alert_enabled: boolean
  estimated_monthly_fixed_cost_usd: number
  features_json: string
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
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

export async function listPlans(): Promise<DbPlan[]> {
  const { listPlans: listPlansInModule } = await import('@/lib/db/billing')
  return listPlansInModule()
}

export async function getPlanByName(name: string): Promise<DbPlan | null> {
  const { getPlanByName: getPlanByNameInModule } = await import('@/lib/db/billing')
  return getPlanByNameInModule(name)
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
  const { createPlan: createPlanInModule } = await import('@/lib/db/billing')
  return createPlanInModule(input)
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
  const { updatePlan: updatePlanInModule } = await import('@/lib/db/billing')
  return updatePlanInModule(id, input)
}

export async function deletePlan(id: string): Promise<void> {
  const { deletePlan: deletePlanInModule } = await import('@/lib/db/billing')
  return deletePlanInModule(id)
}

// ── Stripe / User Plans ─────────────────────────────────────────────────────

export interface DbUserPlan {
  id: string
  user_id: string
  plan: string
  extractions_per_hour: number
  extra_credits: number
  stripe_subscription_id: string | null
  stripe_price_id: string | null
  status: string
  current_period_start: string | null
  current_period_end: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
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

export async function getUserActivePlan(userId: string): Promise<DbUserPlan | null> {
  const { getUserActivePlan: getUserActivePlanInModule } = await import('@/lib/db/billing')
  return getUserActivePlanInModule(userId)
}

export async function getUserPlanRateLimit(userId: string): Promise<number> {
  const { getUserPlanRateLimit: getUserPlanRateLimitInModule } = await import('@/lib/db/billing')
  return getUserPlanRateLimitInModule(userId)
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
  const { upsertUserActivePlan: upsertUserActivePlanInModule } = await import('@/lib/db/billing')
  return upsertUserActivePlanInModule(input)
}

export async function deactivateUserPlan(userId: string, subscriptionId: string): Promise<void> {
  const { deactivateUserPlan: deactivateUserPlanInModule } = await import('@/lib/db/billing')
  return deactivateUserPlanInModule(userId, subscriptionId)
}

export async function setUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  const { setUserStripeCustomerId: setUserStripeCustomerIdInModule } = await import(
    '@/lib/db/billing'
  )
  return setUserStripeCustomerIdInModule(userId, stripeCustomerId)
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<DbUser | null> {
  const { getUserByStripeCustomerId: getUserByStripeCustomerIdInModule } = await import(
    '@/lib/db/billing'
  )
  return getUserByStripeCustomerIdInModule(stripeCustomerId)
}

export async function getUserStripeCustomerId(userId: string): Promise<string | null> {
  const { getUserStripeCustomerId: getUserStripeCustomerIdInModule } = await import(
    '@/lib/db/billing'
  )
  return getUserStripeCustomerIdInModule(userId)
}

export async function claimStripeEventProcessing(
  id: string,
  eventType: string,
  userId: string | null,
  rawJson: string
): Promise<boolean> {
  const { claimStripeEventProcessing: claimStripeEventProcessingInModule } = await import(
    '@/lib/db/billing'
  )
  return claimStripeEventProcessingInModule(id, eventType, userId, rawJson)
}

export async function markStripeEventProcessed(id: string): Promise<void> {
  const { markStripeEventProcessed: markStripeEventProcessedInModule } = await import(
    '@/lib/db/billing'
  )
  return markStripeEventProcessedInModule(id)
}

export async function releaseStripeEventProcessing(id: string, message: string): Promise<void> {
  const { releaseStripeEventProcessing: releaseStripeEventProcessingInModule } = await import(
    '@/lib/db/billing'
  )
  return releaseStripeEventProcessingInModule(id, message)
}

// ── Daily extraction limits + credits ──────────────────────────────────────

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
    limit: planResult.rows[0]?.extractions_per_day != null
      ? parseDbInteger(planResult.rows[0].extractions_per_day)
      : 3,
    activePlanId: activePlanResult.rows[0]?.id ?? null,
    extraCredits: activePlanResult.rows[0]
      ? parseDbInteger(activePlanResult.rows[0].extra_credits ?? 0)
      : 0,
  }
}

export async function getUserDailyLimit(userId: string): Promise<number> {
  const { getUserDailyLimit: getUserDailyLimitInModule } = await import('@/lib/db/billing')
  return getUserDailyLimitInModule(userId)
}

export async function getDailyExtractionSnapshot(userId: string): Promise<DailyExtractionSnapshot> {
  const { getDailyExtractionSnapshot: getDailyExtractionSnapshotInModule } = await import(
    '@/lib/db/billing'
  )
  return getDailyExtractionSnapshotInModule(userId)
}

export async function consumeDailyExtraction(userId: string): Promise<{
  allowed: boolean
  used_credit: boolean
  snapshot: DailyExtractionSnapshot
}> {
  const { consumeDailyExtraction: consumeDailyExtractionInModule } = await import('@/lib/db/billing')
  return consumeDailyExtractionInModule(userId)
}

export async function getUserCreditBalance(userId: string): Promise<number> {
  const { getUserCreditBalance: getUserCreditBalanceInModule } = await import('@/lib/db/billing')
  return getUserCreditBalanceInModule(userId)
}

export async function consumeUserCredit(userId: string): Promise<void> {
  const { consumeUserCredit: consumeUserCreditInModule } = await import('@/lib/db/billing')
  return consumeUserCreditInModule(userId)
}

export async function addUserCredits(
  userId: string,
  amount: number,
  reason: string,
  stripeSessionId?: string
): Promise<{ applied: boolean }> {
  const { addUserCredits: addUserCreditsInModule } = await import('@/lib/db/billing')
  return addUserCreditsInModule(userId, amount, reason, stripeSessionId)
}

export async function listUserCreditTransactions(userId: string, limit = 10): Promise<DbCreditTransaction[]> {
  const { listUserCreditTransactions: listUserCreditTransactionsInModule } = await import(
    '@/lib/db/billing'
  )
  return listUserCreditTransactionsInModule(userId, limit)
}

// ── Admin — Credit management ─────────────────────────────────────────────

export interface AdminUserCreditRow {
  user_id: string
  user_name: string
  user_email: string
  extra_credits: number
  plan: string
  total_purchased: number
  last_purchase_at: string | null
}

export interface AdminCreditStats {
  total_credits_in_circulation: number
  users_with_credits: number
  total_purchases_alltime: number
  total_purchases_30d: number
  credits_purchased_30d: number
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
  return rows.map((r) => ({
    user_id: r.user_id,
    user_name: r.user_name,
    user_email: r.user_email,
    extra_credits: parseDbInteger(r.extra_credits),
    plan: r.plan,
    total_purchased: parseDbInteger(r.total_purchased),
    last_purchase_at: r.last_purchase_at ? toIso(r.last_purchase_at) : null,
  }))
}

export interface AdminRecentTransaction {
  id: string
  user_id: string
  user_name: string
  user_email: string
  amount: number
  reason: string
  stripe_session_id: string | null
  created_at: string
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
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user_name: r.user_name,
    user_email: r.user_email,
    amount: parseDbInteger(r.amount),
    reason: r.reason,
    stripe_session_id: r.stripe_session_id ?? null,
    created_at: toIso(r.created_at),
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
    transactions: txRows.rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      amount: parseDbInteger(r.amount),
      reason: r.reason,
      stripe_session_id: r.stripe_session_id ?? null,
      created_at: toIso(r.created_at),
    })),
  }
}

// ── Tags ───────────────────────────────────────────────────────────────────

export async function listUserTags(userId: string): Promise<DbExtractionTag[]> {
  const { listUserTags: listUserTagsInModule } = await import('@/lib/db/extractions')
  return listUserTagsInModule(userId)
}

export async function createOrGetTag(
  userId: string,
  name: string,
  color: string
): Promise<DbExtractionTag> {
  const { createOrGetTag: createOrGetTagInModule } = await import('@/lib/db/extractions')
  return createOrGetTagInModule(userId, name, color)
}

export async function deleteUserTag(userId: string, tagId: string): Promise<void> {
  const { deleteUserTag: deleteUserTagInModule } = await import('@/lib/db/extractions')
  return deleteUserTagInModule(userId, tagId)
}

export async function assignTagToExtraction(
  extractionId: string,
  tagId: string
): Promise<void> {
  const { assignTagToExtraction: assignTagToExtractionInModule } = await import('@/lib/db/extractions')
  return assignTagToExtractionInModule(extractionId, tagId)
}

export async function removeTagFromExtraction(
  extractionId: string,
  tagId: string
): Promise<void> {
  const { removeTagFromExtraction: removeTagFromExtractionInModule } = await import(
    '@/lib/db/extractions'
  )
  return removeTagFromExtractionInModule(extractionId, tagId)
}

// ── Dashboard stats ────────────────────────────────────────────────────────

export async function getUserDashboardStats(userId: string): Promise<{
  extractions: {
    total: number
    thisWeek: number
    thisMonth: number
    starred: number
    byMode: Record<string, number>
    bySourceType: Record<string, number>
  }
  tasks: { total: number; completed: number }
  savedMinutes: number
  activity: { date: string; count: number }[]
  streak: { current: number; longest: number }
}> {
  await ensureDbReady()

  const [aggRows, modeRows, sourceRows, taskRows, savedRows, activityRows] = await Promise.all([
    // Q1 — Extraction aggregates
    pool.query<{
      total: number
      this_week: number
      this_month: number
      starred: number
    }>(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int  AS this_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS this_month,
        COUNT(*) FILTER (WHERE is_starred = true)::int AS starred
       FROM extractions WHERE user_id = $1`,
      [userId]
    ),
    // Q2 — Breakdown by mode
    pool.query<{ extraction_mode: string; cnt: number }>(
      `SELECT extraction_mode, COUNT(*)::int AS cnt
       FROM extractions WHERE user_id = $1
       GROUP BY extraction_mode`,
      [userId]
    ),
    // Q3 — Breakdown by source type
    pool.query<{ source_type: string; cnt: number }>(
      `SELECT COALESCE(source_type, 'youtube') AS source_type, COUNT(*)::int AS cnt
       FROM extractions WHERE user_id = $1
       GROUP BY COALESCE(source_type, 'youtube')`,
      [userId]
    ),
    // Q4 — Tasks
    pool.query<{ total: number; completed: number }>(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed' OR checked = true)::int AS completed
       FROM extraction_tasks WHERE user_id = $1`,
      [userId]
    ),
    // Q5 — Time saved
    pool.query<{ total_minutes: number }>(
      `SELECT COALESCE(SUM(
        COALESCE((regexp_match(metadata_json::json->>'savedTime', '(\\d+)h'))[1]::int * 60, 0) +
        COALESCE((regexp_match(metadata_json::json->>'savedTime', '(\\d+)m'))[1]::int, 0)
       ), 0)::int AS total_minutes
       FROM extractions WHERE user_id = $1`,
      [userId]
    ),
    // Q6 — Activity heatmap (last 365 days)
    pool.query<{ day: string; cnt: number }>(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
       FROM extractions
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '365 days'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY day`,
      [userId]
    ),
  ])

  const agg = aggRows.rows[0] ?? { total: 0, this_week: 0, this_month: 0, starred: 0 }
  const byMode: Record<string, number> = {}
  for (const row of modeRows.rows) byMode[row.extraction_mode] = Number(row.cnt)
  const bySourceType: Record<string, number> = {}
  for (const row of sourceRows.rows) bySourceType[row.source_type] = Number(row.cnt)
  const taskAgg = taskRows.rows[0] ?? { total: 0, completed: 0 }
  const savedMinutes = Number(savedRows.rows[0]?.total_minutes ?? 0)
  const activity = activityRows.rows.map((r) => ({ date: r.day, count: Number(r.cnt) }))

  // Compute streaks from activity data
  const activityMap = new Map(activity.map((a) => [a.date, a.count]))
  const today = new Date()

  // Current streak: consecutive days from today backwards
  let current = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    if ((activityMap.get(dateStr) ?? 0) > 0) {
      current++
    } else {
      break
    }
  }

  // Longest streak: scan oldest-to-newest
  let longest = current
  let run = 0
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    if ((activityMap.get(dateStr) ?? 0) > 0) {
      run++
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }

  return {
    extractions: {
      total: Number(agg.total),
      thisWeek: Number(agg.this_week),
      thisMonth: Number(agg.this_month),
      starred: Number(agg.starred),
      byMode,
      bySourceType,
    },
    tasks: { total: Number(taskAgg.total), completed: Number(taskAgg.completed) },
    savedMinutes,
    activity,
    streak: { current, longest },
  }
}

// ── Guest rate limit (existing, unchanged) ─────────────────────────────────

export async function consumeGuestExtractionRateLimit(guestId: string): Promise<{
  allowed: boolean
  used: number
}> {
  await ensureDbReady()
  const { rows } = await pool.query(
    `INSERT INTO guest_extraction_limits (guest_id, window_date, request_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (guest_id, window_date)
     DO UPDATE SET
       request_count = guest_extraction_limits.request_count + 1,
       updated_at = NOW()
     RETURNING request_count`,
    [guestId]
  )
  const used = Number(rows[0]?.request_count ?? 4)
  return { allowed: used <= 3, used }
}

// ── Login rate limit ─────────────────────────────────────────────────────────

export async function consumeLoginRateLimit(
  key: string,
  limitPerWindow: number,
  windowMinutes: number
): Promise<{ allowed: boolean; used: number; resetAt: string }> {
  await ensureDbReady()
  const { rows } = await pool.query(
    `WITH current_window AS (
       SELECT to_timestamp(
         floor(extract(epoch from NOW()) / ($2::int * 60)) * ($2::int * 60)
       ) AS window_start
     )
     INSERT INTO login_rate_limits (key, window_start, attempt_count)
     SELECT $1, cw.window_start, 1 FROM current_window cw
     ON CONFLICT (key, window_start)
     DO UPDATE SET attempt_count = login_rate_limits.attempt_count + 1, updated_at = NOW()
     RETURNING window_start, attempt_count`,
    [key, windowMinutes]
  )
  const row = rows[0]
  const used = Number(row?.attempt_count ?? 1)
  const windowStart = row?.window_start ? new Date(row.window_start) : new Date()
  const resetAt = new Date(windowStart.getTime() + windowMinutes * 60 * 1000).toISOString()
  return { allowed: used <= limitPerWindow, used, resetAt }
}

// ── User storage tracking ────────────────────────────────────────────────────

/** Returns used bytes, effective limit bytes, and plan name for a user. Single query. */
export async function getUserStorageInfo(userId: string): Promise<{
  usedBytes: number
  limitBytes: number
  plan: string
}> {
  await ensureDbReady()
  const { rows } = await pool.query<{
    used_bytes: string
    override_bytes: string | null
    plan: string | null
    plan_limit_bytes: string | null
  }>(
    `SELECT
       COALESCE(us.used_bytes, 0)                       AS used_bytes,
       us.storage_limit_override_bytes                  AS override_bytes,
       COALESCE(up.plan, 'free')                        AS plan,
       p.storage_limit_bytes                            AS plan_limit_bytes
     FROM users u
     LEFT JOIN user_storage us   ON us.user_id = u.id
     LEFT JOIN user_plans up     ON up.user_id = u.id AND up.status = 'active'
     LEFT JOIN plans p           ON p.name = COALESCE(up.plan, 'free')
     WHERE u.id = $1`,
    [userId]
  )
  const row = rows[0]
  const usedBytes = Number(row?.used_bytes ?? 0)
  const plan = row?.plan ?? 'free'
  const limitBytes =
    row?.override_bytes != null
      ? Number(row.override_bytes)
      : row?.plan_limit_bytes != null
      ? Number(row.plan_limit_bytes)
      : 104857600 // 100 MB fallback
  return { usedBytes, limitBytes, plan }
}

/** Admin: set a per-user storage limit override (null removes the override). */
export async function setUserStorageLimitOverride(userId: string, bytes: number | null): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO user_storage (user_id, used_bytes, storage_limit_override_bytes, updated_at)
     VALUES ($1, 0, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET storage_limit_override_bytes = $2, updated_at = NOW()`,
    [userId, bytes]
  )
}

export async function getUserStorageUsed(userId: string): Promise<number> {
  await ensureDbReady()
  const { rows } = await pool.query<{ used_bytes: string }>(
    `SELECT used_bytes FROM user_storage WHERE user_id = $1`,
    [userId]
  )
  return Number(rows[0]?.used_bytes ?? 0)
}

export async function incrementUserStorageUsed(userId: string, bytes: number): Promise<number> {
  await ensureDbReady()
  const { rows } = await pool.query<{ used_bytes: string }>(
    `INSERT INTO user_storage (user_id, used_bytes, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       used_bytes = user_storage.used_bytes + $2,
       updated_at = NOW()
     RETURNING used_bytes`,
    [userId, bytes]
  )
  return Number(rows[0]?.used_bytes ?? 0)
}

export async function decrementUserStorageUsed(userId: string, bytes: number): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO user_storage (user_id, used_bytes, updated_at)
     VALUES ($1, 0, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       used_bytes = GREATEST(0, user_storage.used_bytes - $2),
       updated_at = NOW()`,
    [userId, bytes]
  )
}

// ─── Notification Preferences ─────────────────────────────────────────────────

export interface NotificationPreferences {
  notifyTaskStatusChange: boolean
  notifyNewComment: boolean
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{
    notify_task_status_change: boolean
    notify_new_comment: boolean
  }>(
    `SELECT notify_task_status_change, notify_new_comment
     FROM notification_preferences WHERE user_id = $1`,
    [userId]
  )
  if (rows.length === 0) {
    return { notifyTaskStatusChange: true, notifyNewComment: true }
  }
  return {
    notifyTaskStatusChange: rows[0].notify_task_status_change,
    notifyNewComment: rows[0].notify_new_comment,
  }
}

export async function upsertNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  await getDbReadyPromise()
  const current = await getNotificationPreferences(userId)
  const next = {
    notifyTaskStatusChange: prefs.notifyTaskStatusChange ?? current.notifyTaskStatusChange,
    notifyNewComment: prefs.notifyNewComment ?? current.notifyNewComment,
  }
  await pool.query(
    `INSERT INTO notification_preferences (user_id, notify_task_status_change, notify_new_comment)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       notify_task_status_change = $2,
       notify_new_comment = $3,
       updated_at = NOW()`,
    [userId, next.notifyTaskStatusChange, next.notifyNewComment]
  )
  return next
}

export interface ExtractionNotificationContext {
  ownerUserId: string
  ownerEmail: string
  ownerName: string
  extractionTitle: string
}

export async function getExtractionNotificationContext(
  extractionId: string,
  taskId: string
): Promise<{ extraction: ExtractionNotificationContext | null; taskText: string | null }> {
  const { getExtractionNotificationContext: getExtractionNotificationContextInModule } =
    await import('@/lib/db/extractions')
  return getExtractionNotificationContextInModule(extractionId, taskId)
}

export interface TaskFollowerInfo {
  userId: string
  email: string
  name: string
}

export async function getTaskFollowersForNotification(
  taskId: string,
  excludeUserId: string
): Promise<TaskFollowerInfo[]> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{
    user_id: string
    email: string
    name: string | null
  }>(
    `SELECT f.user_id, u.email, u.name
     FROM extraction_task_follows f
     JOIN users u ON u.id = f.user_id
     WHERE f.task_id = $1 AND f.user_id != $2`,
    [taskId, excludeUserId]
  )
  return rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name ?? '' }))
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKSPACE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function createWorkspace(input: {
  ownerId: string
  name: string
  slug?: string
  description?: string
  avatarColor?: string
}): Promise<DbWorkspace> {
  const { createWorkspace: createWorkspaceInModule } = await import('@/lib/db/workspaces')
  return createWorkspaceInModule(input)
}

export async function findWorkspaceById(id: string): Promise<DbWorkspace | null> {
  const { findWorkspaceById: findWorkspaceByIdInModule } = await import('@/lib/db/workspaces')
  return findWorkspaceByIdInModule(id)
}

export async function findWorkspaceBySlug(slug: string): Promise<DbWorkspace | null> {
  const { findWorkspaceBySlug: findWorkspaceBySlugInModule } = await import('@/lib/db/workspaces')
  return findWorkspaceBySlugInModule(slug)
}

export async function listWorkspacesForUser(userId: string): Promise<DbWorkspaceWithRole[]> {
  const { listWorkspacesForUser: listWorkspacesForUserInModule } = await import(
    '@/lib/db/workspaces'
  )
  return listWorkspacesForUserInModule(userId)
}

export async function updateWorkspace(input: {
  id: string
  requestingUserId: string
  name?: string
  description?: string | null
  avatarColor?: string
}): Promise<DbWorkspace | null> {
  const { updateWorkspace: updateWorkspaceInModule } = await import('@/lib/db/workspaces')
  return updateWorkspaceInModule(input)
}

export async function deleteWorkspace(input: { id: string; ownerUserId: string }): Promise<void> {
  const { deleteWorkspace: deleteWorkspaceInModule } = await import('@/lib/db/workspaces')
  return deleteWorkspaceInModule(input)
}

// ── Members ──────────────────────────────────────────────────────────────────

export async function listWorkspaceMembers(workspaceId: string): Promise<DbWorkspaceMember[]> {
  const { listWorkspaceMembers: listWorkspaceMembersInModule } = await import(
    '@/lib/db/workspaces'
  )
  return listWorkspaceMembersInModule(workspaceId)
}

export async function getWorkspaceMemberRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const { getWorkspaceMemberRole: getWorkspaceMemberRoleInModule } = await import(
    '@/lib/db/workspaces'
  )
  return getWorkspaceMemberRoleInModule(workspaceId, userId)
}

export async function upsertWorkspaceMember(input: {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  requestingUserId: string
}): Promise<DbWorkspaceMember> {
  const { upsertWorkspaceMember: upsertWorkspaceMemberInModule } = await import(
    '@/lib/db/workspaces'
  )
  return upsertWorkspaceMemberInModule(input)
}

export async function removeWorkspaceMember(input: {
  workspaceId: string
  userId: string
  requestingUserId: string
}): Promise<void> {
  const { removeWorkspaceMember: removeWorkspaceMemberInModule } = await import(
    '@/lib/db/workspaces'
  )
  return removeWorkspaceMemberInModule(input)
}

export async function transferWorkspaceOwnership(input: {
  workspaceId: string
  currentOwnerId: string
  newOwnerId: string
}): Promise<void> {
  const { transferWorkspaceOwnership: transferWorkspaceOwnershipInModule } = await import(
    '@/lib/db/workspaces'
  )
  return transferWorkspaceOwnershipInModule(input)
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function createWorkspaceInvitation(input: {
  workspaceId: string
  invitedByUserId: string
  email: string
  role: WorkspaceRole
}): Promise<DbWorkspaceInvitation> {
  const { createWorkspaceInvitation: createWorkspaceInvitationInModule } = await import(
    '@/lib/db/workspaces'
  )
  return createWorkspaceInvitationInModule(input)
}

export async function findWorkspaceInvitationByToken(
  token: string
): Promise<DbWorkspaceInvitation | null> {
  const { findWorkspaceInvitationByToken: findWorkspaceInvitationByTokenInModule } =
    await import('@/lib/db/workspaces')
  return findWorkspaceInvitationByTokenInModule(token)
}

export async function acceptWorkspaceInvitation(input: {
  token: string
  userId: string
}): Promise<DbWorkspaceMember> {
  const { acceptWorkspaceInvitation: acceptWorkspaceInvitationInModule } = await import(
    '@/lib/db/workspaces'
  )
  return acceptWorkspaceInvitationInModule(input)
}

export async function declineWorkspaceInvitation(token: string): Promise<void> {
  const { declineWorkspaceInvitation: declineWorkspaceInvitationInModule } = await import(
    '@/lib/db/workspaces'
  )
  return declineWorkspaceInvitationInModule(token)
}

export async function listWorkspaceInvitations(
  workspaceId: string
): Promise<DbWorkspaceInvitation[]> {
  const { listWorkspaceInvitations: listWorkspaceInvitationsInModule } = await import(
    '@/lib/db/workspaces'
  )
  return listWorkspaceInvitationsInModule(workspaceId)
}

export async function cancelWorkspaceInvitation(input: {
  invitationId: string
  requestingUserId: string
}): Promise<void> {
  const { cancelWorkspaceInvitation: cancelWorkspaceInvitationInModule } = await import(
    '@/lib/db/workspaces'
  )
  return cancelWorkspaceInvitationInModule(input)
}

// ── Workspace Extractions ─────────────────────────────────────────────────────

export async function listWorkspaceExtractions(input: {
  workspaceId: string
  userId: string
  limit?: number
  cursor?: string
}): Promise<DbExtraction[]> {
  await getDbReadyPromise()
  const limit = Math.min(input.limit ?? 30, 100)
  const params: unknown[] = [input.workspaceId, limit]
  let cursorClause = ''
  if (input.cursor) {
    cursorClause = ` AND e.id < $3`
    params.push(input.cursor)
  }
  const { rows } = await pool.query<DbExtractionRow & { tags_json: string | null }>(
    `SELECT e.*,
       COALESCE(
         (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
          FROM extraction_tag_assignments eta
          JOIN extraction_tags t ON t.id = eta.tag_id
          WHERE eta.extraction_id = e.id),
         '[]'
       )::text AS tags_json
     FROM extractions e
     WHERE e.workspace_id = $1${cursorClause}
     ORDER BY e.created_at DESC
     LIMIT $2`,
    params
  )
  return rows.map(mapExtractionRow)
}

export async function moveExtractionToWorkspace(input: {
  extractionId: string
  userId: string
  workspaceId: string | null
}): Promise<void> {
  await getDbReadyPromise()
  // Verify extraction belongs to user
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM extractions WHERE id = $1`,
    [input.extractionId]
  )
  if (!rows[0]) throw new Error('Extracción no encontrada.')
  if (rows[0].user_id !== input.userId) throw new Error('Sin permisos sobre esta extracción.')

  // If moving to workspace, verify user is member+
  if (input.workspaceId) {
    const role = await getWorkspaceMemberRole(input.workspaceId, input.userId)
    if (!role || role === 'viewer') throw new Error('Sin permisos para mover extracciones al workspace.')
  }

  await pool.query(
    `UPDATE extractions SET workspace_id = $1 WHERE id = $2 AND user_id = $3`,
    [input.workspaceId, input.extractionId, input.userId]
  )
}

export async function countWorkspaceExtractions(workspaceId: string): Promise<number> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{ total: number | string }>(
    `SELECT COUNT(*)::int AS total FROM extractions WHERE workspace_id = $1`,
    [workspaceId]
  )
  return parseDbInteger(rows[0]?.total ?? 0)
}

// ── Prompt template overrides ─────────────────────────────────────────────────

export async function getPromptOverride(key: string): Promise<string | null> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{ content: string }>(
    `SELECT content FROM prompt_templates WHERE prompt_key = $1`,
    [key]
  )
  return rows[0]?.content ?? null
}

export async function setPromptOverride(key: string, content: string, updatedBy: string): Promise<void> {
  await getDbReadyPromise()
  await pool.query(
    `INSERT INTO prompt_templates (prompt_key, content, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (prompt_key) DO UPDATE
       SET content = EXCLUDED.content,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
    [key, content, updatedBy]
  )
}

export async function deletePromptOverride(key: string): Promise<void> {
  await getDbReadyPromise()
  await pool.query(`DELETE FROM prompt_templates WHERE prompt_key = $1`, [key])
}

export interface DbPromptTemplate {
  prompt_key: string
  content: string
  updated_at: string
  updated_by: string | null
}

export async function listPromptOverrides(): Promise<DbPromptTemplate[]> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{
    prompt_key: string
    content: string
    updated_at: Date | string
    updated_by: string | null
  }>(`SELECT prompt_key, content, updated_at, updated_by FROM prompt_templates ORDER BY prompt_key`)
  return rows.map((row) => ({
    prompt_key: row.prompt_key,
    content: row.content,
    updated_at: toIso(row.updated_at),
    updated_by: row.updated_by,
  }))
}

// ── Chat token daily limits ────────────────────────────────────────────────────

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
  // Reset happens at midnight UTC — next midnight
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
    date: typeof row.date === 'string' ? row.date : (row.date as Date).toISOString().slice(0, 10),
  }))
}

// ── Flowchart / Process Graph helpers ─────────────────────────────────────────

export async function listExtractionTaskEdges(extractionId: string): Promise<DbExtractionTaskEdge[]> {
  const { listExtractionTaskEdges: listExtractionTaskEdgesInModule } = await import('@/lib/db/extractions')
  return listExtractionTaskEdgesInModule(extractionId)
}

export async function listDecisionSelections(extractionId: string): Promise<DbExtractionTaskDecisionSelection[]> {
  const { listDecisionSelections: listDecisionSelectionsInModule } = await import('@/lib/db/extractions')
  return listDecisionSelectionsInModule(extractionId)
}

export async function upsertTaskEdge(input: {
  extractionId: string
  fromTaskId: string
  toTaskId: string
  edgeType: 'and' | 'xor' | 'loop'
  label: string | null
  expectedExtraDays: number | null
  sortOrder?: number
}): Promise<DbExtractionTaskEdge> {
  const { upsertTaskEdge: upsertTaskEdgeInModule } = await import('@/lib/db/extractions')
  return upsertTaskEdgeInModule(input)
}

export async function deleteTaskEdge(input: {
  extractionId: string
  fromTaskId: string
  toTaskId: string
  edgeType: 'and' | 'xor' | 'loop'
}): Promise<void> {
  const { deleteTaskEdge: deleteTaskEdgeInModule } = await import('@/lib/db/extractions')
  return deleteTaskEdgeInModule(input)
}

export async function upsertDecisionSelection(input: {
  extractionId: string
  decisionTaskId: string
  selectedToTaskId: string
}): Promise<DbExtractionTaskDecisionSelection> {
  const {
    upsertDecisionSelection: upsertDecisionSelectionInModule,
  } = await import('@/lib/db/extractions')
  return upsertDecisionSelectionInModule(input)
}

export async function updateExtractionTaskFlowNodeType(input: {
  taskId: string
  extractionId: string
  flowNodeType: 'process' | 'decision'
}): Promise<void> {
  const {
    updateExtractionTaskFlowNodeType: updateExtractionTaskFlowNodeTypeInModule,
  } = await import('@/lib/db/extractions')
  return updateExtractionTaskFlowNodeTypeInModule(input)
}

// ── Presentation Deck ─────────────────────────────────────────────────────────

export async function getPresentationDeck(
  { extractionId }: { extractionId: string }
): Promise<{ deckJson: string } | null> {
  const { getPresentationDeck: getPresentationDeckInModule } = await import('@/lib/db/extractions')
  return getPresentationDeckInModule({ extractionId })
}

export async function savePresentationDeck(
  { extractionId, deckJson }: { extractionId: string; deckJson: string }
): Promise<void> {
  const { savePresentationDeck: savePresentationDeckInModule } = await import('@/lib/db/extractions')
  return savePresentationDeckInModule({ extractionId, deckJson })
}

export async function getPresentationState(
  { extractionId, userId }: { extractionId: string; userId: string }
): Promise<{ lastSlideId: string | null } | null> {
  const { getPresentationState: getPresentationStateInModule } = await import('@/lib/db/extractions')
  return getPresentationStateInModule({ extractionId, userId })
}

export async function setPresentationState(
  { extractionId, userId, lastSlideId }: { extractionId: string; userId: string; lastSlideId: string }
): Promise<void> {
  const { setPresentationState: setPresentationStateInModule } = await import('@/lib/db/extractions')
  return setPresentationStateInModule({ extractionId, userId, lastSlideId })
}

export async function listFlowNodePositions(extractionId: string) {
  const { listFlowNodePositions: listFlowNodePositionsInModule } = await import('@/lib/db/extractions')
  return listFlowNodePositionsInModule(extractionId)
}

export async function upsertFlowNodePosition(input: {
  taskId: string; extractionId: string; cx: number; cy: number
}): Promise<void> {
  const {
    upsertFlowNodePosition: upsertFlowNodePositionInModule,
  } = await import('@/lib/db/extractions')
  return upsertFlowNodePositionInModule(input)
}
