import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import {
  writeTaskStatusCatalogToMetadataJson,
  type BuiltInTaskStatus,
} from '@/lib/task-statuses'
import { flattenPlaybookPhases, normalizePlaybookPhases } from '@/lib/playbook-tree'
import {
  parseTaskNumericFormulaJson,
  serializeTaskNumericFormula,
} from '@/lib/task-numeric-formulas'
import {
  calculateGrossMarginPct,
  calculateMaxVariableCostAllowed,
  calculateMonthlyRunRate,
  calculateProjectedPlanCapCost,
  calculateRecommendedChatTokensPerDay,
  calculateRecommendedExtractionsPerDay,
  classifyProfitabilityStatus,
  normalizeMarginPct,
  type ProfitabilityStatus,
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

interface DbExtractionMemberRow {
  extraction_id: string
  user_id: string
  role: string
  created_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionFolderMemberRow {
  folder_id: string
  owner_user_id: string
  member_user_id: string
  role: string
  created_at: Date | string
  member_name: string | null
  member_email: string | null
}

interface DbCircleExtractionRow extends DbExtractionRow {
  access_role: string
  owner_name: string | null
  owner_email: string | null
}

interface DbSharedExtractionRow extends DbExtractionRow {
  access_role: string
  owner_name: string | null
  owner_email: string | null
  share_source: 'direct' | 'folder'
  root_folder_id: string | null
  root_folder_name: string | null
}

interface DbPublicExtractionRow extends DbExtractionRow {
  owner_name: string | null
  owner_email: string | null
}

interface DbSharedExtractionFolderRow extends DbExtractionFolderRow {
  root_folder_id: string
  owner_user_id: string
  owner_name: string | null
  owner_email: string | null
}

interface DbExtractionAccessRow extends DbExtractionRow {
  access_role: string | null
}

interface DbExtractionLineageRow {
  id: string
  user_id: string
  parent_extraction_id: string | null
  video_title: string | null
  source_label: string | null
  objective: string
  created_at: Date | string
  owner_name: string | null
  owner_email: string | null
}

interface DbExtractionCountRow {
  count: number | string
}

interface DbExtractionRecentCloneRow {
  id: string
  parent_extraction_id: string | null
  user_id: string
  video_title: string | null
  source_label: string | null
  objective: string
  created_at: Date | string
  depth: number | string
  owner_name: string | null
  owner_email: string | null
  parent_video_title: string | null
  parent_source_label: string | null
  parent_objective: string | null
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

interface DbShareTokenRow {
  token: string
  extraction_id: string
  user_id: string
  created_at: Date | string
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

interface DbExtractionTaskAttachmentRow {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  attachment_type: string
  storage_provider: string
  url: string
  thumbnail_url: string | null
  title: string | null
  mime_type: string | null
  size_bytes: number | string | null
  metadata_json: string
  created_at: Date | string
  updated_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionTaskCommentRow {
  id: string
  task_id: string
  extraction_id: string
  user_id: string
  parent_comment_id: string | null
  is_hidden: boolean
  content: string
  created_at: Date | string
  updated_at: Date | string
  user_name: string | null
  user_email: string | null
}

interface DbExtractionTaskLikeSummaryRow {
  likes_count: number | string
  liked_by_me: boolean
  shares_count: number | string
  shared_by_me: boolean
  followers_count: number | string
  following_by_me: boolean
  views_count: number | string
  viewed_by_me: boolean
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
    raw_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
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

const DB_INIT_SIGNATURE = '2026-03-14-playbook-clone-permission-v1'

function getDbReadyPromise() {
  const shouldReinitialize =
    !globalForDb.__actionExtractorDbReady ||
    globalForDb.__actionExtractorDbInitSignature !== DB_INIT_SIGNATURE

  if (shouldReinitialize) {
    let readyPromise: Promise<void>
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

function normalizeExtractionMemberRole(value: unknown): ExtractionMemberRole {
  if (value === 'editor') return 'editor'
  return 'viewer'
}

function normalizeExtractionFolderMemberRole(value: unknown): ExtractionFolderMemberRole {
  return value === 'viewer' ? 'viewer' : 'viewer'
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

function resolveDbExtractionDisplayTitle(input: {
  id: string
  video_title: string | null
  source_label: string | null
  objective: string | null
}) {
  const videoTitle = input.video_title?.trim()
  if (videoTitle) return videoTitle

  const sourceLabel = input.source_label?.trim()
  if (sourceLabel) return sourceLabel

  const objective = input.objective?.trim() ?? ''
  if (objective) {
    return objective.length > 96 ? `${objective.slice(0, 96)}...` : objective
  }

  return `Playbook ${input.id.slice(0, 8)}`
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

function mapExtractionMemberRow(row: DbExtractionMemberRow): DbExtractionMember {
  return {
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    role: normalizeExtractionMemberRole(row.role),
    created_at: toIso(row.created_at),
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
  }
}

function mapExtractionFolderMemberRow(row: DbExtractionFolderMemberRow): DbExtractionFolderMember {
  return {
    folder_id: row.folder_id,
    owner_user_id: row.owner_user_id,
    member_user_id: row.member_user_id,
    role: normalizeExtractionFolderMemberRole(row.role),
    created_at: toIso(row.created_at),
    member_name: row.member_name ?? null,
    member_email: row.member_email ?? null,
  }
}

function mapSharedExtractionFolderRow(row: DbSharedExtractionFolderRow): DbSharedExtractionFolder {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    parent_id: row.parent_id ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    root_folder_id: row.root_folder_id,
    owner_user_id: row.owner_user_id,
    owner_name: row.owner_name ?? null,
    owner_email: row.owner_email ?? null,
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

function mapShareTokenRow(row: DbShareTokenRow): DbShareToken {
  return {
    token: row.token,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    created_at: toIso(row.created_at),
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

function normalizeAttachmentType(value: unknown): ExtractionTaskAttachmentType {
  if (value === 'image' || value === 'audio' || value === 'youtube_link' || value === 'note') {
    return value
  }
  return 'pdf'
}

function normalizeAttachmentStorageProvider(value: unknown): ExtractionTaskAttachmentStorageProvider {
  return value === 'cloudinary' ? 'cloudinary' : 'external'
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

function mapExtractionTaskAttachmentRow(row: DbExtractionTaskAttachmentRow): DbExtractionTaskAttachment {
  return {
    id: row.id,
    task_id: row.task_id,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    attachment_type: normalizeAttachmentType(row.attachment_type),
    storage_provider: normalizeAttachmentStorageProvider(row.storage_provider),
    url: row.url,
    thumbnail_url: row.thumbnail_url,
    title: row.title,
    mime_type: row.mime_type,
    size_bytes: parseDbNullableInteger(row.size_bytes),
    metadata_json: row.metadata_json || '{}',
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    user_name: row.user_name ?? null,
    user_email: row.user_email ?? null,
  }
}

function mapExtractionTaskCommentRow(row: DbExtractionTaskCommentRow): DbExtractionTaskComment {
  return {
    id: row.id,
    task_id: row.task_id,
    extraction_id: row.extraction_id,
    user_id: row.user_id,
    parent_comment_id: row.parent_comment_id ?? null,
    is_hidden: row.is_hidden === true,
    content: row.content,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    user_name: row.user_name,
    user_email: row.user_email,
  }
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
  await ensureDbReady()
  const { rows } = await pool.query<{
    id: string
    user_id: string
    url: string | null
    video_id: string | null
    video_title: string | null
    thumbnail_url: string | null
    share_visibility: string | null
    source_type: string | null
    source_label: string | null
    source_text: string | null
    source_file_url: string | null
    source_file_name: string | null
    source_file_size_bytes: number | null
    source_file_mime_type: string | null
    has_access: boolean
  }>(
    `
      SELECT
        e.id,
        e.user_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.share_visibility,
        e.source_type,
        e.source_label,
        e.source_text,
        e.source_file_url,
        e.source_file_name,
        e.source_file_size_bytes,
        e.source_file_mime_type,
        (
          e.user_id = $2
          OR e.share_visibility IN ('public', 'unlisted')
          OR EXISTS (
            SELECT 1 FROM extraction_members m
            WHERE m.extraction_id = e.id AND m.user_id = $2
          )
        ) AS has_access
      FROM extractions e
      WHERE e.id = $1
      LIMIT 1
    `,
    [input.extractionId, input.requestingUserId ?? '']
  )

  if (!rows[0] || !rows[0].has_access) return null

  const row = rows[0]
  return {
    sourceType: row.source_type ?? 'youtube',
    sourceLabel: row.source_label ?? null,
    url: row.url ?? null,
    videoId: row.video_id ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    videoTitle: row.video_title ?? null,
    sourceText: row.source_text ?? null,
    sourceFileUrl: row.source_file_url ?? null,
    sourceFileName: row.source_file_name ?? null,
    sourceFileSizeBytes: row.source_file_size_bytes != null ? Number(row.source_file_size_bytes) : null,
    sourceFileMimeType: row.source_file_mime_type ?? null,
    shareVisibility: normalizeExtractionShareVisibility(row.share_visibility),
    userId: row.user_id,
  }
}

export async function listExtractionAdditionalSources(input: {
  extractionId: string
  requestingUserId: string | null
}): Promise<DbExtractionAdditionalSource[] | null> {
  await ensureDbReady()
  const { rows } = await pool.query<
    DbExtractionAdditionalSourceRow & { has_access: boolean }
  >(
    `
      SELECT
        s.id,
        s.extraction_id,
        s.created_by_user_id,
        s.source_type,
        s.source_label,
        s.url,
        s.source_text,
        s.source_file_url,
        s.source_file_name,
        s.source_file_size_bytes,
        s.source_file_mime_type,
        s.analysis_status,
        s.analyzed_at,
        s.created_at,
        (
          e.user_id = $2
          OR e.share_visibility IN ('public', 'unlisted')
          OR EXISTS (
            SELECT 1 FROM extraction_members m
            WHERE m.extraction_id = e.id AND m.user_id = $2
          )
        ) AS has_access
      FROM extraction_additional_sources s
      INNER JOIN extractions e ON e.id = s.extraction_id
      WHERE s.extraction_id = $1
      ORDER BY s.created_at ASC
    `,
    [input.extractionId, input.requestingUserId ?? '']
  )

  if (rows.length === 0) {
    const accessCheck = await pool.query<{ has_access: boolean }>(
      `
        SELECT (
          e.user_id = $2
          OR e.share_visibility IN ('public', 'unlisted')
          OR EXISTS (
            SELECT 1 FROM extraction_members m
            WHERE m.extraction_id = e.id AND m.user_id = $2
          )
        ) AS has_access
        FROM extractions e
        WHERE e.id = $1
        LIMIT 1
      `,
      [input.extractionId, input.requestingUserId ?? '']
    )

    if (!accessCheck.rows[0]?.has_access) return null
    return []
  }

  if (!rows[0].has_access) return null
  return rows.map(mapExtractionAdditionalSourceRow)
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
  await ensureDbReady()
  const id = randomUUID()
  const resolvedAnalysisStatus = input.analysisStatus ?? 'pending'
  const { rows } = await pool.query<DbExtractionAdditionalSourceRow>(
    `
      INSERT INTO extraction_additional_sources (
        id,
        extraction_id,
        created_by_user_id,
        source_type,
        source_label,
        url,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        analysis_status,
        analyzed_at
      )
      SELECT
        $1,
        e.id,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      FROM extractions e
      WHERE e.id = $13 AND e.user_id = $2
      ON CONFLICT (extraction_id, url) DO NOTHING
      RETURNING
        id,
        extraction_id,
        created_by_user_id,
        source_type,
        source_label,
        url,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        analysis_status,
        analyzed_at,
        created_at
    `,
    [
      id,
      input.userId,
      input.sourceType,
      input.sourceLabel ?? null,
      input.url ?? null,
      input.sourceText ?? null,
      input.sourceFileUrl ?? null,
      input.sourceFileName ?? null,
      input.sourceFileSizeBytes ?? null,
      input.sourceFileMimeType ?? null,
      resolvedAnalysisStatus,
      resolvedAnalysisStatus === 'analyzed' ? (input.analyzedAt ?? new Date().toISOString()) : null,
      input.extractionId,
    ]
  )

  return rows[0] ? mapExtractionAdditionalSourceRow(rows[0]) : null
}

export async function deleteExtractionAdditionalSourceForUser(input: {
  extractionId: string
  sourceId: string
  userId: string
}): Promise<boolean> {
  await ensureDbReady()
  const { rowCount } = await pool.query(
    `
      DELETE FROM extraction_additional_sources s
      USING extractions e
      WHERE s.id = $1
        AND s.extraction_id = $2
        AND e.id = s.extraction_id
        AND e.user_id = $3
        AND COALESCE(s.analysis_status, 'pending') <> 'analyzed'
    `,
    [input.sourceId, input.extractionId, input.userId]
  )

  return (rowCount ?? 0) > 0
}

export async function markExtractionAdditionalSourcesAnalyzedForUser(input: {
  extractionId: string
  userId: string
  sourceIds: string[]
}) {
  await ensureDbReady()
  const normalizedIds = Array.from(new Set(input.sourceIds.map((value) => value.trim()).filter(Boolean)))
  if (normalizedIds.length === 0) return []

  const { rows } = await pool.query<DbExtractionAdditionalSourceRow>(
    `
      UPDATE extraction_additional_sources s
      SET
        analysis_status = 'analyzed',
        analyzed_at = COALESCE(s.analyzed_at, NOW())
      FROM extractions e
      WHERE
        s.extraction_id = $1
        AND s.id = ANY($2::text[])
        AND e.id = s.extraction_id
        AND e.user_id = $3
      RETURNING
        s.id,
        s.extraction_id,
        s.created_by_user_id,
        s.source_type,
        s.source_label,
        s.url,
        s.source_text,
        s.source_file_url,
        s.source_file_name,
        s.source_file_size_bytes,
        s.source_file_mime_type,
        s.analysis_status,
        s.analyzed_at,
        s.created_at
    `,
    [input.extractionId, normalizedIds, input.userId]
  )

  return rows.map(mapExtractionAdditionalSourceRow)
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
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
        ranked.id,
        ranked.user_id,
        ranked.url,
        ranked.video_id,
        ranked.video_title,
        ranked.thumbnail_url,
        ranked.extraction_mode,
        ranked.objective,
        ranked.phases_json,
        ranked.pro_tip,
        ranked.metadata_json,
        ranked.share_visibility,
        ranked.clone_permission,
        ranked.created_at,
        ranked.source_type,
        ranked.transcript_source,
        ranked.source_label,
        ranked.folder_id,
        ranked.order_number,
        ranked.is_starred,
        ranked.source_file_url,
        ranked.source_file_name,
        ranked.has_source_text,
        (
          SELECT COALESCE(
            jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name),
            '[]'::jsonb
          )
          FROM extraction_tag_assignments eta
          JOIN extraction_tags t ON t.id = eta.tag_id
          WHERE eta.extraction_id = ranked.id
        )::text AS tags_json
      FROM (
        SELECT
          id,
          user_id,
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
          transcript_source,
          source_label,
          folder_id,
          is_starred,
          source_file_url,
          source_file_name,
          (source_text IS NOT NULL AND source_text <> '') AS has_source_text,
          ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)::int AS order_number
        FROM extractions
        WHERE user_id = $1
      ) AS ranked
      ORDER BY ranked.created_at DESC, ranked.id DESC
      LIMIT $2
    `,
    [userId, limit]
  )
  return rows.map(mapExtractionRow)
}

export async function listAdminExtractionsByUser(
  userId: string,
  limit = 30
): Promise<AdminUserExtractionCostDetail[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbAdminUserExtractionCostRow>(
    `
      SELECT
        ranked.id,
        ranked.user_id,
        ranked.url,
        ranked.video_id,
        ranked.video_title,
        ranked.thumbnail_url,
        ranked.extraction_mode,
        ranked.objective,
        ranked.phases_json,
        ranked.pro_tip,
        ranked.metadata_json,
        ranked.share_visibility,
        ranked.created_at,
        ranked.source_type,
        ranked.transcript_source,
        ranked.source_label,
        ranked.folder_id,
        ranked.order_number,
        ranked.is_starred,
        ranked.source_text,
        ranked.source_file_url,
        ranked.source_file_name,
        ranked.source_file_size_bytes,
        ranked.source_file_mime_type,
        ranked.has_source_text,
        COALESCE(ai.total_ai_calls, 0)::int AS total_ai_calls,
        COALESCE(ai.total_ai_cost_usd, 0) AS total_ai_cost_usd,
        COALESCE(ai.audio_transcription_calls, 0)::int AS audio_transcription_calls,
        COALESCE(ai.audio_transcription_cost_usd, 0) AS audio_transcription_cost_usd
      FROM (
        SELECT
          id,
          user_id,
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
          created_at,
          source_type,
          transcript_source,
          source_label,
          folder_id,
          is_starred,
          source_text,
          source_file_url,
          source_file_name,
          source_file_size_bytes,
          source_file_mime_type,
          (source_text IS NOT NULL AND source_text <> '') AS has_source_text,
          ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)::int AS order_number
        FROM extractions
        WHERE user_id = $1
      ) AS ranked
      LEFT JOIN (
        SELECT
          extraction_id,
          COUNT(*)::int AS total_ai_calls,
          COALESCE(SUM(cost_usd), 0) AS total_ai_cost_usd,
          COUNT(*) FILTER (WHERE use_type = 'transcription')::int AS audio_transcription_calls,
          COALESCE(SUM(cost_usd) FILTER (WHERE use_type = 'transcription'), 0) AS audio_transcription_cost_usd
        FROM ai_usage_log
        WHERE user_id = $1
          AND extraction_id IS NOT NULL
        GROUP BY extraction_id
      ) ai ON ai.extraction_id = ranked.id
      ORDER BY ranked.created_at DESC, ranked.id DESC
      LIMIT $2
    `,
    [userId, limit]
  )

  return rows.map((row) => ({
    id: row.id,
    url: row.url ?? null,
    video_id: row.video_id ?? null,
    video_title: row.video_title ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    extraction_mode: row.extraction_mode,
    objective: row.objective,
    created_at: toIso(row.created_at),
    source_type: row.source_type ?? 'youtube',
    transcript_source: row.transcript_source ?? null,
    total_ai_calls: parseDbInteger(row.total_ai_calls),
    total_ai_cost_usd: Number(row.total_ai_cost_usd ?? 0),
    audio_transcription_calls: parseDbInteger(row.audio_transcription_calls),
    audio_transcription_cost_usd: Number(row.audio_transcription_cost_usd ?? 0),
  }))
}

export async function setExtractionStarredForUser(input: {
  id: string
  userId: string
  starred: boolean
}): Promise<DbExtraction | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions
      SET is_starred = $3
      WHERE id = $1 AND user_id = $2
      RETURNING
        id, user_id, url, video_id, video_title, thumbnail_url,
        extraction_mode, objective, phases_json, pro_tip, metadata_json,
        share_visibility, created_at, source_type, source_label, folder_id, is_starred
    `,
    [input.id, input.userId, input.starred]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function assignUnfolderedExtractionsToGeneralForUser(userId: string) {
  await ensureDbReady()
  await ensureDefaultExtractionFoldersForUser(userId)

  const generalFolderId = buildSystemExtractionFolderIdForUser({
    userId,
    key: 'general',
  })

  await pool.query(
    `
      UPDATE extractions
      SET folder_id = $2
      WHERE user_id = $1 AND folder_id IS NULL
    `,
    [userId, generalFolderId]
  )

  return generalFolderId
}

export async function listCircleExtractionsForMember(userId: string, limit = 30) {
  await ensureDbReady()
  const { rows } = await pool.query<DbCircleExtractionRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.extraction_mode,
        e.objective,
        e.phases_json,
        e.pro_tip,
        e.metadata_json,
        e.share_visibility,
        e.clone_permission,
        e.created_at,
        e.source_type,
        e.source_label,
        e.folder_id,
        e.source_file_url,
        e.source_file_name,
        e.source_file_size_bytes,
        e.source_file_mime_type,
        (e.source_text IS NOT NULL AND e.source_text <> '') AS has_source_text,
        m.role AS access_role,
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM extraction_members m
      INNER JOIN extractions e ON e.id = m.extraction_id
      INNER JOIN users owner ON owner.id = e.user_id
      WHERE
        m.user_id = $1
        AND e.user_id <> $1
        AND e.share_visibility = 'circle'
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $2
    `,
    [userId, limit]
  )

  return rows
    .map((row) => ({
      extraction: mapExtractionRow(row),
      access_role: normalizeExtractionMemberRole(row.access_role),
      owner_name: row.owner_name ?? null,
      owner_email: row.owner_email ?? null,
    }))
    .filter((row): row is DbCircleExtraction => row.access_role === 'editor' || row.access_role === 'viewer')
}

export async function listExtractionsSharedViaFoldersForMember(userId: string, limit = 80) {
  await ensureDbReady()
  const { rows } = await pool.query<DbSharedExtractionRow>(
    `
      WITH RECURSIVE shared_roots AS (
        SELECT
          fm.folder_id AS root_folder_id,
          fm.owner_user_id
        FROM extraction_folder_members fm
        WHERE fm.member_user_id = $1
      ),
      shared_tree AS (
        SELECT
          sr.owner_user_id,
          sr.root_folder_id,
          sr.root_folder_id AS folder_id,
          0::int AS depth
        FROM shared_roots sr
        UNION ALL
        SELECT
          st.owner_user_id,
          st.root_folder_id,
          child.id AS folder_id,
          st.depth + 1
        FROM extraction_folders child
        INNER JOIN shared_tree st
          ON child.parent_id = st.folder_id
         AND child.user_id = st.owner_user_id
      ),
      visible_extractions AS (
        SELECT
          e.id,
          e.user_id,
          e.url,
          e.video_id,
          e.video_title,
          e.thumbnail_url,
          e.extraction_mode,
          e.objective,
          e.phases_json,
          e.pro_tip,
          e.metadata_json,
          e.share_visibility,
          e.clone_permission,
          e.created_at,
          e.source_type,
          e.source_label,
          e.folder_id,
          e.source_file_url,
          e.source_file_name,
          e.source_file_size_bytes,
          e.source_file_mime_type,
          (e.source_text IS NOT NULL AND e.source_text <> '') AS has_source_text,
          st.root_folder_id,
          st.depth
        FROM extractions e
        INNER JOIN shared_tree st
          ON e.folder_id = st.folder_id
         AND e.user_id = st.owner_user_id
        WHERE e.user_id <> $1
      ),
      dedup AS (
        SELECT DISTINCT ON (ve.id)
          ve.id,
          ve.user_id,
          ve.url,
          ve.video_id,
          ve.video_title,
          ve.thumbnail_url,
          ve.extraction_mode,
          ve.objective,
          ve.phases_json,
          ve.pro_tip,
          ve.metadata_json,
          ve.share_visibility,
          ve.clone_permission,
          ve.created_at,
          ve.source_type,
          ve.source_label,
          ve.folder_id,
          ve.source_file_url,
          ve.source_file_name,
          ve.source_file_size_bytes,
          ve.source_file_mime_type,
          ve.has_source_text,
          ve.root_folder_id
        FROM visible_extractions ve
        ORDER BY ve.id, ve.depth ASC, ve.created_at DESC
      )
      SELECT
        d.id,
        d.user_id,
        d.url,
        d.video_id,
        d.video_title,
        d.thumbnail_url,
        d.extraction_mode,
        d.objective,
        d.phases_json,
        d.pro_tip,
        d.metadata_json,
        d.share_visibility,
        d.clone_permission,
        d.created_at,
        d.source_type,
        d.source_label,
        d.folder_id,
        d.source_file_url,
        d.source_file_name,
        d.source_file_size_bytes,
        d.source_file_mime_type,
        d.has_source_text,
        'viewer'::text AS access_role,
        owner.name AS owner_name,
        owner.email AS owner_email,
        'folder'::text AS share_source,
        d.root_folder_id,
        root_folder.name AS root_folder_name
      FROM dedup d
      INNER JOIN users owner ON owner.id = d.user_id
      LEFT JOIN extraction_folders root_folder
        ON root_folder.id = d.root_folder_id
       AND root_folder.user_id = d.user_id
      ORDER BY d.created_at DESC, d.id DESC
      LIMIT $2
    `,
    [userId, limit]
  )

  return rows
    .map((row) => ({
      extraction: mapExtractionRow(row),
      access_role: normalizeExtractionMemberRole(row.access_role),
      owner_name: row.owner_name ?? null,
      owner_email: row.owner_email ?? null,
      share_source: row.share_source,
      root_folder_id: row.root_folder_id ?? null,
      root_folder_name: row.root_folder_name ?? null,
    }))
    .filter((row): row is DbSharedExtraction => row.access_role === 'editor' || row.access_role === 'viewer')
}

export async function findExtractionOrderNumberForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionOrderNumberRow>(
    `
      SELECT ranked.order_number
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)::int AS order_number
        FROM extractions
        WHERE user_id = $1
      ) AS ranked
      WHERE ranked.id = $2
      LIMIT 1
    `,
    [input.userId, input.id]
  )

  if (!rows[0]) {
    return null
  }

  return parseDbInteger(rows[0].order_number)
}

export async function deleteExtractionByIdForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM extractions
      WHERE id = $1 AND user_id = $2
    `,
    [input.id, input.userId]
  )

  return result.rowCount ?? 0
}

export async function deleteExtractionsByUser(userId: string) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM extractions
      WHERE user_id = $1
    `,
    [userId]
  )

  return result.rowCount ?? 0
}

export async function findExtractionById(id: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
        id,
        user_id,
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
        created_at
      FROM extractions
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function findPublicExtractionById(id: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbPublicExtractionRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.extraction_mode,
        e.objective,
        e.phases_json,
        e.pro_tip,
        e.metadata_json,
        e.share_visibility,
        e.clone_permission,
        e.created_at,
        e.source_type,
        e.source_label,
        e.folder_id,
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM extractions e
      INNER JOIN users owner ON owner.id = e.user_id
      WHERE
        e.id = $1
        AND e.share_visibility = 'public'
        AND owner.blocked_at IS NULL
      LIMIT 1
    `,
    [id]
  )

  if (!rows[0]) return null
  return {
    extraction: mapExtractionRow(rows[0]),
    owner_name: rows[0].owner_name ?? null,
    owner_email: rows[0].owner_email ?? null,
  } satisfies DbPublicExtraction
}

export async function listPublicExtractionsForSearch(input: { query: string; limit: number }) {
  await ensureDbReady()
  const normalizedQuery = input.query.trim()
  const hasQuery = normalizedQuery.length > 0
  const likeQuery = `%${normalizedQuery}%`
  const startsWithQuery = `${normalizedQuery}%`
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(60, Math.trunc(input.limit))) : 20

  const { rows } = await pool.query<DbPublicExtractionRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.extraction_mode,
        e.objective,
        e.phases_json,
        e.pro_tip,
        e.metadata_json,
        e.share_visibility,
        e.clone_permission,
        e.created_at,
        e.source_type,
        e.source_label,
        e.folder_id,
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM extractions e
      INNER JOIN users owner ON owner.id = e.user_id
      WHERE
        e.share_visibility = 'public'
        AND owner.blocked_at IS NULL
        AND (
          NOT $1
          OR COALESCE(e.video_title, '') ILIKE $2
          OR COALESCE(e.source_label, '') ILIKE $2
          OR COALESCE(e.objective, '') ILIKE $2
          OR COALESCE(e.url, '') ILIKE $2
          OR COALESCE(owner.name, '') ILIKE $2
          OR COALESCE(owner.email, '') ILIKE $2
        )
      ORDER BY
        CASE
          WHEN $1 AND COALESCE(e.video_title, '') ILIKE $3 THEN 0
          WHEN $1 AND COALESCE(e.source_label, '') ILIKE $3 THEN 1
          WHEN $1 AND COALESCE(e.objective, '') ILIKE $3 THEN 2
          ELSE 3
        END ASC,
        e.created_at DESC,
        e.id DESC
      LIMIT $4
    `,
    [hasQuery, likeQuery, startsWithQuery, limit]
  )

  return rows.map((row) => ({
    extraction: mapExtractionRow(row),
    owner_name: row.owner_name ?? null,
    owner_email: row.owner_email ?? null,
  })) satisfies DbPublicExtraction[]
}

export async function findExtractionAccessForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionAccessRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.extraction_mode,
        e.objective,
        e.phases_json,
        e.pro_tip,
        e.metadata_json,
        e.share_visibility,
        e.created_at,
        e.source_type,
        e.source_label,
        e.folder_id,
        CASE
          WHEN e.user_id = $2 THEN 'owner'
          WHEN EXISTS (
            WITH RECURSIVE folder_ancestors AS (
              SELECT f.id, f.parent_id
              FROM extraction_folders f
              WHERE
                e.folder_id IS NOT NULL
                AND f.id = e.folder_id
                AND f.user_id = e.user_id
              UNION ALL
              SELECT parent.id, parent.parent_id
              FROM extraction_folders parent
              INNER JOIN folder_ancestors fa
                ON fa.parent_id = parent.id
              WHERE parent.user_id = e.user_id
            )
            SELECT 1
            FROM extraction_folder_members fm
            WHERE
              fm.member_user_id = $2
              AND fm.owner_user_id = e.user_id
              AND fm.folder_id IN (SELECT id FROM folder_ancestors)
            LIMIT 1
          ) THEN 'viewer'
          WHEN e.share_visibility = 'circle' THEN m.role
          ELSE NULL
        END AS access_role
      FROM extractions e
      LEFT JOIN extraction_members m
        ON m.extraction_id = e.id
        AND m.user_id = $2
      WHERE e.id = $1
      LIMIT 1
    `,
    [input.id, input.userId]
  )

  if (!rows[0]) {
    return { extraction: null, role: null as ExtractionAccessRole | null }
  }

  return {
    extraction: mapExtractionRow(rows[0]),
    role: normalizeExtractionAccessRole(rows[0].access_role),
  }
}

export async function findCloneableExtractionAccessForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionAccessRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.parent_extraction_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.extraction_mode,
        e.objective,
        e.phases_json,
        e.pro_tip,
        e.metadata_json,
        e.share_visibility,
        e.clone_permission,
        e.created_at,
        e.source_type,
        e.source_label,
        e.folder_id,
        e.source_text,
        e.source_file_url,
        e.source_file_name,
        e.source_file_size_bytes,
        e.source_file_mime_type,
        e.transcript_source,
        CASE
          WHEN e.user_id = $2 THEN 'owner'
          WHEN EXISTS (
            WITH RECURSIVE folder_ancestors AS (
              SELECT f.id, f.parent_id
              FROM extraction_folders f
              WHERE
                e.folder_id IS NOT NULL
                AND f.id = e.folder_id
                AND f.user_id = e.user_id
              UNION ALL
              SELECT parent.id, parent.parent_id
              FROM extraction_folders parent
              INNER JOIN folder_ancestors fa
                ON fa.parent_id = parent.id
              WHERE parent.user_id = e.user_id
            )
            SELECT 1
            FROM extraction_folder_members fm
            WHERE
              fm.member_user_id = $2
              AND fm.owner_user_id = e.user_id
              AND fm.folder_id IN (SELECT id FROM folder_ancestors)
            LIMIT 1
          ) THEN 'viewer'
          WHEN e.share_visibility = 'circle' AND m.role IS NOT NULL THEN m.role
          WHEN e.share_visibility IN ('public', 'unlisted') THEN 'viewer'
          ELSE NULL
        END AS access_role
      FROM extractions e
      LEFT JOIN extraction_members m
        ON m.extraction_id = e.id
        AND m.user_id = $2
      WHERE e.id = $1
      LIMIT 1
    `,
    [input.id, input.userId]
  )

  if (!rows[0]) {
    return { extraction: null, role: null as ExtractionAccessRole | null }
  }

  return {
    extraction: mapExtractionRow(rows[0]),
    role: normalizeExtractionAccessRole(rows[0].access_role),
  }
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

async function readExtractionLineageRowById(id: string) {
  const { rows } = await pool.query<DbExtractionLineageRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.parent_extraction_id,
        e.video_title,
        e.source_label,
        e.objective,
        e.created_at,
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM extractions e
      INNER JOIN users owner
        ON owner.id = e.user_id
      WHERE e.id = $1
      LIMIT 1
    `,
    [id]
  )

  return rows[0] ?? null
}

export async function buildExtractionLineageForUser(input: {
  extractionId: string
  userId: string
  includeCopyStats: boolean
}) {
  await ensureDbReady()

  const nodes: DbPlaybookLineageNode[] = []
  const seen = new Set<string>()
  let currentId = input.extractionId.trim()
  let depth = 0

  while (currentId && depth < 24 && !seen.has(currentId)) {
    seen.add(currentId)

    const row = await readExtractionLineageRowById(currentId)
    if (!row) break

    const access = await findCloneableExtractionAccessForUser({
      id: currentId,
      userId: input.userId,
    })
    const accessible = Boolean(access.role)

    nodes.push({
      depth,
      isCurrent: depth === 0,
      isOriginal: !row.parent_extraction_id,
      accessible,
      title: accessible
        ? resolveDbExtractionDisplayTitle({
            id: row.id,
            video_title: row.video_title,
            source_label: row.source_label,
            objective: row.objective,
          })
        : null,
      ownerName: accessible ? row.owner_name : null,
      ownerEmail: accessible ? row.owner_email : null,
      createdAt: accessible ? toIso(row.created_at) : null,
    })

    currentId = row.parent_extraction_id ?? ''
    depth += 1
  }

  let copies: DbPlaybookLineageData['copies'] = null

  if (input.includeCopyStats) {
    const directCountResult = await pool.query<DbExtractionCountRow>(
      `
        SELECT COUNT(*) AS count
        FROM extractions
        WHERE parent_extraction_id = $1
      `,
      [input.extractionId]
    )

    const totalCountResult = await pool.query<DbExtractionCountRow>(
      `
        WITH RECURSIVE descendants AS (
          SELECT id
          FROM extractions
          WHERE parent_extraction_id = $1
          UNION ALL
          SELECT child.id
          FROM extractions child
          INNER JOIN descendants d
            ON child.parent_extraction_id = d.id
        )
        SELECT COUNT(*) AS count
        FROM descendants
      `,
      [input.extractionId]
    )

    const recentCopiesResult = await pool.query<DbExtractionRecentCloneRow>(
      `
        WITH RECURSIVE descendants AS (
          SELECT
            e.id,
            e.parent_extraction_id,
            e.user_id,
            e.video_title,
            e.source_label,
            e.objective,
            e.created_at,
            1::int AS depth
          FROM extractions e
          WHERE e.parent_extraction_id = $1
          UNION ALL
          SELECT
            child.id,
            child.parent_extraction_id,
            child.user_id,
            child.video_title,
            child.source_label,
            child.objective,
            child.created_at,
            d.depth + 1
          FROM extractions child
          INNER JOIN descendants d
            ON child.parent_extraction_id = d.id
        )
        SELECT
          d.id,
          d.parent_extraction_id,
          d.user_id,
          d.video_title,
          d.source_label,
          d.objective,
          d.created_at,
          d.depth,
          owner.name AS owner_name,
          owner.email AS owner_email,
          parent.video_title AS parent_video_title,
          parent.source_label AS parent_source_label,
          parent.objective AS parent_objective
        FROM descendants d
        INNER JOIN users owner
          ON owner.id = d.user_id
        LEFT JOIN extractions parent
          ON parent.id = d.parent_extraction_id
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 10
      `,
      [input.extractionId]
    )

    copies = {
      directCount: directCountResult.rows[0] ? parseDbInteger(directCountResult.rows[0].count) : 0,
      totalCount: totalCountResult.rows[0] ? parseDbInteger(totalCountResult.rows[0].count) : 0,
      recent: recentCopiesResult.rows.map((row) => ({
        depth: parseDbInteger(row.depth),
        title: resolveDbExtractionDisplayTitle({
          id: row.id,
          video_title: row.video_title,
          source_label: row.source_label,
          objective: row.objective,
        }),
        copiedByName: row.owner_name,
        copiedByEmail: row.owner_email,
        createdAt: toIso(row.created_at),
        copiedFromTitle: row.parent_extraction_id
          ? resolveDbExtractionDisplayTitle({
              id: row.parent_extraction_id,
              video_title: row.parent_video_title,
              source_label: row.parent_source_label,
              objective: row.parent_objective,
            })
          : null,
      })),
    }
  }

  return {
    generation: Math.max(0, nodes.length - 1),
    nodes,
    copies,
  } satisfies DbPlaybookLineageData
}

export async function findExtractionByIdForUser(input: { id: string; userId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
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
        created_at,
        clone_permission,
        source_type,
        source_label,
        folder_id,
        is_starred,
        source_text,
        source_file_url,
        source_file_name,
        source_file_size_bytes,
        source_file_mime_type,
        (source_text IS NOT NULL AND source_text <> '') AS has_source_text,
        transcript_source,
        (
          SELECT COALESCE(
            jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.name),
            '[]'::jsonb
          )
          FROM extraction_tag_assignments eta
          JOIN extraction_tags t ON t.id = eta.tag_id
          WHERE eta.extraction_id = extractions.id
        )::text AS tags_json
      FROM extractions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [input.id, input.userId]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function listExtractionMembersForOwner(input: { extractionId: string; ownerUserId: string }) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionMemberRow>(
    `
      SELECT
        m.extraction_id,
        m.user_id,
        m.role,
        m.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_members m
      INNER JOIN extractions e
        ON e.id = m.extraction_id
      INNER JOIN users u
        ON u.id = m.user_id
      WHERE
        m.extraction_id = $1
        AND e.user_id = $2
      ORDER BY m.created_at ASC
    `,
    [input.extractionId, input.ownerUserId]
  )
  return rows.map(mapExtractionMemberRow)
}

export async function upsertExtractionMemberForOwner(input: {
  extractionId: string
  ownerUserId: string
  memberUserId: string
  role: ExtractionMemberRole
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionMemberRow>(
    `
      WITH target_extraction AS (
        SELECT id
        FROM extractions
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      ),
      upserted AS (
        INSERT INTO extraction_members (
          extraction_id,
          user_id,
          role
        )
        SELECT
          target_extraction.id,
          $3,
          $4
        FROM target_extraction
        WHERE $3 <> $2
        ON CONFLICT (extraction_id, user_id)
        DO UPDATE SET role = EXCLUDED.role
        RETURNING
          extraction_id,
          user_id,
          role,
          created_at
      )
      SELECT
        upserted.extraction_id,
        upserted.user_id,
        upserted.role,
        upserted.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM upserted
      INNER JOIN users u ON u.id = upserted.user_id
      LIMIT 1
    `,
    [input.extractionId, input.ownerUserId, input.memberUserId, input.role]
  )
  return rows[0] ? mapExtractionMemberRow(rows[0]) : null
}

export async function removeExtractionMemberForOwner(input: {
  extractionId: string
  ownerUserId: string
  memberUserId: string
}) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM extraction_members m
      USING extractions e
      WHERE
        m.extraction_id = $1
        AND m.user_id = $2
        AND e.id = m.extraction_id
        AND e.user_id = $3
    `,
    [input.extractionId, input.memberUserId, input.ownerUserId]
  )
  return result.rowCount ?? 0
}

export async function listExtractionFolderMembersForOwner(input: {
  folderId: string
  ownerUserId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionFolderMemberRow>(
    `
      SELECT
        fm.folder_id,
        fm.owner_user_id,
        fm.member_user_id,
        fm.role,
        fm.created_at,
        u.name AS member_name,
        u.email AS member_email
      FROM extraction_folder_members fm
      INNER JOIN extraction_folders f
        ON f.id = fm.folder_id
       AND f.user_id = fm.owner_user_id
      INNER JOIN users u
        ON u.id = fm.member_user_id
      WHERE
        fm.folder_id = $1
        AND fm.owner_user_id = $2
      ORDER BY fm.created_at ASC
    `,
    [input.folderId, input.ownerUserId]
  )
  return rows.map(mapExtractionFolderMemberRow)
}

export async function upsertExtractionFolderMemberForOwner(input: {
  folderId: string
  ownerUserId: string
  memberUserId: string
  role: ExtractionFolderMemberRole
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionFolderMemberRow>(
    `
      WITH target_folder AS (
        SELECT id
        FROM extraction_folders
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      ),
      upserted AS (
        INSERT INTO extraction_folder_members (
          folder_id,
          owner_user_id,
          member_user_id,
          role
        )
        SELECT
          target_folder.id,
          $2,
          $3,
          $4
        FROM target_folder
        WHERE $3 <> $2
        ON CONFLICT (folder_id, member_user_id)
        DO UPDATE SET role = EXCLUDED.role
        RETURNING
          folder_id,
          owner_user_id,
          member_user_id,
          role,
          created_at
      )
      SELECT
        upserted.folder_id,
        upserted.owner_user_id,
        upserted.member_user_id,
        upserted.role,
        upserted.created_at,
        u.name AS member_name,
        u.email AS member_email
      FROM upserted
      INNER JOIN users u
        ON u.id = upserted.member_user_id
      LIMIT 1
    `,
    [input.folderId, input.ownerUserId, input.memberUserId, input.role]
  )
  return rows[0] ? mapExtractionFolderMemberRow(rows[0]) : null
}

export async function removeExtractionFolderMemberForOwner(input: {
  folderId: string
  ownerUserId: string
  memberUserId: string
}) {
  await ensureDbReady()
  const result = await pool.query(
    `
      DELETE FROM extraction_folder_members fm
      USING extraction_folders f
      WHERE
        fm.folder_id = $1
        AND fm.member_user_id = $2
        AND fm.owner_user_id = $3
        AND f.id = fm.folder_id
        AND f.user_id = $3
    `,
    [input.folderId, input.memberUserId, input.ownerUserId]
  )
  return result.rowCount ?? 0
}

export async function listSharedExtractionFoldersForMember(userId: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbSharedExtractionFolderRow>(
    `
      WITH RECURSIVE shared_roots AS (
        SELECT
          fm.folder_id AS root_folder_id,
          fm.owner_user_id
        FROM extraction_folder_members fm
        WHERE fm.member_user_id = $1
      ),
      shared_tree AS (
        SELECT
          sr.owner_user_id,
          sr.root_folder_id,
          f.id,
          f.user_id,
          f.name,
          f.color,
          f.parent_id,
          f.created_at,
          f.updated_at,
          0::int AS depth
        FROM shared_roots sr
        INNER JOIN extraction_folders f
          ON f.id = sr.root_folder_id
         AND f.user_id = sr.owner_user_id
        UNION ALL
        SELECT
          st.owner_user_id,
          st.root_folder_id,
          child.id,
          child.user_id,
          child.name,
          child.color,
          child.parent_id,
          child.created_at,
          child.updated_at,
          st.depth + 1
        FROM extraction_folders child
        INNER JOIN shared_tree st
          ON child.parent_id = st.id
         AND child.user_id = st.owner_user_id
      ),
      dedup AS (
        SELECT DISTINCT ON (st.owner_user_id, st.id)
          st.id,
          st.user_id,
          st.name,
          st.color,
          st.parent_id,
          st.created_at,
          st.updated_at,
          st.root_folder_id,
          st.owner_user_id
        FROM shared_tree st
        ORDER BY st.owner_user_id, st.id, st.depth ASC
      )
      SELECT
        d.id,
        d.user_id,
        d.name,
        d.color,
        d.parent_id,
        d.created_at,
        d.updated_at,
        d.root_folder_id,
        d.owner_user_id,
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM dedup d
      INNER JOIN users owner
        ON owner.id = d.owner_user_id
      ORDER BY
        owner.name ASC NULLS LAST,
        owner.email ASC NULLS LAST,
        d.created_at ASC,
        d.id ASC
    `,
    [userId]
  )

  return rows.map(mapSharedExtractionFolderRow)
}

export async function updateExtractionShareVisibilityForUser(input: {
  id: string
  userId: string
  shareVisibility: ExtractionShareVisibility
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions
      SET share_visibility = $1
      WHERE id = $2 AND user_id = $3
      RETURNING
        id,
        user_id,
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
        created_at
    `,
    [input.shareVisibility, input.id, input.userId]
  )

  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function updateExtractionClonePermissionForUser(input: {
  id: string
  userId: string
  clonePermission: ExtractionClonePermission
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions
      SET clone_permission = $1
      WHERE id = $2 AND user_id = $3
      RETURNING
        id,
        user_id,
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
        created_at
    `,
    [input.clonePermission, input.id, input.userId]
  )

  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function updateExtractionPhasesForUser(input: {
  id: string
  userId: string
  phasesJson: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions e
      SET phases_json = $1
      WHERE
        e.id = $2
        AND (
          e.user_id = $3
          OR (
            e.share_visibility = 'circle'
            AND EXISTS (
              SELECT 1
              FROM extraction_members m
              WHERE
                m.extraction_id = e.id
                AND m.user_id = $3
                AND m.role = 'editor'
            )
          )
        )
      RETURNING
        id,
        user_id,
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
        folder_id
    `,
    [input.phasesJson, input.id, input.userId]
  )

  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function updateExtractionGeneratedContentForUser(input: {
  id: string
  userId: string
  objective: string
  phasesJson: string
  proTip: string
  metadataJson: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      UPDATE extractions e
      SET
        objective = $1,
        phases_json = $2,
        pro_tip = $3,
        metadata_json = $4
      WHERE e.id = $5 AND e.user_id = $6
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
      input.objective,
      input.phasesJson,
      input.proTip,
      input.metadataJson,
      input.id,
      input.userId,
    ]
  )

  return rows[0] ? mapExtractionRow(rows[0]) : null
}

export async function updateExtractionMetaForUser(input: {
  id: string
  userId: string
  videoTitle: string
  sourceLabel: string
  thumbnailUrl: string | null
  objective: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `UPDATE extractions
     SET video_title = $1, source_label = $2, thumbnail_url = $3, objective = $4
     WHERE id = $5 AND user_id = $6
     RETURNING
       id, user_id, url, video_id, video_title, thumbnail_url,
       extraction_mode, objective, phases_json, pro_tip, metadata_json,
       share_visibility, created_at, source_type, source_label`,
    [input.videoTitle, input.sourceLabel, input.thumbnailUrl, input.objective, input.id, input.userId]
  )
  return rows[0] ? mapExtractionRow(rows[0]) : null
}

type ExtractionCloneMode = 'full' | 'template'

interface DbExtractionDependencyRow {
  task_id: string
  predecessor_task_id: string
}

interface CloneTaskSeed {
  sourceTaskId: string
  phaseId: number
  phaseTitle: string
  itemIndex: number
  itemText: string
  nodeId: string
  parentNodeId: string | null
  depth: number
  positionPath: string
  checked: boolean
  status: ExtractionTaskStatus
  numericValue: number | null
  numericFormulaJson: string
  dueAt: string | null
  completedAt: string | null
  scheduledStartAt: string | null
  scheduledEndAt: string | null
  durationDays: number
  flowNodeType: 'process' | 'decision'
  createdAt: string
  updatedAt: string
}

function remapTaskNumericFormulaJson(
  raw: string,
  taskIdMap: Map<string, string>
) {
  const parsed = parseTaskNumericFormulaJson(raw)
  if (!parsed) return '{}'

  const remappedSourceTaskIds = parsed.sourceTaskIds
    .map((sourceTaskId) => taskIdMap.get(sourceTaskId) ?? null)
    .filter((value): value is string => Boolean(value))

  if (remappedSourceTaskIds.length === 0) return '{}'
  return serializeTaskNumericFormula({
    operation: parsed.operation,
    sourceTaskIds: remappedSourceTaskIds,
  })
}

function buildCloneTaskSeeds(
  sourcePhasesJson: string
): CloneTaskSeed[] {
  const nowIso = new Date().toISOString()

  try {
    return flattenPlaybookPhases(normalizePlaybookPhases(JSON.parse(sourcePhasesJson))).map((task) => ({
      sourceTaskId: `generated:${task.nodeId}`,
      phaseId: task.phaseId,
      phaseTitle: task.phaseTitle,
      itemIndex: task.itemIndex,
      itemText: task.itemText,
      nodeId: task.nodeId,
      parentNodeId: task.parentNodeId ?? null,
      depth: task.depth,
      positionPath: task.positionPath,
      checked: false,
      status: 'pending',
      numericValue: null,
      numericFormulaJson: '{}',
      dueAt: null,
      completedAt: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      durationDays: 1,
      flowNodeType: 'process',
      createdAt: nowIso,
      updatedAt: nowIso,
    }))
  } catch {
    return []
  }
}

export async function cloneExtractionForUser(input: {
  sourceExtractionId: string
  targetUserId: string
  folderId?: string | null
  mode: ExtractionCloneMode
  name: string
}) {
  await ensureDbReady()
  await ensureDefaultExtractionFoldersForUser(input.targetUserId)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const generalFolderId = buildSystemExtractionFolderIdForUser({
      userId: input.targetUserId,
      key: 'general',
    })
    const resolvedFolderId = input.folderId?.trim() || generalFolderId

    const sourceExtractionRows = await client.query<DbExtractionRow>(
      `
        SELECT
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
        FROM extractions
        WHERE id = $1
        LIMIT 1
      `,
      [input.sourceExtractionId]
    )

    if (!sourceExtractionRows.rows[0]) {
      throw new Error('No se encontró el playbook origen.')
    }

    const sourceExtraction = mapExtractionRow(sourceExtractionRows.rows[0])
    const clonedTitle =
      input.name.trim().slice(0, 300) ||
      sourceExtraction.video_title?.trim() ||
      sourceExtraction.source_label?.trim() ||
      sourceExtraction.objective.trim() ||
      'Copia'

    const newExtractionId = randomUUID()
    const insertedExtractionRows = await client.query<DbExtractionRow>(
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
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'private', 'disabled',
          $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
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
        newExtractionId,
        input.targetUserId,
        sourceExtraction.id,
        sourceExtraction.url,
        sourceExtraction.video_id,
        clonedTitle,
        sourceExtraction.thumbnail_url,
        sourceExtraction.extraction_mode,
        sourceExtraction.objective,
        sourceExtraction.phases_json,
        sourceExtraction.pro_tip,
        sourceExtraction.metadata_json,
        sourceExtraction.source_type,
        clonedTitle,
        resolvedFolderId,
        sourceExtraction.source_text,
        sourceExtraction.source_file_url,
        sourceExtraction.source_file_name,
        sourceExtraction.source_file_size_bytes,
        sourceExtraction.source_file_mime_type,
        sourceExtraction.transcript_source,
      ]
    )

    const sourceAdditionalSources = await client.query<DbExtractionAdditionalSourceRow>(
      `
        SELECT
          id,
          extraction_id,
          created_by_user_id,
          source_type,
          source_label,
          url,
          source_text,
          source_file_url,
          source_file_name,
          source_file_size_bytes,
          source_file_mime_type,
          analysis_status,
          analyzed_at,
          created_at
        FROM extraction_additional_sources
        WHERE extraction_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [sourceExtraction.id]
    )

    for (const source of sourceAdditionalSources.rows) {
      await client.query(
        `
          INSERT INTO extraction_additional_sources (
            id,
            extraction_id,
            created_by_user_id,
            source_type,
            source_label,
            url,
            source_text,
            source_file_url,
            source_file_name,
            source_file_size_bytes,
            source_file_mime_type,
            analysis_status,
            analyzed_at,
            created_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          )
        `,
        [
          randomUUID(),
          newExtractionId,
          input.targetUserId,
          source.source_type,
          source.source_label,
          source.url,
          source.source_text,
          source.source_file_url,
          source.source_file_name,
          source.source_file_size_bytes,
          source.source_file_mime_type,
          source.analysis_status === 'analyzed' ? 'analyzed' : 'pending',
          source.analyzed_at ? toIso(source.analyzed_at) : null,
          toIso(source.created_at),
        ]
      )
    }

    const sourceTags = await client.query<{ name: string; color: string }>(
      `
        SELECT t.name, t.color
        FROM extraction_tag_assignments eta
        INNER JOIN extraction_tags t ON t.id = eta.tag_id
        WHERE eta.extraction_id = $1
        ORDER BY t.name ASC
      `,
      [sourceExtraction.id]
    )

    for (const tag of sourceTags.rows) {
      const tagRows = await client.query<{ id: string }>(
        `
          INSERT INTO extraction_tags (id, user_id, name, color)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
          RETURNING id
        `,
        [randomUUID(), input.targetUserId, tag.name, tag.color]
      )

      const nextTagId = tagRows.rows[0]?.id
      if (!nextTagId) continue

      await client.query(
        `
          INSERT INTO extraction_tag_assignments (extraction_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `,
        [newExtractionId, nextTagId]
      )
    }

    const sourceTaskRows = await client.query<DbExtractionTaskRow>(
      `
        SELECT
          id,
          extraction_id,
          user_id,
          phase_id,
          phase_title,
          item_index,
          item_text,
          node_id,
          parent_node_id,
          depth,
          position_path,
          checked,
          status,
          numeric_value,
          numeric_formula_json,
          due_at,
          completed_at,
          scheduled_start_at,
          scheduled_end_at,
          duration_days,
          flow_node_type,
          created_at,
          updated_at
        FROM extraction_tasks
        WHERE extraction_id = $1
        ORDER BY phase_id ASC, string_to_array(position_path, '.')::int[] ASC, item_index ASC, created_at ASC
      `,
      [sourceExtraction.id]
    )

    const sourceTaskSeeds = sourceTaskRows.rows.length > 0
      ? sourceTaskRows.rows.map((row) => {
          const task = mapExtractionTaskRow(row)
          return {
            sourceTaskId: task.id,
            phaseId: task.phase_id,
            phaseTitle: task.phase_title,
            itemIndex: task.item_index,
            itemText: task.item_text,
            nodeId: task.node_id,
            parentNodeId: task.parent_node_id,
            depth: task.depth,
            positionPath: task.position_path,
            checked: task.checked,
            status: task.status,
            numericValue: task.numeric_value,
            numericFormulaJson: task.numeric_formula_json,
            dueAt: task.due_at,
            completedAt: task.completed_at,
            scheduledStartAt: task.scheduled_start_at,
            scheduledEndAt: task.scheduled_end_at,
            durationDays: task.duration_days,
            flowNodeType: task.flow_node_type === 'decision' ? 'decision' : 'process',
            createdAt: task.created_at,
            updatedAt: task.updated_at,
          } satisfies CloneTaskSeed
        })
      : buildCloneTaskSeeds(sourceExtraction.phases_json)

    const taskIdMap = new Map<string, string>()
    for (const task of sourceTaskSeeds) {
      taskIdMap.set(task.sourceTaskId, randomUUID())
    }

    for (const task of sourceTaskSeeds) {
      const clonedTaskId = taskIdMap.get(task.sourceTaskId)
      if (!clonedTaskId) continue

      const isFullClone = input.mode === 'full' && sourceTaskRows.rows.length > 0
      await client.query(
        `
          INSERT INTO extraction_tasks (
            id,
            extraction_id,
            user_id,
            phase_id,
            phase_title,
            item_index,
            item_text,
            node_id,
            parent_node_id,
            depth,
            position_path,
            checked,
            status,
            numeric_value,
            numeric_formula_json,
            due_at,
            completed_at,
            scheduled_start_at,
            scheduled_end_at,
            duration_days,
            flow_node_type,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23
          )
        `,
        [
          clonedTaskId,
          newExtractionId,
          input.targetUserId,
          task.phaseId,
          task.phaseTitle,
          task.itemIndex,
          task.itemText,
          task.nodeId,
          task.parentNodeId,
          task.depth,
          task.positionPath,
          isFullClone ? task.checked : false,
          isFullClone ? task.status : 'pending',
          isFullClone ? task.numericValue : null,
          isFullClone ? remapTaskNumericFormulaJson(task.numericFormulaJson, taskIdMap) : '{}',
          isFullClone ? task.dueAt : null,
          isFullClone ? task.completedAt : null,
          isFullClone ? task.scheduledStartAt : null,
          isFullClone ? task.scheduledEndAt : null,
          isFullClone ? Math.max(1, task.durationDays) : 1,
          isFullClone ? task.flowNodeType : 'process',
          isFullClone ? task.createdAt : new Date().toISOString(),
          isFullClone ? task.updatedAt : new Date().toISOString(),
        ]
      )
    }

    if (input.mode === 'full' && sourceTaskRows.rows.length > 0) {
      const dependencies = await client.query<DbExtractionDependencyRow>(
        `
          SELECT task_id, predecessor_task_id
          FROM extraction_task_dependencies
          WHERE extraction_id = $1
        `,
        [sourceExtraction.id]
      )

      for (const dependency of dependencies.rows) {
        const nextTaskId = taskIdMap.get(dependency.task_id)
        const nextPredecessorId = taskIdMap.get(dependency.predecessor_task_id)
        if (!nextTaskId || !nextPredecessorId) continue

        await client.query(
          `
            INSERT INTO extraction_task_dependencies (
              extraction_id,
              task_id,
              predecessor_task_id
            )
            VALUES ($1, $2, $3)
          `,
          [newExtractionId, nextTaskId, nextPredecessorId]
        )
      }

      const events = await client.query<{
        id: string
        task_id: string
        user_id: string
        event_type: ExtractionTaskEventType
        content: string
        metadata_json: string
        created_at: Date | string
      }>(
        `
          SELECT
            id,
            task_id,
            user_id,
            event_type,
            content,
            metadata_json,
            created_at
          FROM extraction_task_events
          WHERE task_id = ANY($1::text[])
          ORDER BY created_at ASC, id ASC
        `,
        [sourceTaskRows.rows.map((task) => task.id)]
      )

      for (const event of events.rows) {
        const nextTaskId = taskIdMap.get(event.task_id)
        if (!nextTaskId) continue

        await client.query(
          `
            INSERT INTO extraction_task_events (
              id,
              task_id,
              user_id,
              event_type,
              content,
              metadata_json,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            randomUUID(),
            nextTaskId,
            event.user_id,
            event.event_type,
            event.content,
            event.metadata_json,
            toIso(event.created_at),
          ]
        )
      }

      const attachments = await client.query<DbExtractionTaskAttachmentRow>(
        `
          SELECT
            id,
            task_id,
            extraction_id,
            user_id,
            attachment_type,
            storage_provider,
            url,
            thumbnail_url,
            title,
            mime_type,
            size_bytes,
            metadata_json,
            created_at,
            updated_at,
            NULL::text AS user_name,
            NULL::text AS user_email
          FROM extraction_task_attachments
          WHERE extraction_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [sourceExtraction.id]
      )

      for (const attachment of attachments.rows) {
        const nextTaskId = taskIdMap.get(attachment.task_id)
        if (!nextTaskId) continue

        await client.query(
          `
            INSERT INTO extraction_task_attachments (
              id,
              task_id,
              extraction_id,
              user_id,
              attachment_type,
              storage_provider,
              url,
              thumbnail_url,
              title,
              mime_type,
              size_bytes,
              metadata_json,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `,
          [
            randomUUID(),
            nextTaskId,
            newExtractionId,
            attachment.user_id,
            attachment.attachment_type,
            attachment.storage_provider,
            attachment.url,
            attachment.thumbnail_url,
            attachment.title,
            attachment.mime_type,
            attachment.size_bytes != null ? Number(attachment.size_bytes) : null,
            attachment.metadata_json,
            toIso(attachment.created_at),
            toIso(attachment.updated_at),
          ]
        )
      }

      const comments = await client.query<DbExtractionTaskCommentRow>(
        `
          SELECT
            id,
            task_id,
            extraction_id,
            user_id,
            parent_comment_id,
            is_hidden,
            content,
            created_at,
            updated_at,
            NULL::text AS user_name,
            NULL::text AS user_email
          FROM extraction_task_comments
          WHERE extraction_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [sourceExtraction.id]
      )

      const commentIdMap = new Map<string, string>()
      for (const comment of comments.rows) {
        commentIdMap.set(comment.id, randomUUID())
      }

      for (const comment of comments.rows) {
        const nextTaskId = taskIdMap.get(comment.task_id)
        const nextCommentId = commentIdMap.get(comment.id)
        if (!nextTaskId || !nextCommentId) continue

        await client.query(
          `
            INSERT INTO extraction_task_comments (
              id,
              task_id,
              extraction_id,
              user_id,
              parent_comment_id,
              is_hidden,
              content,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            nextCommentId,
            nextTaskId,
            newExtractionId,
            comment.user_id,
            comment.parent_comment_id ? commentIdMap.get(comment.parent_comment_id) ?? null : null,
            comment.is_hidden,
            comment.content,
            toIso(comment.created_at),
            toIso(comment.updated_at),
          ]
        )
      }

      const edges = await client.query<DbExtractionTaskEdgeRow>(
        `
          SELECT
            id,
            extraction_id,
            from_task_id,
            to_task_id,
            edge_type,
            label,
            expected_extra_days,
            sort_order,
            created_at,
            updated_at
          FROM extraction_task_edges
          WHERE extraction_id = $1
          ORDER BY sort_order ASC, created_at ASC
        `,
        [sourceExtraction.id]
      )

      for (const edge of edges.rows) {
        const nextFromTaskId = taskIdMap.get(edge.from_task_id)
        const nextToTaskId = taskIdMap.get(edge.to_task_id)
        if (!nextFromTaskId || !nextToTaskId) continue

        await client.query(
          `
            INSERT INTO extraction_task_edges (
              id,
              extraction_id,
              from_task_id,
              to_task_id,
              edge_type,
              label,
              expected_extra_days,
              sort_order,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            randomUUID(),
            newExtractionId,
            nextFromTaskId,
            nextToTaskId,
            edge.edge_type,
            edge.label,
            edge.expected_extra_days != null ? Number(edge.expected_extra_days) : null,
            typeof edge.sort_order === 'number' ? edge.sort_order : Number.parseInt(String(edge.sort_order), 10) || 0,
            toIso(edge.created_at),
            toIso(edge.updated_at),
          ]
        )
      }

      const selections = await client.query<DbDecisionSelectionRow>(
        `
          SELECT
            extraction_id,
            decision_task_id,
            selected_to_task_id,
            created_at,
            updated_at
          FROM extraction_task_decision_selection
          WHERE extraction_id = $1
        `,
        [sourceExtraction.id]
      )

      for (const selection of selections.rows) {
        const nextDecisionTaskId = taskIdMap.get(selection.decision_task_id)
        const nextSelectedToTaskId = taskIdMap.get(selection.selected_to_task_id)
        if (!nextDecisionTaskId || !nextSelectedToTaskId) continue

        await client.query(
          `
            INSERT INTO extraction_task_decision_selection (
              extraction_id,
              decision_task_id,
              selected_to_task_id,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            newExtractionId,
            nextDecisionTaskId,
            nextSelectedToTaskId,
            toIso(selection.created_at),
            toIso(selection.updated_at),
          ]
        )
      }

      const positions = await client.query<{
        task_id: string
        cx: number | string
        cy: number | string
        updated_at: Date | string
      }>(
        `
          SELECT task_id, cx, cy, updated_at
          FROM flow_node_positions
          WHERE extraction_id = $1
        `,
        [sourceExtraction.id]
      )

      for (const position of positions.rows) {
        const nextTaskId = taskIdMap.get(position.task_id)
        if (!nextTaskId) continue

        await client.query(
          `
            INSERT INTO flow_node_positions (
              task_id,
              extraction_id,
              cx,
              cy,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            nextTaskId,
            newExtractionId,
            Number(position.cx),
            Number(position.cy),
            toIso(position.updated_at),
          ]
        )
      }

      const decks = await client.query<{ deck_json: string; created_at: Date | string; updated_at: Date | string }>(
        `
          SELECT deck_json, created_at, updated_at
          FROM extraction_presentations
          WHERE extraction_id = $1
          LIMIT 1
        `,
        [sourceExtraction.id]
      )

      if (decks.rows[0]) {
        await client.query(
          `
            INSERT INTO extraction_presentations (
              extraction_id,
              deck_json,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4)
          `,
          [
            newExtractionId,
            decks.rows[0].deck_json,
            toIso(decks.rows[0].created_at),
            toIso(decks.rows[0].updated_at),
          ]
        )
      }
    }

    await client.query('COMMIT')
    return mapExtractionRow(insertedExtractionRows.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listExtractionFoldersByUser(userId: string) {
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
      WHERE user_id = $1
      ORDER BY parent_id NULLS FIRST, created_at ASC
    `,
    [userId]
  )
  return rows.map(mapExtractionFolderRow)
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
  await ensureDbReady()
  const id = input.id?.trim() || randomUUID()

  const { rows } = await pool.query<DbExtractionFolderRow>(
    `
      INSERT INTO extraction_folders (
        id,
        user_id,
        name,
        color,
        parent_id
      )
      SELECT
        $1,
        $2,
        $3,
        $4,
        $5::text
      WHERE
        $5::text IS NULL
        OR EXISTS (
          SELECT 1
          FROM extraction_folders
          WHERE id = $5::text AND user_id = $2
        )
      ON CONFLICT (id) DO NOTHING
      RETURNING
        id,
        user_id,
        name,
        color,
        parent_id,
        created_at,
        updated_at
    `,
    [id, input.userId, input.name, input.color, input.parentId]
  )

  return rows[0] ? mapExtractionFolderRow(rows[0]) : null
}

export async function deleteExtractionFolderTreeForUser(input: { id: string; userId: string }) {
  await ensureDbReady()

  if (isProtectedExtractionFolderIdForUser({ userId: input.userId, id: input.id })) {
    return []
  }

  await ensureDefaultExtractionFoldersForUser(input.userId)
  const generalFolderId = buildSystemExtractionFolderIdForUser({
    userId: input.userId,
    key: 'general',
  })

  const { rows } = await pool.query<{ id: string }>(
    `
      WITH RECURSIVE folder_tree AS (
        SELECT id
        FROM extraction_folders
        WHERE id = $1 AND user_id = $2
        UNION ALL
        SELECT child.id
        FROM extraction_folders child
        INNER JOIN folder_tree ft ON child.parent_id = ft.id
        WHERE child.user_id = $2
      ),
      detached_extractions AS (
        UPDATE extractions
        SET folder_id = $3
        WHERE user_id = $2 AND folder_id IN (SELECT id FROM folder_tree)
      ),
      deleted_folders AS (
        DELETE FROM extraction_folders
        WHERE user_id = $2 AND id IN (SELECT id FROM folder_tree)
        RETURNING id
      )
      SELECT id FROM deleted_folders
    `,
    [input.id, input.userId, generalFolderId]
  )

  return rows.map((row) => row.id)
}

export async function updateExtractionFolderForUser(input: {
  id: string
  userId: string
  folderId: string | null
}): Promise<boolean> {
  await ensureDbReady()
  await ensureDefaultExtractionFoldersForUser(input.userId)

  const targetFolderId = input.folderId ?? buildSystemExtractionFolderIdForUser({
    userId: input.userId,
    key: 'general',
  })

  const { rowCount } = await pool.query(
    `
      UPDATE extractions
      SET folder_id = $1::text
      WHERE
        id = $2
        AND user_id = $3
        AND (
          EXISTS (
            SELECT 1
            FROM extraction_folders
            WHERE id = $1::text AND user_id = $3
          )
        )
    `,
    [targetFolderId, input.id, input.userId]
  )
  return (rowCount ?? 0) > 0
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
  await ensureDbReady()

  const normalizedPhases = normalizePlaybookPhases(input.phases)
  const normalizedRows = flattenPlaybookPhases(normalizedPhases).map((row) => ({
    phaseId: row.phaseId,
    phaseTitle: row.phaseTitle,
    itemIndex: row.itemIndex,
    itemText: row.itemText,
    nodeId: row.nodeId,
    parentNodeId: row.parentNodeId,
    depth: row.depth,
    positionPath: row.positionPath,
  }))

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const normalizeText = (value: string) => value.trim().toLocaleLowerCase()

    if (normalizedRows.length === 0) {
      await client.query(
        `
          DELETE FROM extraction_tasks
          WHERE extraction_id = $1
        `,
        [input.extractionId]
      )

      await client.query('COMMIT')
      return []
    }

    const existingRows = await client.query<DbExtractionTaskRow>(
      `
        SELECT
          id,
          extraction_id,
          user_id,
          phase_id,
          phase_title,
          item_index,
          item_text,
          node_id,
          parent_node_id,
          depth,
          position_path,
          checked,
          status,
          numeric_value,
          numeric_formula_json,
          due_at,
          completed_at,
          created_at,
          updated_at
        FROM extraction_tasks
        WHERE extraction_id = $1
        ORDER BY phase_id ASC, string_to_array(position_path, '.')::int[] ASC, item_index ASC, created_at ASC
      `,
      [input.extractionId]
    )

    const existingTasks = existingRows.rows.map(mapExtractionTaskRow)
    const availableExistingTasks = [...existingTasks]

    const takeMatchingTask = (
      predicate: (task: DbExtractionTask) => boolean
    ): DbExtractionTask | null => {
      const index = availableExistingTasks.findIndex((task) => predicate(task))
      if (index < 0) return null
      const [task] = availableExistingTasks.splice(index, 1)
      return task ?? null
    }

    const resolvedRows = normalizedRows.map((row) => {
      const normalizedItemText = normalizeText(row.itemText)
      const normalizedPhaseTitle = normalizeText(row.phaseTitle)

      let matchedTask =
        takeMatchingTask((task) => task.node_id === row.nodeId) ??
        takeMatchingTask(
          (task) =>
            task.phase_id === row.phaseId &&
            task.item_index === row.itemIndex &&
            normalizeText(task.item_text) === normalizedItemText
        ) ??
        takeMatchingTask(
          (task) =>
            normalizeText(task.item_text) === normalizedItemText &&
            normalizeText(task.phase_title) === normalizedPhaseTitle
        ) ??
        takeMatchingTask((task) => normalizeText(task.item_text) === normalizedItemText) ??
        takeMatchingTask((task) => task.phase_id === row.phaseId && task.item_index === row.itemIndex)

      if (matchedTask) {
        return {
          ...row,
          taskId: matchedTask.id,
          reuseExistingTask: true,
        }
      }

      return {
        ...row,
        taskId: randomUUID(),
        reuseExistingTask: false,
      }
    })

    const reusedTaskIds = new Set(
      resolvedRows.filter((row) => row.reuseExistingTask).map((row) => row.taskId)
    )
    const taskIdsToDelete = existingTasks
      .filter((task) => !reusedTaskIds.has(task.id))
      .map((task) => task.id)

    if (taskIdsToDelete.length > 0) {
      await client.query(
        `
          DELETE FROM extraction_tasks
          WHERE extraction_id = $1
            AND id = ANY($2::text[])
        `,
        [input.extractionId, taskIdsToDelete]
      )
    }

    const rowsReusingExistingTasks = resolvedRows.filter((row) => row.reuseExistingTask)
    const temporaryBase = -1_000_000_000
    for (let index = 0; index < rowsReusingExistingTasks.length; index += 1) {
      const row = rowsReusingExistingTasks[index]
      await client.query(
        `
          UPDATE extraction_tasks
          SET
            phase_id = $1,
            item_index = $2,
            node_id = $3,
            position_path = $4,
            updated_at = NOW()
          WHERE id = $5 AND extraction_id = $6
        `,
        [
          temporaryBase - index,
          temporaryBase - index,
          `tmp_${index}_${row.taskId}`,
          `0.${Math.abs(temporaryBase - index)}`,
          row.taskId,
          input.extractionId,
        ]
      )
    }

    for (const row of resolvedRows) {
      if (row.reuseExistingTask) {
        await client.query(
          `
            UPDATE extraction_tasks
            SET
              phase_id = $1,
              phase_title = $2,
              item_index = $3,
              item_text = $4,
              node_id = $5,
              parent_node_id = $6,
              depth = $7,
              position_path = $8,
              updated_at = NOW()
            WHERE id = $9 AND extraction_id = $10
          `,
          [
            row.phaseId,
            row.phaseTitle,
            row.itemIndex,
            row.itemText,
            row.nodeId,
            row.parentNodeId,
            row.depth,
            row.positionPath,
            row.taskId,
            input.extractionId,
          ]
        )
      } else {
        await client.query(
          `
            INSERT INTO extraction_tasks (
              id,
              extraction_id,
              user_id,
              phase_id,
              phase_title,
              item_index,
              item_text,
              node_id,
              parent_node_id,
              depth,
              position_path,
              checked,
              status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE, 'pending')
          `,
          [
            row.taskId,
            input.extractionId,
            input.userId,
            row.phaseId,
            row.phaseTitle,
            row.itemIndex,
            row.itemText,
            row.nodeId,
            row.parentNodeId,
            row.depth,
            row.positionPath,
          ]
        )
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return listExtractionTasksWithEventsForUser({
    extractionId: input.extractionId,
  })
}

export async function listExtractionTasksWithEventsForUser(input: { extractionId: string }) {
  await ensureDbReady()

  const taskRows = await pool.query<DbExtractionTaskRow>(
    `
      SELECT
        id,
        extraction_id,
        user_id,
        phase_id,
        phase_title,
        item_index,
        item_text,
        node_id,
        parent_node_id,
        depth,
        position_path,
        checked,
        status,
        numeric_value,
        numeric_formula_json,
        due_at,
        completed_at,
        scheduled_start_at,
        scheduled_end_at,
        duration_days,
        flow_node_type,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE extraction_id = $1
      ORDER BY phase_id ASC, string_to_array(position_path, '.')::int[] ASC, item_index ASC
    `,
    [input.extractionId]
  )

  const tasks = taskRows.rows.map(mapExtractionTaskRow)
  if (tasks.length === 0) {
    return [] as Array<DbExtractionTask & { events: DbExtractionTaskEvent[] }>
  }

  const taskIds = tasks.map((task) => task.id)
  const eventRows = await pool.query<DbExtractionTaskEventRow>(
    `
      SELECT
        e.id,
        e.task_id,
        e.user_id,
        e.event_type,
        e.content,
        e.metadata_json,
        e.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.task_id = ANY($1::text[])
      ORDER BY e.created_at DESC
    `,
    [taskIds]
  )

  const eventsByTaskId = new Map<string, DbExtractionTaskEvent[]>()
  for (const row of eventRows.rows) {
    const mapped = mapExtractionTaskEventRow(row)
    const existing = eventsByTaskId.get(mapped.task_id) ?? []
    existing.push(mapped)
    eventsByTaskId.set(mapped.task_id, existing)
  }

  return tasks.map((task) => ({
    ...task,
    events: eventsByTaskId.get(task.id) ?? [],
  }))
}

export async function listExtractionTasksWithEventsForSharedExtraction(extractionId: string) {
  await ensureDbReady()

  const taskRows = await pool.query<DbExtractionTaskRow>(
    `
      SELECT
        id,
        extraction_id,
        user_id,
        phase_id,
        phase_title,
        item_index,
        item_text,
        node_id,
        parent_node_id,
        depth,
        position_path,
        checked,
        status,
        numeric_value,
        numeric_formula_json,
        due_at,
        completed_at,
        scheduled_start_at,
        scheduled_end_at,
        duration_days,
        flow_node_type,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE extraction_id = $1
      ORDER BY phase_id ASC, string_to_array(position_path, '.')::int[] ASC, item_index ASC
    `,
    [extractionId]
  )

  const tasks = taskRows.rows.map(mapExtractionTaskRow)
  if (tasks.length === 0) {
    return [] as Array<DbExtractionTask & { events: DbExtractionTaskEvent[] }>
  }

  const taskIds = tasks.map((task) => task.id)
  const eventRows = await pool.query<DbExtractionTaskEventRow>(
    `
      SELECT
        e.id,
        e.task_id,
        e.user_id,
        e.event_type,
        e.content,
        e.metadata_json,
        e.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.task_id = ANY($1::text[])
      ORDER BY e.created_at DESC
    `,
    [taskIds]
  )

  const eventsByTaskId = new Map<string, DbExtractionTaskEvent[]>()
  for (const row of eventRows.rows) {
    const mapped = mapExtractionTaskEventRow(row)
    const existing = eventsByTaskId.get(mapped.task_id) ?? []
    existing.push(mapped)
    eventsByTaskId.set(mapped.task_id, existing)
  }

  return tasks.map((task) => ({
    ...task,
    events: eventsByTaskId.get(task.id) ?? [],
  }))
}

export async function findExtractionTaskByIdForUser(input: {
  taskId: string
  extractionId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskRow>(
    `
      SELECT
        id,
        extraction_id,
        user_id,
        phase_id,
        phase_title,
        item_index,
        item_text,
        node_id,
        parent_node_id,
        depth,
        position_path,
        checked,
        status,
        numeric_value,
        numeric_formula_json,
        due_at,
        completed_at,
        scheduled_start_at,
        scheduled_end_at,
        duration_days,
        flow_node_type,
        created_at,
        updated_at
      FROM extraction_tasks
      WHERE id = $1 AND extraction_id = $2
      LIMIT 1
    `,
    [input.taskId, input.extractionId]
  )

  return rows[0] ? mapExtractionTaskRow(rows[0]) : null
}

export async function updateExtractionTaskStateForUser(input: {
  taskId: string
  extractionId: string
  checked: boolean
  status: ExtractionTaskStatus
  numericValue: number | null
  numericFormulaJson: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskRow>(
    `
      UPDATE extraction_tasks
      SET
        checked = $1,
        status = $2,
        numeric_value = $3,
        numeric_formula_json = $4,
        completed_at = CASE
          WHEN $2 = 'completed' THEN COALESCE(completed_at, NOW())
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE id = $5 AND extraction_id = $6
      RETURNING
        id,
        extraction_id,
        user_id,
        phase_id,
        phase_title,
        item_index,
        item_text,
        node_id,
        parent_node_id,
        depth,
        position_path,
        checked,
        status,
        numeric_value,
        numeric_formula_json,
        due_at,
        completed_at,
        scheduled_start_at,
        scheduled_end_at,
        duration_days,
        flow_node_type,
        created_at,
        updated_at
    `,
    [
      input.checked,
      input.status,
      input.numericValue,
      input.numericFormulaJson,
      input.taskId,
      input.extractionId,
    ]
  )

  return rows[0] ? mapExtractionTaskRow(rows[0]) : null
}

export async function updateExtractionTaskScheduleForUser(input: {
  taskId: string
  extractionId: string
  scheduledStartAt: string | null
  scheduledEndAt: string | null
}): Promise<DbExtractionTask | null> {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskRow>(
    `UPDATE extraction_tasks
     SET scheduled_start_at = $1, scheduled_end_at = $2, updated_at = NOW()
     WHERE id = $3 AND extraction_id = $4
     RETURNING id, extraction_id, user_id, phase_id, phase_title, item_index, item_text,
       node_id, parent_node_id, depth, position_path, checked, status,
       numeric_value, numeric_formula_json, due_at, completed_at, scheduled_start_at, scheduled_end_at, duration_days, flow_node_type, created_at, updated_at`,
    [input.scheduledStartAt || null, input.scheduledEndAt || null, input.taskId, input.extractionId]
  )
  return rows[0] ? mapExtractionTaskRow(rows[0]) : null
}

export async function listExtractionTaskDependencies(
  extractionId: string
): Promise<Map<string, string[]>> {
  await ensureDbReady()
  const { rows } = await pool.query<{ task_id: string; predecessor_task_id: string }>(
    `SELECT task_id, predecessor_task_id FROM extraction_task_dependencies WHERE extraction_id = $1`,
    [extractionId]
  )
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const existing = map.get(row.task_id) ?? []
    existing.push(row.predecessor_task_id)
    map.set(row.task_id, existing)
  }
  return map
}

export async function updateExtractionTaskPlanningForUser(input: {
  taskId: string
  extractionId: string
  durationDays: number
  predecessorIds: string[]
}): Promise<{ ok: boolean; error?: string }> {
  await ensureDbReady()

  if (!Number.isInteger(input.durationDays) || input.durationDays < 1) {
    return { ok: false, error: 'durationDays debe ser un entero >= 1.' }
  }
  if (input.predecessorIds.includes(input.taskId)) {
    return { ok: false, error: 'Una tarea no puede ser su propio predecesor.' }
  }

  if (input.predecessorIds.length > 0) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM extraction_tasks WHERE extraction_id = $1 AND id = ANY($2::text[])`,
      [input.extractionId, input.predecessorIds]
    )
    if (rows.length !== input.predecessorIds.length) {
      return { ok: false, error: 'Uno o más predecesores no existen en esta extracción.' }
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE extraction_tasks SET duration_days = $1, updated_at = NOW() WHERE id = $2 AND extraction_id = $3`,
      [input.durationDays, input.taskId, input.extractionId]
    )
    await client.query(
      `DELETE FROM extraction_task_dependencies WHERE task_id = $1`,
      [input.taskId]
    )
    if (input.predecessorIds.length > 0) {
      const placeholders = input.predecessorIds.map((_, i) => `($1, $2, $${i + 3})`).join(', ')
      await client.query(
        `INSERT INTO extraction_task_dependencies (extraction_id, task_id, predecessor_task_id) VALUES ${placeholders}`,
        [input.extractionId, input.taskId, ...input.predecessorIds]
      )
    }
    await client.query('COMMIT')
    return { ok: true }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function updateExtractionTaskStatusCatalogById(input: {
  extractionId: string
  taskStatusCatalog: string[]
}) {
  await ensureDbReady()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ metadata_json: string }>(
      `SELECT metadata_json
       FROM extractions
       WHERE id = $1
       FOR UPDATE`,
      [input.extractionId]
    )

    if (!rows[0]) {
      await client.query('ROLLBACK')
      return false
    }

    const nextMetadataJson = writeTaskStatusCatalogToMetadataJson(
      rows[0].metadata_json,
      input.taskStatusCatalog
    )

    await client.query(
      `UPDATE extractions
       SET metadata_json = $1
       WHERE id = $2`,
      [nextMetadataJson, input.extractionId]
    )

    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function replaceExtractionTaskStatusForExtraction(input: {
  extractionId: string
  previousStatus: ExtractionTaskStatus
  nextStatus: ExtractionTaskStatus
}) {
  await ensureDbReady()
  await pool.query(
    `
      UPDATE extraction_tasks
      SET
        checked = CASE
          WHEN $3 = 'completed' THEN TRUE
          ELSE FALSE
        END,
        status = $3,
        completed_at = CASE
          WHEN $3 = 'completed' THEN COALESCE(completed_at, NOW())
          ELSE NULL
        END,
        updated_at = NOW()
      WHERE extraction_id = $1
        AND status = $2
    `,
    [input.extractionId, input.previousStatus, input.nextStatus]
  )
}

export async function createExtractionTaskEventForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  eventType: ExtractionTaskEventType
  content: string
  metadataJson?: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskEventRow>(
    `
      WITH target_task AS (
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2
        LIMIT 1
      )
      INSERT INTO extraction_task_events (
        id,
        task_id,
        user_id,
        event_type,
        content,
        metadata_json
      )
      SELECT
        $4,
        target_task.id,
        $3,
        $5,
        $6,
        $7
      FROM target_task
      RETURNING
        id,
        task_id,
        user_id,
        event_type,
        content,
        metadata_json,
        created_at
    `,
    [
      input.taskId,
      input.extractionId,
      input.userId,
      randomUUID(),
      input.eventType,
      input.content,
      input.metadataJson ?? '{}',
    ]
  )

  return rows[0] ? mapExtractionTaskEventRow(rows[0]) : null
}

export async function listExtractionTaskAttachmentsForUser(input: {
  taskId: string
  extractionId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskAttachmentRow>(
    `
      SELECT
        a.id,
        a.task_id,
        a.extraction_id,
        a.user_id,
        a.attachment_type,
        a.storage_provider,
        a.url,
        a.thumbnail_url,
        a.title,
        a.mime_type,
        a.size_bytes,
        a.metadata_json,
        a.created_at,
        a.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_attachments a
      INNER JOIN extraction_tasks t ON t.id = a.task_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE
        a.task_id = $1
        AND a.extraction_id = $2
        AND t.extraction_id = $2
      ORDER BY a.created_at DESC
    `,
    [input.taskId, input.extractionId]
  )

  return rows.map(mapExtractionTaskAttachmentRow)
}

export async function listExtractionTaskAttachmentsForSharedExtraction(extractionId: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskAttachmentRow>(
    `
      SELECT
        a.id,
        a.task_id,
        a.extraction_id,
        a.user_id,
        a.attachment_type,
        a.storage_provider,
        a.url,
        a.thumbnail_url,
        a.title,
        a.mime_type,
        a.size_bytes,
        a.metadata_json,
        a.created_at,
        a.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_attachments a
      INNER JOIN extraction_tasks t ON t.id = a.task_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE
        a.extraction_id = $1
        AND t.extraction_id = $1
      ORDER BY t.phase_id ASC, string_to_array(t.position_path, '.')::int[] ASC, t.item_index ASC, a.created_at DESC
    `,
    [extractionId]
  )

  return rows.map(mapExtractionTaskAttachmentRow)
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
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskAttachmentRow>(
    `
      WITH target_task AS (
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2
        LIMIT 1
      )
      INSERT INTO extraction_task_attachments (
        id,
        task_id,
        extraction_id,
        user_id,
        attachment_type,
        storage_provider,
        url,
        thumbnail_url,
        title,
        mime_type,
        size_bytes,
        metadata_json
      )
      SELECT
        $4,
        target_task.id,
        $2,
        $3,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      FROM target_task
      RETURNING
        id,
        task_id,
        extraction_id,
        user_id,
        attachment_type,
        storage_provider,
        url,
        thumbnail_url,
        title,
        mime_type,
        size_bytes,
        metadata_json,
        created_at,
        updated_at
    `,
    [
      input.taskId,
      input.extractionId,
      input.userId,
      randomUUID(),
      input.attachmentType,
      input.storageProvider,
      input.url,
      input.thumbnailUrl ?? null,
      input.title ?? null,
      input.mimeType ?? null,
      input.sizeBytes ?? null,
      input.metadataJson ?? '{}',
    ]
  )

  return rows[0] ? mapExtractionTaskAttachmentRow(rows[0]) : null
}

export async function deleteExtractionTaskAttachmentByIdForUser(input: {
  attachmentId: string
  taskId: string
  extractionId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskAttachmentRow>(
    `
      DELETE FROM extraction_task_attachments a
      USING extraction_tasks t
      WHERE
        a.id = $1
        AND a.task_id = $2
        AND a.extraction_id = $3
        AND t.id = a.task_id
        AND t.extraction_id = $3
      RETURNING
        a.id,
        a.task_id,
        a.extraction_id,
        a.user_id,
        a.attachment_type,
        a.storage_provider,
        a.url,
        a.thumbnail_url,
        a.title,
        a.mime_type,
        a.size_bytes,
        a.metadata_json,
        a.created_at,
        a.updated_at
    `,
    [input.attachmentId, input.taskId, input.extractionId]
  )

  return rows[0] ? mapExtractionTaskAttachmentRow(rows[0]) : null
}

export async function listExtractionTaskCommentsForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      SELECT
        c.id,
        c.task_id,
        c.extraction_id,
        c.user_id,
        c.parent_comment_id,
        c.is_hidden,
        c.content,
        c.created_at,
        c.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM extraction_task_comments c
      INNER JOIN extraction_tasks t ON t.id = c.task_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE
        c.task_id = $1
        AND c.extraction_id = $2
        AND t.extraction_id = $2
      ORDER BY c.created_at ASC
    `,
    [input.taskId, input.extractionId]
  )

  return rows.map(mapExtractionTaskCommentRow)
}

export async function createExtractionTaskCommentForUser(input: {
  taskId: string
  extractionId: string
  userId: string
  content: string
  parentCommentId?: string | null
}) {
  await ensureDbReady()
  const parentCommentId = typeof input.parentCommentId === 'string' ? input.parentCommentId.trim() : null
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      WITH target_task AS (
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2
        LIMIT 1
      ),
      parent_comment AS (
        SELECT c.id
        FROM extraction_task_comments c
        WHERE
          c.id = $6
          AND c.task_id = $1
          AND c.extraction_id = $2
        LIMIT 1
      ),
      inserted AS (
        INSERT INTO extraction_task_comments (
          id,
          task_id,
          extraction_id,
          user_id,
          parent_comment_id,
          content
        )
        SELECT
          $4,
          target_task.id,
          $2,
          $3,
          parent_comment.id,
          $5
        FROM target_task
        LEFT JOIN parent_comment ON TRUE
        WHERE $6::text IS NULL OR parent_comment.id IS NOT NULL
        RETURNING
          id,
          task_id,
          extraction_id,
          user_id,
          parent_comment_id,
          is_hidden,
          content,
          created_at,
          updated_at
      )
      SELECT
        i.id,
        i.task_id,
        i.extraction_id,
        i.user_id,
        i.parent_comment_id,
        i.is_hidden,
        i.content,
        i.created_at,
        i.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM inserted i
      INNER JOIN users u ON u.id = i.user_id
    `,
    [input.taskId, input.extractionId, input.userId, randomUUID(), input.content, parentCommentId]
  )

  return rows[0] ? mapExtractionTaskCommentRow(rows[0]) : null
}

export async function deleteExtractionTaskCommentByIdForUser(input: {
  commentId: string
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      WITH target AS (
        SELECT
          c.id,
          c.parent_comment_id
        FROM extraction_task_comments c
        INNER JOIN extraction_tasks t ON t.id = c.task_id
        WHERE
          c.id = $1
          AND c.task_id = $2
          AND c.extraction_id = $3
          AND t.extraction_id = $3
          AND c.user_id = $4
        LIMIT 1
      ),
      reparented AS (
        UPDATE extraction_task_comments child
        SET parent_comment_id = target.parent_comment_id
        FROM target
        WHERE
          child.parent_comment_id = target.id
          AND child.task_id = $2
          AND child.extraction_id = $3
        RETURNING child.id
      ),
      deleted AS (
        DELETE FROM extraction_task_comments c
        USING target
        WHERE c.id = target.id
        RETURNING
          c.id,
          c.task_id,
          c.extraction_id,
          c.user_id,
          c.parent_comment_id,
          c.is_hidden,
          c.content,
          c.created_at,
          c.updated_at
      )
      SELECT
        d.id,
        d.task_id,
        d.extraction_id,
        d.user_id,
        d.parent_comment_id,
        d.is_hidden,
        d.content,
        d.created_at,
        d.updated_at,
        $5::text AS user_name,
        $6::text AS user_email
      FROM deleted d
    `,
    [input.commentId, input.taskId, input.extractionId, input.userId, null, null]
  )

  return rows[0] ? mapExtractionTaskCommentRow(rows[0]) : null
}

export async function setExtractionTaskCommentHiddenByOwner(input: {
  commentId: string
  taskId: string
  extractionId: string
  ownerUserId: string
  hidden: boolean
}) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskCommentRow>(
    `
      WITH target AS (
        SELECT c.id
        FROM extraction_task_comments c
        INNER JOIN extraction_tasks t ON t.id = c.task_id
        INNER JOIN extractions e ON e.id = t.extraction_id
        WHERE
          c.id = $1
          AND c.task_id = $2
          AND c.extraction_id = $3
          AND t.extraction_id = $3
          AND e.user_id = $4
        LIMIT 1
      ),
      updated AS (
        UPDATE extraction_task_comments c
        SET
          is_hidden = $5,
          updated_at = NOW()
        FROM target
        WHERE c.id = target.id
        RETURNING
          c.id,
          c.task_id,
          c.extraction_id,
          c.user_id,
          c.parent_comment_id,
          c.is_hidden,
          c.content,
          c.created_at,
          c.updated_at
      )
      SELECT
        u2.id,
        u2.task_id,
        u2.extraction_id,
        u2.user_id,
        u2.parent_comment_id,
        u2.is_hidden,
        u2.content,
        u2.created_at,
        u2.updated_at,
        u.name AS user_name,
        u.email AS user_email
      FROM updated u2
      INNER JOIN users u ON u.id = u2.user_id
    `,
    [input.commentId, input.taskId, input.extractionId, input.ownerUserId, input.hidden]
  )

  return rows[0] ? mapExtractionTaskCommentRow(rows[0]) : null
}

export async function getExtractionTaskLikeSummaryForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const { rows } = await pool.query<DbExtractionTaskLikeSummaryRow>(
    `
      SELECT
        (
          SELECT COUNT(*)::int
          FROM extraction_task_likes l
          WHERE
            l.task_id = t.id
            AND l.extraction_id = t.extraction_id
        ) AS likes_count,
        EXISTS (
          SELECT 1
          FROM extraction_task_likes l
          WHERE
            l.task_id = t.id
            AND l.extraction_id = t.extraction_id
            AND l.user_id = $3
        ) AS liked_by_me,
        (
          SELECT COUNT(*)::int
          FROM extraction_task_shares s
          WHERE
            s.task_id = t.id
            AND s.extraction_id = t.extraction_id
        ) AS shares_count,
        EXISTS (
          SELECT 1
          FROM extraction_task_shares s
          WHERE
            s.task_id = t.id
            AND s.extraction_id = t.extraction_id
            AND s.user_id = $3
        ) AS shared_by_me,
        (
          SELECT COUNT(*)::int
          FROM extraction_task_follows f
          WHERE
            f.task_id = t.id
            AND f.extraction_id = t.extraction_id
        ) AS followers_count,
        EXISTS (
          SELECT 1
          FROM extraction_task_follows f
          WHERE
            f.task_id = t.id
            AND f.extraction_id = t.extraction_id
            AND f.user_id = $3
        ) AS following_by_me,
        (
          SELECT COUNT(*)::int
          FROM extraction_task_views v
          WHERE
            v.task_id = t.id
            AND v.extraction_id = t.extraction_id
        ) AS views_count,
        EXISTS (
          SELECT 1
          FROM extraction_task_views v
          WHERE
            v.task_id = t.id
            AND v.extraction_id = t.extraction_id
            AND v.user_id = $3
        ) AS viewed_by_me
      FROM extraction_tasks t
      WHERE
        t.id = $1
        AND t.extraction_id = $2
      LIMIT 1
    `,
    [input.taskId, input.extractionId, input.userId]
  )

  const row = rows[0]
  return {
    task_id: input.taskId,
    extraction_id: input.extractionId,
    likes_count: row ? parseDbInteger(row.likes_count) : 0,
    liked_by_me: row?.liked_by_me === true,
    shares_count: row ? parseDbInteger(row.shares_count) : 0,
    shared_by_me: row?.shared_by_me === true,
    followers_count: row ? parseDbInteger(row.followers_count) : 0,
    following_by_me: row?.following_by_me === true,
    views_count: row ? parseDbInteger(row.views_count) : 0,
    viewed_by_me: row?.viewed_by_me === true,
  } satisfies DbExtractionTaskLikeSummary
}

export async function toggleExtractionTaskLikeForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const taskOwnershipCheck = await client.query(
      `
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2
        LIMIT 1
      `,
      [input.taskId, input.extractionId]
    )

    if (!taskOwnershipCheck.rows[0]) {
      await client.query('ROLLBACK')
      return null
    }

    const existing = await client.query(
      `
        SELECT id
        FROM extraction_task_likes
        WHERE task_id = $1 AND extraction_id = $2 AND user_id = $3
        LIMIT 1
      `,
      [input.taskId, input.extractionId, input.userId]
    )

    if (existing.rows[0]) {
      await client.query(
        `
          DELETE FROM extraction_task_likes
          WHERE id = $1
        `,
        [existing.rows[0].id]
      )
    } else {
      await client.query(
        `
          INSERT INTO extraction_task_likes (
            id,
            task_id,
            extraction_id,
            user_id
          )
          VALUES ($1, $2, $3, $4)
        `,
        [randomUUID(), input.taskId, input.extractionId, input.userId]
      )
    }

    await client.query('COMMIT')
    return getExtractionTaskLikeSummaryForUser(input)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function toggleExtractionTaskFollowForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const taskOwnershipCheck = await client.query(
      `
        SELECT id
        FROM extraction_tasks
        WHERE id = $1 AND extraction_id = $2
        LIMIT 1
      `,
      [input.taskId, input.extractionId]
    )

    if (!taskOwnershipCheck.rows[0]) {
      await client.query('ROLLBACK')
      return null
    }

    const existing = await client.query(
      `
        SELECT id
        FROM extraction_task_follows
        WHERE task_id = $1 AND extraction_id = $2 AND user_id = $3
        LIMIT 1
      `,
      [input.taskId, input.extractionId, input.userId]
    )

    if (existing.rows[0]) {
      await client.query(
        `
          DELETE FROM extraction_task_follows
          WHERE id = $1
        `,
        [existing.rows[0].id]
      )
    } else {
      await client.query(
        `
          INSERT INTO extraction_task_follows (
            id,
            task_id,
            extraction_id,
            user_id
          )
          VALUES ($1, $2, $3, $4)
        `,
        [randomUUID(), input.taskId, input.extractionId, input.userId]
      )
    }

    await client.query('COMMIT')
    return getExtractionTaskLikeSummaryForUser(input)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function recordExtractionTaskShareForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const taskOwnershipCheck = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM extraction_tasks
      WHERE id = $1 AND extraction_id = $2
      LIMIT 1
    `,
    [input.taskId, input.extractionId]
  )

  if (!taskOwnershipCheck.rows[0]) {
    return null
  }

  await pool.query(
    `
      INSERT INTO extraction_task_shares (
        id,
        task_id,
        extraction_id,
        user_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (task_id, user_id)
      DO NOTHING
    `,
    [randomUUID(), input.taskId, input.extractionId, input.userId]
  )

  return getExtractionTaskLikeSummaryForUser(input)
}

export async function recordExtractionTaskViewForUser(input: {
  taskId: string
  extractionId: string
  userId: string
}) {
  await ensureDbReady()

  const taskOwnershipCheck = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM extraction_tasks
      WHERE id = $1 AND extraction_id = $2
      LIMIT 1
    `,
    [input.taskId, input.extractionId]
  )

  if (!taskOwnershipCheck.rows[0]) {
    return null
  }

  const { rows: insertedRows } = await pool.query<{ id: string }>(
    `
      INSERT INTO extraction_task_views (
        id,
        task_id,
        extraction_id,
        user_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (task_id, user_id)
      DO NOTHING
      RETURNING id
    `,
    [randomUUID(), input.taskId, input.extractionId, input.userId]
  )

  const summary = await getExtractionTaskLikeSummaryForUser(input)
  return {
    ...summary,
    recorded: insertedRows.length > 0,
  } satisfies DbExtractionTaskLikeSummary & { recorded: boolean }
}

