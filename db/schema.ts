/**
 * db/schema.ts — TypeScript type definitions for the markit Supabase schema.
 *
 * These types mirror the SQL migration in db/migrations/0002_v8_tables.sql
 * plus the existing markit.trace_exports from 0001_trace_exports.sql.
 *
 * Usage: import the Row/Insert types and cast Supabase query results to them.
 * The Supabase JS client does not auto-infer schema types unless you generate
 * them with `supabase gen types` — these manual types serve the same purpose.
 */

// ─── markit.projects ─────────────────────────────────────────────────────────

export type ProjectRow = {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
  archived_at: string | null
  state_json: Record<string, unknown>
}

export type ProjectInsert = Omit<ProjectRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
  created_at?: string
  updated_at?: string
}

// ─── markit.media ─────────────────────────────────────────────────────────────

export type MediaKind = 'video' | 'image' | 'audio'

export type MediaRow = {
  id: string
  user_id: string
  project_id: string | null
  kind: MediaKind
  source_path: string
  source_bucket: string
  source_size_bytes: number
  width: number | null
  height: number | null
  duration_sec: string | null  // numeric → string from Supabase
  codec: string | null
  thumbnail_path: string | null
  intensity_json: Record<string, unknown> | null
  imported_at: string
  creatix_content_id: string | null
}

export type MediaInsert = Omit<MediaRow, 'id' | 'imported_at'> & {
  id?: string
  imported_at?: string
}

// ─── markit.render_jobs ───────────────────────────────────────────────────────

export type RenderJobState =
  | 'queued'
  | 'running'
  | 'embedding'
  | 'uploading'
  | 'confirming'
  | 'done'
  | 'failed'
  | 'cancelled'

export type RenderJobRow = {
  id: string
  user_id: string
  project_id: string
  edit_plan_json: Record<string, unknown>
  encoder_profile: string
  pipeline_version: string
  state: RenderJobState
  output_path: string | null
  output_bucket: string | null
  output_size_bytes: number | null
  output_sha256: string | null
  creatix_export_id: string | null
  error_code: string | null
  error_message: string | null
  retry_count: number
  modal_seconds: string | null  // numeric → string
  estimated_cost_usd: string | null  // numeric → string
  enqueued_at: string
  started_at: string | null
  finished_at: string | null
}

export type RenderJobInsert = Omit<RenderJobRow, 'id' | 'enqueued_at'> & {
  id?: string
  enqueued_at?: string
}

// ─── markit.brand_settings ────────────────────────────────────────────────────

export type BrandPlatformDb = 'onlyfans' | 'fansly' | 'manyvids' | 'custom'

export type BrandPositionDb =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export type BrandSettingsRow = {
  user_id: string
  platform: BrandPlatformDb
  handle: string
  position: BrandPositionDb
  opacity_pct: number
  custom_logo_path: string | null
  auto_apply: boolean
  markit_only: boolean
  updated_at: string
}

export type BrandSettingsInsert = Omit<BrandSettingsRow, 'updated_at'> & {
  updated_at?: string
}

// ─── markit.leak_alert_views ─────────────────────────────────────────────────

export type LeakAlertSourceDb = 'crawler' | 'reported' | 'manual'
export type DmcaStateDb = 'none' | 'drafted' | 'sent' | 'acknowledged'

export type LeakAlertViewRow = {
  id: string                                // mirrors Creatix leak_alerts.id
  user_id: string
  url: string
  source: LeakAlertSourceDb
  detected_at: string
  attributed_to_recipient_label: string | null
  attribution_confidence: string | null     // numeric → string
  attribution_marker_id: string | null
  attribution_fetched_at: string | null
  viewed_at: string | null
  dismissed_at: string | null
  dmca_state: DmcaStateDb
  dmca_draft_id: string | null
  updated_at: string
}

export type LeakAlertViewInsert = Omit<LeakAlertViewRow, 'updated_at'> & {
  updated_at?: string
}

// ─── markit.trace_exports (existing — from 0001_trace_exports.sql) ────────────

export type TraceExportRow = {
  id: string
  user_id: string
  payload_id: string
  recipient_label: string
  source_path: string
  source_sha256: string | null
  output_path: string | null
  output_sha256: string | null
  size_bytes: number | null
  algorithm: string
  created_at: string
  expires_at: string | null
}

export type TraceExportInsert = Omit<TraceExportRow, 'id' | 'created_at'> & {
  id?: string
  created_at?: string
}