export async function createOrGetShareToken(input: { extractionId: string; userId: string }) {
  await ensureDbReady()
  const generatedToken = randomUUID().replace(/-/g, '')
  const { rows } = await pool.query<DbShareTokenRow>(
    `
      INSERT INTO share_tokens (token, extraction_id, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (extraction_id)
      DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING token, extraction_id, user_id, created_at, last_used_at
    `,
    [generatedToken, input.extractionId, input.userId]
  )
  return mapShareTokenRow(rows[0])
}

export async function findSharedExtractionByToken(token: string) {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionRow>(
    `
      SELECT
        e.id,
        e.user_id,
        e.url,
        e.video_id,
        e.video_title,
        e.thumbnail_url,
        e.extraction_mode,
        e.objective,
        e.phases_json,
        e.pro_tip,
        e.metadata_json,
        e.share_visibility,
        e.created_at
      FROM share_tokens st
      INNER JOIN extractions e ON e.id = st.extraction_id
      WHERE st.token = $1
        AND e.share_visibility IN ('public', 'unlisted')
      LIMIT 1
    `,
    [token]
  )

  const row = rows[0]
  if (!row) return null

  await pool.query(
    `
      UPDATE share_tokens
      SET last_used_at = NOW()
      WHERE token = $1
    `,
    [token]
  )

  return mapExtractionRow(row)
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
  avg_monthly_ai_cost_per_user_usd: number
  avg_monthly_storage_cost_per_user_usd: number
  avg_monthly_total_cost_per_user_usd: number
  p95_monthly_total_cost_per_user_usd: number
  total_monthly_run_rate_cost_usd: number
  actual_gross_margin_pct: number | null
  avg_extraction_cost_usd: number
  avg_chat_cost_per_token_usd: number
  projected_cost_at_current_caps_usd: number
  projected_gross_margin_pct: number | null
  recommended_extractions_per_day: number | null
  recommended_chat_tokens_per_day: number | null
  current_extractions_per_day: number
  current_chat_tokens_per_day: number
  storage_limit_bytes: number
  unprofitable_users: number
  at_risk_users: number
  status: ProfitabilityStatus
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
  await ensureDbReady()
  const safeDays = Number.isFinite(periodDays) ? Math.min(90, Math.max(1, Math.trunc(periodDays))) : 30
  const storageCostUsdPerByteMonth = getEstimatedStorageCostUsdPerByteMonth()

  const [userPlanRows, usageRows, extractionRows] = await Promise.all([
    listProfitabilityUserPlanRows(),
    listProfitabilityUsageRows(safeDays),
    listProfitabilityExtractionCountRows(safeDays),
  ])

  const planRow = userPlanRows.find((row) => row.user_id === userId)
  if (!planRow) return null

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
  const aiCostMonthlyRunRateUsd = calculateMonthlyRunRate(aiCostPeriodUsd, safeDays)
  const monthlyVariableCostRunRateUsd = aiCostMonthlyRunRateUsd + storageCostMonthlyUsd
  const estimatedMonthlyFixedCostUsd = Number(planRow.estimated_monthly_fixed_cost_usd ?? 0)
  const monthlyTotalCostRunRateUsd = monthlyVariableCostRunRateUsd + estimatedMonthlyFixedCostUsd
  const priceMonthlyUsd = Number(planRow.price_monthly_usd ?? 0)
  const targetGrossMarginPct = normalizeMarginPct(Number(planRow.target_gross_margin_pct ?? 0.75))
  const maxVariableCostAllowedUsd = Math.max(
    0,
    calculateMaxVariableCostAllowed(priceMonthlyUsd, targetGrossMarginPct) - estimatedMonthlyFixedCostUsd
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

  const [plans, userPlanRows, usageRows, extractionRows] = await Promise.all([
    listPlans(),
    listProfitabilityUserPlanRows(),
    listProfitabilityUsageRows(safeDays),
    listProfitabilityExtractionCountRows(safeDays),
  ])

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
    const monthlyStorageCostUsd = Number(row.used_bytes ?? 0) * storageCostUsdPerByteMonth
    const totalMonthlyCostUsd =
      monthlyAiCostUsd + monthlyStorageCostUsd + Number(row.estimated_monthly_fixed_cost_usd ?? 0)

    const bucket = planUsers.get(row.plan_name) ?? []
    bucket.push({
      userId: row.user_id,
      totalMonthlyCostUsd,
      monthlyAiCostUsd,
      monthlyStorageCostUsd,
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
    const totalMonthlyRunRateCostUsd = users.reduce((sum, user) => sum + user.totalMonthlyCostUsd, 0)
    const avgMonthlyAiCostPerUserUsd = activeUsers > 0
      ? users.reduce((sum, user) => sum + user.monthlyAiCostUsd, 0) / activeUsers
      : 0
    const avgMonthlyStorageCostPerUserUsd = activeUsers > 0
      ? users.reduce((sum, user) => sum + user.monthlyStorageCostUsd, 0) / activeUsers
      : 0
    const avgMonthlyTotalCostPerUserUsd = activeUsers > 0 ? totalMonthlyRunRateCostUsd / activeUsers : 0
    const sortedMonthlyCosts = users
      .map((user) => user.totalMonthlyCostUsd)
      .sort((a, b) => a - b)
    const p95MonthlyTotalCostPerUserUsd = percentileFromSorted(sortedMonthlyCosts, 95)
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
    const maxVariableCostAllowedUsd = Math.max(
      0,
      calculateMaxVariableCostAllowed(plan.price_monthly_usd, plan.target_gross_margin_pct) -
        plan.estimated_monthly_fixed_cost_usd
    )
    const projectedCostAtCurrentCaps = calculateProjectedPlanCapCost({
      extractionsPerDay: plan.extractions_per_day,
      avgExtractionCostUsd,
      chatTokensPerDay: plan.chat_tokens_per_day,
      avgChatCostPerTokenUsd,
      avgMonthlyStorageCostUsd: avgMonthlyStorageCostPerUserUsd,
    })
    const projectedTotalCostUsd =
      projectedCostAtCurrentCaps.totalCostUsd + plan.estimated_monthly_fixed_cost_usd
    const actualGrossMarginPct = calculateGrossMarginPct(
      plan.price_monthly_usd,
      avgMonthlyTotalCostPerUserUsd
    )
    const projectedGrossMarginPct = calculateGrossMarginPct(plan.price_monthly_usd, projectedTotalCostUsd)
    const recommendedExtractionsPerDay = calculateRecommendedExtractionsPerDay({
      maxVariableCostAllowedUsd,
      avgExtractionCostUsd,
      currentChatCapCostUsd: projectedCostAtCurrentCaps.chatCapCostUsd,
      currentStorageCostUsd: avgMonthlyStorageCostPerUserUsd,
    })
    const recommendedChatTokensPerDay = calculateRecommendedChatTokensPerDay({
      maxVariableCostAllowedUsd,
      avgChatCostPerTokenUsd,
      currentExtractionCapCostUsd: projectedCostAtCurrentCaps.extractionCapCostUsd,
      currentStorageCostUsd: avgMonthlyStorageCostPerUserUsd,
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
      avg_monthly_ai_cost_per_user_usd: avgMonthlyAiCostPerUserUsd,
      avg_monthly_storage_cost_per_user_usd: avgMonthlyStorageCostPerUserUsd,
      avg_monthly_total_cost_per_user_usd: avgMonthlyTotalCostPerUserUsd,
      p95_monthly_total_cost_per_user_usd: p95MonthlyTotalCostPerUserUsd,
      total_monthly_run_rate_cost_usd: totalMonthlyRunRateCostUsd,
      actual_gross_margin_pct: actualGrossMarginPct,
      avg_extraction_cost_usd: avgExtractionCostUsd,
      avg_chat_cost_per_token_usd: avgChatCostPerTokenUsd,
      projected_cost_at_current_caps_usd: projectedTotalCostUsd,
      projected_gross_margin_pct: projectedGrossMarginPct,
      recommended_extractions_per_day: recommendedExtractionsPerDay,
      recommended_chat_tokens_per_day: recommendedChatTokensPerDay,
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
    // Fall back to env-based limit (same logic as resolveExtractionRateLimitPerHour)
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

export async function logStripeEvent(
  id: string,
  eventType: string,
  userId: string | null,
  rawJson: string
): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO stripe_events (id, event_type, user_id, raw_json)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, eventType, userId, rawJson]
  )
}

// ── Daily extraction limits + credits ──────────────────────────────────────

export async function getUserDailyLimit(userId: string): Promise<number> {
  await ensureDbReady()
  // Join user_plans → plans to get extractions_per_day; default 3 for free tier
  const { rows } = await pool.query<{ extractions_per_day: number | string }>(
    `SELECT p.extractions_per_day
     FROM user_plans up
     JOIN plans p ON p.name = up.plan
     WHERE up.user_id = $1 AND up.status = 'active'
     LIMIT 1`,
    [userId]
  )
  if (rows[0]) return parseDbInteger(rows[0].extractions_per_day)
  return 3 // free default
}

export async function getDailyExtractionSnapshot(userId: string): Promise<DailyExtractionSnapshot> {
  await ensureDbReady()
  const limit = await getUserDailyLimit(userId)
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD in UTC

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
  const extra_credits = creditsResult.rows[0] ? parseDbInteger(creditsResult.rows[0].extra_credits ?? 0) : 0

  // Reset is next UTC midnight
  const resetDate = new Date(today)
  resetDate.setUTCDate(resetDate.getUTCDate() + 1)
  const reset_at = resetDate.toISOString()

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
  const snapshot = await getDailyExtractionSnapshot(userId)

  if (snapshot.used < snapshot.limit) {
    // Within daily quota — increment count
    const today = new Date().toISOString().slice(0, 10)
    await pool.query(
      `INSERT INTO daily_extraction_counts (user_id, date, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, date)
       DO UPDATE SET count = daily_extraction_counts.count + 1, updated_at = NOW()`,
      [userId, today]
    )
    const updatedSnapshot = { ...snapshot, used: snapshot.used + 1, remaining: Math.max(0, snapshot.remaining - 1) }
    return { allowed: true, used_credit: false, snapshot: updatedSnapshot }
  }

  if (snapshot.extra_credits > 0) {
    // Use a credit
    await consumeUserCredit(userId)
    const updatedSnapshot = { ...snapshot, extra_credits: snapshot.extra_credits - 1 }
    return { allowed: true, used_credit: true, snapshot: updatedSnapshot }
  }

  return { allowed: false, used_credit: false, snapshot }
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
  const txId = randomUUID()
  await pool.query(
    `UPDATE user_plans
     SET extra_credits = GREATEST(0, extra_credits - 1), updated_at = NOW()
     WHERE user_id = $1 AND status = 'active' AND extra_credits > 0`,
    [userId]
  )
  await pool.query(
    `INSERT INTO credit_transactions (id, user_id, amount, reason)
     VALUES ($1, $2, -1, 'consumed')`,
    [txId, userId]
  )
}

export async function addUserCredits(
  userId: string,
  amount: number,
  reason: string,
  stripeSessionId?: string
): Promise<void> {
  await ensureDbReady()
  const txId = randomUUID()

  // Ensure user has a plan row (upsert free plan if missing)
  await pool.query(
    `INSERT INTO user_plans (id, user_id, plan, extractions_per_hour, extra_credits, status)
     VALUES ($1, $2, 'free', 12, $3, 'active')
     ON CONFLICT (user_id) WHERE status = 'active'
     DO UPDATE SET extra_credits = user_plans.extra_credits + $3, updated_at = NOW()`,
    [randomUUID(), userId, amount]
  )

  await pool.query(
    `INSERT INTO credit_transactions (id, user_id, amount, reason, stripe_session_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [txId, userId, amount, reason, stripeSessionId ?? null]
  )
}

export async function listUserCreditTransactions(userId: string, limit = 10): Promise<DbCreditTransaction[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbCreditTransactionRow>(
    `SELECT id, user_id, amount, reason, stripe_session_id, created_at
     FROM credit_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    amount: parseDbInteger(r.amount),
    reason: r.reason,
    stripe_session_id: r.stripe_session_id ?? null,
    created_at: toIso(r.created_at),
  }))
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
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTag>(
    `SELECT id, name, color FROM extraction_tags WHERE user_id = $1 ORDER BY name`,
    [userId]
  )
  return rows
}

export async function createOrGetTag(
  userId: string,
  name: string,
  color: string
): Promise<DbExtractionTag> {
  await ensureDbReady()
  const id = randomUUID()
  const { rows } = await pool.query<DbExtractionTag>(
    `INSERT INTO extraction_tags (id, user_id, name, color)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
     RETURNING id, name, color`,
    [id, userId, name.trim().toLowerCase(), color]
  )
  return rows[0]
}

export async function deleteUserTag(userId: string, tagId: string): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `DELETE FROM extraction_tags WHERE id = $1 AND user_id = $2`,
    [tagId, userId]
  )
}

export async function assignTagToExtraction(
  extractionId: string,
  tagId: string
): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO extraction_tag_assignments (extraction_id, tag_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [extractionId, tagId]
  )
}

export async function removeTagFromExtraction(
  extractionId: string,
  tagId: string
): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `DELETE FROM extraction_tag_assignments WHERE extraction_id = $1 AND tag_id = $2`,
    [extractionId, tagId]
  )
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
  await getDbReadyPromise()
  const { rows } = await pool.query<{
    owner_user_id: string
    owner_email: string
    owner_name: string | null
    video_title: string | null
    source_label: string | null
    objective: string | null
    task_text: string | null
  }>(
    `SELECT
       e.user_id AS owner_user_id,
       u.email AS owner_email,
       u.name AS owner_name,
       e.video_title,
       e.source_label,
       e.objective,
       t.item_text AS task_text
     FROM extractions e
     JOIN users u ON u.id = e.user_id
     LEFT JOIN extraction_tasks t ON t.id = $2 AND t.extraction_id = e.id
     WHERE e.id = $1`,
    [extractionId, taskId]
  )
  if (rows.length === 0) return { extraction: null, taskText: null }
  const row = rows[0]
  const extractionTitle = row.video_title ?? row.source_label ?? row.objective ?? 'Sin título'
  return {
    extraction: {
      ownerUserId: row.owner_user_id,
      ownerEmail: row.owner_email,
      ownerName: row.owner_name ?? '',
      extractionTitle,
    },
    taskText: row.task_text,
  }
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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function createWorkspace(input: {
  ownerId: string
  name: string
  slug?: string
  description?: string
  avatarColor?: string
}): Promise<DbWorkspace> {
  await getDbReadyPromise()
  const id = randomUUID()
  const slug = input.slug?.trim() || generateSlug(input.name) + '-' + id.slice(0, 6)
  const now = new Date()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<DbWorkspaceRow>(
      `INSERT INTO workspaces (id, name, slug, description, avatar_color, owner_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING *`,
      [id, input.name.trim(), slug, input.description?.trim() ?? null, input.avatarColor ?? 'indigo', input.ownerId, now]
    )
    // Add owner as member
    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, 'owner', $3)`,
      [id, input.ownerId, now]
    )
    await client.query('COMMIT')
    return mapWorkspaceRow(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function findWorkspaceById(id: string): Promise<DbWorkspace | null> {
  await getDbReadyPromise()
  const { rows } = await pool.query<DbWorkspaceRow>(
    `SELECT * FROM workspaces WHERE id = $1`,
    [id]
  )
  return rows[0] ? mapWorkspaceRow(rows[0]) : null
}

export async function findWorkspaceBySlug(slug: string): Promise<DbWorkspace | null> {
  await getDbReadyPromise()
  const { rows } = await pool.query<DbWorkspaceRow>(
    `SELECT * FROM workspaces WHERE slug = $1`,
    [slug]
  )
  return rows[0] ? mapWorkspaceRow(rows[0]) : null
}

export async function listWorkspacesForUser(userId: string): Promise<DbWorkspaceWithRole[]> {
  await getDbReadyPromise()
  const { rows } = await pool.query<DbWorkspaceWithRoleRow>(
    `SELECT w.*, wm.role,
       (SELECT COUNT(*) FROM workspace_members wm2 WHERE wm2.workspace_id = w.id)::int AS member_count
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $1
     ORDER BY w.updated_at DESC`,
    [userId]
  )
  return rows.map(mapWorkspaceWithRoleRow)
}

export async function updateWorkspace(input: {
  id: string
  requestingUserId: string
  name?: string
  description?: string | null
  avatarColor?: string
}): Promise<DbWorkspace | null> {
  await getDbReadyPromise()
  // Verify requester is admin+
  const role = await getWorkspaceMemberRole(input.id, input.requestingUserId)
  if (!role || (role !== 'owner' && role !== 'admin')) {
    throw new Error('Sin permisos para editar el workspace.')
  }

  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let idx = 1

  if (input.name !== undefined) {
    setClauses.push(`name = $${idx++}`)
    values.push(input.name.trim())
  }
  if ('description' in input) {
    setClauses.push(`description = $${idx++}`)
    values.push(input.description?.trim() ?? null)
  }
  if (input.avatarColor !== undefined) {
    setClauses.push(`avatar_color = $${idx++}`)
    values.push(input.avatarColor)
  }

  values.push(input.id)
  const { rows } = await pool.query<DbWorkspaceRow>(
    `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  )
  return rows[0] ? mapWorkspaceRow(rows[0]) : null
}

export async function deleteWorkspace(input: { id: string; ownerUserId: string }): Promise<void> {
  await getDbReadyPromise()
  const { rowCount } = await pool.query(
    `DELETE FROM workspaces WHERE id = $1 AND owner_user_id = $2`,
    [input.id, input.ownerUserId]
  )
  if (!rowCount) throw new Error('Solo el owner puede eliminar el workspace.')
}

// ── Members ──────────────────────────────────────────────────────────────────

export async function listWorkspaceMembers(workspaceId: string): Promise<DbWorkspaceMember[]> {
  await getDbReadyPromise()
  const { rows } = await pool.query<DbWorkspaceMemberRow>(
    `SELECT wm.workspace_id, wm.user_id, wm.role, wm.joined_at,
            u.name AS user_name, u.email AS user_email
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
     ORDER BY wm.joined_at ASC`,
    [workspaceId]
  )
  return rows.map(mapWorkspaceMemberRow)
}

export async function getWorkspaceMemberRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  )
  return rows[0] ? normalizeWorkspaceRole(rows[0].role) : null
}

export async function upsertWorkspaceMember(input: {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  requestingUserId: string
}): Promise<DbWorkspaceMember> {
  await getDbReadyPromise()
  const reqRole = await getWorkspaceMemberRole(input.workspaceId, input.requestingUserId)
  if (!reqRole || (reqRole !== 'owner' && reqRole !== 'admin')) {
    throw new Error('Sin permisos para gestionar miembros.')
  }
  // Cannot change owner's role via this function
  if (input.role === 'owner') throw new Error('No se puede asignar rol owner directamente.')

  const { rows } = await pool.query<DbWorkspaceMemberRow>(
    `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET role = $3
     RETURNING workspace_id, user_id, role, joined_at`,
    [input.workspaceId, input.userId, input.role]
  )
  const memberRow = rows[0]
  // Fetch user info
  const { rows: uRows } = await pool.query<{ name: string | null; email: string | null }>(
    `SELECT name, email FROM users WHERE id = $1`,
    [input.userId]
  )
  return mapWorkspaceMemberRow({
    ...memberRow,
    user_name: uRows[0]?.name ?? null,
    user_email: uRows[0]?.email ?? null,
  })
}

export async function removeWorkspaceMember(input: {
  workspaceId: string
  userId: string
  requestingUserId: string
}): Promise<void> {
  await getDbReadyPromise()
  const reqRole = await getWorkspaceMemberRole(input.workspaceId, input.requestingUserId)
  // Self-removal allowed; admin+ can remove others (but not owner)
  const isSelf = input.requestingUserId === input.userId
  if (!isSelf && (!reqRole || (reqRole !== 'owner' && reqRole !== 'admin'))) {
    throw new Error('Sin permisos para remover miembros.')
  }
  // Cannot remove owner
  const targetRole = await getWorkspaceMemberRole(input.workspaceId, input.userId)
  if (targetRole === 'owner') throw new Error('No se puede remover al owner del workspace.')

  await pool.query(
    `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [input.workspaceId, input.userId]
  )
}

export async function transferWorkspaceOwnership(input: {
  workspaceId: string
  currentOwnerId: string
  newOwnerId: string
}): Promise<void> {
  await getDbReadyPromise()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Verify current owner
    const { rows } = await client.query<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM workspaces WHERE id = $1`,
      [input.workspaceId]
    )
    if (!rows[0] || rows[0].owner_user_id !== input.currentOwnerId) {
      throw new Error('Solo el owner puede transferir el workspace.')
    }
    // Ensure new owner is a member
    const { rows: memberRows } = await client.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [input.workspaceId, input.newOwnerId]
    )
    if (!memberRows[0]) throw new Error('El nuevo owner debe ser miembro del workspace.')

    // Update workspace owner
    await client.query(
      `UPDATE workspaces SET owner_user_id = $1, updated_at = NOW() WHERE id = $2`,
      [input.newOwnerId, input.workspaceId]
    )
    // Downgrade old owner to admin
    await client.query(
      `UPDATE workspace_members SET role = 'admin' WHERE workspace_id = $1 AND user_id = $2`,
      [input.workspaceId, input.currentOwnerId]
    )
    // Upgrade new owner
    await client.query(
      `UPDATE workspace_members SET role = 'owner' WHERE workspace_id = $1 AND user_id = $2`,
      [input.workspaceId, input.newOwnerId]
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function createWorkspaceInvitation(input: {
  workspaceId: string
  invitedByUserId: string
  email: string
  role: WorkspaceRole
}): Promise<DbWorkspaceInvitation> {
  await getDbReadyPromise()
  const reqRole = await getWorkspaceMemberRole(input.workspaceId, input.invitedByUserId)
  if (!reqRole || (reqRole !== 'owner' && reqRole !== 'admin')) {
    throw new Error('Sin permisos para invitar miembros.')
  }

  const id = randomUUID()
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  // Upsert: if there's an existing invitation for this workspace+email, replace it
  const { rows } = await pool.query<DbWorkspaceInvitationRow>(
    `INSERT INTO workspace_invitations
       (id, workspace_id, invited_by_user_id, email, role, token, status, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW())
     ON CONFLICT (workspace_id, email) DO UPDATE
       SET id = $1, invited_by_user_id = $3, role = $5, token = $6, status = 'pending',
           expires_at = $7, created_at = NOW(), accepted_at = NULL
     RETURNING *`,
    [id, input.workspaceId, input.invitedByUserId, input.email.toLowerCase().trim(), input.role, token, expiresAt]
  )
  return mapWorkspaceInvitationRow(rows[0])
}

export async function findWorkspaceInvitationByToken(
  token: string
): Promise<DbWorkspaceInvitation | null> {
  await getDbReadyPromise()
  const { rows } = await pool.query<DbWorkspaceInvitationRow>(
    `SELECT wi.*, w.name AS workspace_name, u.name AS invited_by_name
     FROM workspace_invitations wi
     JOIN workspaces w ON w.id = wi.workspace_id
     LEFT JOIN users u ON u.id = wi.invited_by_user_id
     WHERE wi.token = $1`,
    [token]
  )
  return rows[0] ? mapWorkspaceInvitationRow(rows[0]) : null
}

export async function acceptWorkspaceInvitation(input: {
  token: string
  userId: string
}): Promise<DbWorkspaceMember> {
  await getDbReadyPromise()
  const invitation = await findWorkspaceInvitationByToken(input.token)
  if (!invitation) throw new Error('Invitación no encontrada.')
  if (invitation.status !== 'pending') throw new Error('Esta invitación ya fue procesada.')
  if (new Date(invitation.expires_at) < new Date()) throw new Error('La invitación ha expirado.')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Insert or update member
    const { rows } = await client.query<DbWorkspaceMemberRow>(
      `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $3
       RETURNING workspace_id, user_id, role, joined_at`,
      [invitation.workspace_id, input.userId, invitation.role]
    )
    // Mark invitation accepted
    await client.query(
      `UPDATE workspace_invitations SET status = 'accepted', accepted_at = NOW() WHERE token = $1`,
      [input.token]
    )
    await client.query('COMMIT')
    const memberRow = rows[0]
    const { rows: uRows } = await pool.query<{ name: string | null; email: string | null }>(
      `SELECT name, email FROM users WHERE id = $1`,
      [input.userId]
    )
    return mapWorkspaceMemberRow({
      ...memberRow,
      user_name: uRows[0]?.name ?? null,
      user_email: uRows[0]?.email ?? null,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function declineWorkspaceInvitation(token: string): Promise<void> {
  await getDbReadyPromise()
  await pool.query(
    `UPDATE workspace_invitations SET status = 'declined' WHERE token = $1 AND status = 'pending'`,
    [token]
  )
}

export async function listWorkspaceInvitations(
  workspaceId: string
): Promise<DbWorkspaceInvitation[]> {
  await getDbReadyPromise()
  const { rows } = await pool.query<DbWorkspaceInvitationRow>(
    `SELECT wi.*, w.name AS workspace_name, u.name AS invited_by_name
     FROM workspace_invitations wi
     JOIN workspaces w ON w.id = wi.workspace_id
     LEFT JOIN users u ON u.id = wi.invited_by_user_id
     WHERE wi.workspace_id = $1 AND wi.status = 'pending'
     ORDER BY wi.created_at DESC`,
    [workspaceId]
  )
  return rows.map(mapWorkspaceInvitationRow)
}

export async function cancelWorkspaceInvitation(input: {
  invitationId: string
  requestingUserId: string
}): Promise<void> {
  await getDbReadyPromise()
  const { rows } = await pool.query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_invitations WHERE id = $1`,
    [input.invitationId]
  )
  if (!rows[0]) throw new Error('Invitación no encontrada.')
  const role = await getWorkspaceMemberRole(rows[0].workspace_id, input.requestingUserId)
  if (!role || (role !== 'owner' && role !== 'admin')) {
    throw new Error('Sin permisos para cancelar invitaciones.')
  }
  await pool.query(`DELETE FROM workspace_invitations WHERE id = $1`, [input.invitationId])
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

interface DbExtractionTaskEdgeRow {
  id: string
  extraction_id: string
  from_task_id: string
  to_task_id: string
  edge_type: string
  label: string | null
  expected_extra_days: number | string | null
  sort_order: number | string
  created_at: Date | string
  updated_at: Date | string
}

interface DbDecisionSelectionRow {
  extraction_id: string
  decision_task_id: string
  selected_to_task_id: string
  created_at: Date | string
  updated_at: Date | string
}

function mapEdgeRow(row: DbExtractionTaskEdgeRow): DbExtractionTaskEdge {
  return {
    id: row.id,
    extraction_id: row.extraction_id,
    from_task_id: row.from_task_id,
    to_task_id: row.to_task_id,
    edge_type: row.edge_type as 'and' | 'xor' | 'loop',
    label: row.label ?? null,
    expected_extra_days: row.expected_extra_days != null ? Number(row.expected_extra_days) : null,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number.parseInt(String(row.sort_order), 10),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }
}

export async function listExtractionTaskEdges(extractionId: string): Promise<DbExtractionTaskEdge[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbExtractionTaskEdgeRow>(
    `SELECT id, extraction_id, from_task_id, to_task_id, edge_type, label, expected_extra_days, sort_order, created_at, updated_at
     FROM extraction_task_edges WHERE extraction_id = $1 ORDER BY sort_order, created_at`,
    [extractionId]
  )
  return rows.map(mapEdgeRow)
}

export async function listDecisionSelections(extractionId: string): Promise<DbExtractionTaskDecisionSelection[]> {
  await ensureDbReady()
  const { rows } = await pool.query<DbDecisionSelectionRow>(
    `SELECT extraction_id, decision_task_id, selected_to_task_id, created_at, updated_at
     FROM extraction_task_decision_selection WHERE extraction_id = $1`,
    [extractionId]
  )
  return rows.map((row) => ({
    extraction_id: row.extraction_id,
    decision_task_id: row.decision_task_id,
    selected_to_task_id: row.selected_to_task_id,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  }))
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
  await ensureDbReady()
  const id = randomUUID()
  const { rows } = await pool.query<DbExtractionTaskEdgeRow>(
    `INSERT INTO extraction_task_edges (id, extraction_id, from_task_id, to_task_id, edge_type, label, expected_extra_days, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (extraction_id, from_task_id, to_task_id, edge_type) DO UPDATE
       SET label = EXCLUDED.label,
           expected_extra_days = EXCLUDED.expected_extra_days,
           updated_at = NOW()
     RETURNING id, extraction_id, from_task_id, to_task_id, edge_type, label, expected_extra_days, sort_order, created_at, updated_at`,
    [id, input.extractionId, input.fromTaskId, input.toTaskId, input.edgeType, input.label, input.expectedExtraDays, input.sortOrder ?? 0]
  )
  return mapEdgeRow(rows[0])
}

export async function deleteTaskEdge(input: {
  extractionId: string
  fromTaskId: string
  toTaskId: string
  edgeType: 'and' | 'xor' | 'loop'
}): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `DELETE FROM extraction_task_edges WHERE extraction_id = $1 AND from_task_id = $2 AND to_task_id = $3 AND edge_type = $4`,
    [input.extractionId, input.fromTaskId, input.toTaskId, input.edgeType]
  )
}

export async function upsertDecisionSelection(input: {
  extractionId: string
  decisionTaskId: string
  selectedToTaskId: string
}): Promise<DbExtractionTaskDecisionSelection> {
  await ensureDbReady()
  const { rows } = await pool.query<DbDecisionSelectionRow>(
    `INSERT INTO extraction_task_decision_selection (extraction_id, decision_task_id, selected_to_task_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (extraction_id, decision_task_id) DO UPDATE
       SET selected_to_task_id = EXCLUDED.selected_to_task_id, updated_at = NOW()
     RETURNING extraction_id, decision_task_id, selected_to_task_id, created_at, updated_at`,
    [input.extractionId, input.decisionTaskId, input.selectedToTaskId]
  )
  return {
    extraction_id: rows[0].extraction_id,
    decision_task_id: rows[0].decision_task_id,
    selected_to_task_id: rows[0].selected_to_task_id,
    created_at: toIso(rows[0].created_at),
    updated_at: toIso(rows[0].updated_at),
  }
}

export async function updateExtractionTaskFlowNodeType(input: {
  taskId: string
  extractionId: string
  flowNodeType: 'process' | 'decision'
}): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `UPDATE extraction_tasks SET flow_node_type = $1, updated_at = NOW() WHERE id = $2 AND extraction_id = $3`,
    [input.flowNodeType, input.taskId, input.extractionId]
  )
}

// ── Presentation Deck ─────────────────────────────────────────────────────────

export async function getPresentationDeck(
  { extractionId }: { extractionId: string }
): Promise<{ deckJson: string } | null> {
  await ensureDbReady()
  const { rows } = await pool.query<{ deck_json: string }>(
    `SELECT deck_json FROM extraction_presentations WHERE extraction_id = $1`,
    [extractionId]
  )
  if (!rows[0]) return null
  return { deckJson: rows[0].deck_json }
}

export async function savePresentationDeck(
  { extractionId, deckJson }: { extractionId: string; deckJson: string }
): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO extraction_presentations (extraction_id, deck_json)
     VALUES ($1, $2)
     ON CONFLICT (extraction_id) DO UPDATE SET deck_json = $2, updated_at = NOW()`,
    [extractionId, deckJson]
  )
}

export async function getPresentationState(
  { extractionId, userId }: { extractionId: string; userId: string }
): Promise<{ lastSlideId: string | null } | null> {
  await ensureDbReady()
  const { rows } = await pool.query<{ last_slide_id: string | null }>(
    `SELECT last_slide_id FROM extraction_presentation_states WHERE extraction_id = $1 AND user_id = $2`,
    [extractionId, userId]
  )
  if (!rows[0]) return null
  return { lastSlideId: rows[0].last_slide_id }
}

export async function setPresentationState(
  { extractionId, userId, lastSlideId }: { extractionId: string; userId: string; lastSlideId: string }
): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO extraction_presentation_states (extraction_id, user_id, last_slide_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (extraction_id, user_id) DO UPDATE SET last_slide_id = $3, updated_at = NOW()`,
    [extractionId, userId, lastSlideId]
  )
}

export async function listFlowNodePositions(extractionId: string) {
  await ensureDbReady()
  const { rows } = await pool.query(
    `SELECT task_id, extraction_id, cx, cy, updated_at
     FROM flow_node_positions WHERE extraction_id = $1`,
    [extractionId]
  )
  return rows.map((r) => ({
    task_id: r.task_id as string,
    extraction_id: r.extraction_id as string,
    cx: Number(r.cx),
    cy: Number(r.cy),
    updated_at: toIso(r.updated_at as Date | string),
  }))
}

export async function upsertFlowNodePosition(input: {
  taskId: string; extractionId: string; cx: number; cy: number
}): Promise<void> {
  await ensureDbReady()
  await pool.query(
    `INSERT INTO flow_node_positions (task_id, extraction_id, cx, cy)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (task_id, extraction_id) DO UPDATE
       SET cx = EXCLUDED.cx, cy = EXCLUDED.cy, updated_at = NOW()`,
    [input.taskId, input.extractionId, input.cx, input.cy]
  )
}
