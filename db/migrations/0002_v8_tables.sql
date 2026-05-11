-- Markit v8 — new application tables
-- Idempotent: safe to re-run.
-- Prerequisite: 0001_trace_exports.sql must have run first (creates markit schema).
--
-- Run via Supabase SQL editor or:
--   supabase db push --include-all

-- ─── markit.projects ─────────────────────────────────────────────────────────

create table if not exists markit.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(name) between 1 and 255),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  state_json  jsonb not null default '{}'
);

create index if not exists projects_user_idx on markit.projects (user_id, updated_at desc);

alter table markit.projects enable row level security;

drop policy if exists projects_select_own on markit.projects;
create policy projects_select_own on markit.projects
  for select using (auth.uid() = user_id);

drop policy if exists projects_insert_own on markit.projects;
create policy projects_insert_own on markit.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists projects_update_own on markit.projects;
create policy projects_update_own on markit.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists projects_delete_own on markit.projects;
create policy projects_delete_own on markit.projects
  for delete using (auth.uid() = user_id);

comment on table markit.projects is
  'Editor projects. state_json stores the full editor session state for persistence.';

-- ─── markit.media ─────────────────────────────────────────────────────────────
-- Uploaded or bridge-imported media items.

create table if not exists markit.media (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  project_id          uuid references markit.projects(id) on delete set null,
  kind                text not null check (kind in ('video', 'image', 'audio')),
  source_path         text not null,           -- path within source_bucket
  source_bucket       text not null,           -- e.g. 'markit-uploads'
  source_size_bytes   bigint not null check (source_size_bytes > 0),
  width               integer,
  height              integer,
  duration_sec        numeric,
  codec               text,
  thumbnail_path      text,
  intensity_json      jsonb,                   -- cached IntensityScan result
  imported_at         timestamptz not null default now(),
  creatix_content_id  text                     -- bridge-mode: Creatix contentId
);

create index if not exists media_user_idx on markit.media (user_id, imported_at desc);
create index if not exists media_project_idx on markit.media (project_id);
create index if not exists media_creatix_idx on markit.media (creatix_content_id) where creatix_content_id is not null;

alter table markit.media enable row level security;

drop policy if exists media_select_own on markit.media;
create policy media_select_own on markit.media
  for select using (auth.uid() = user_id);

drop policy if exists media_insert_own on markit.media;
create policy media_insert_own on markit.media
  for insert with check (auth.uid() = user_id);

drop policy if exists media_update_own on markit.media;
create policy media_update_own on markit.media
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists media_delete_own on markit.media;
create policy media_delete_own on markit.media
  for delete using (auth.uid() = user_id);

comment on table markit.media is
  'Media items uploaded or bridge-imported by a creator. intensity_json caches the scan result.';

-- ─── markit.render_jobs ───────────────────────────────────────────────────────

create table if not exists markit.render_jobs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  project_id           uuid not null references markit.projects(id) on delete cascade,
  edit_plan_json       jsonb not null,
  encoder_profile      text not null,
  pipeline_version     text not null,
  state                text not null default 'queued'
                         check (state in ('queued','running','embedding','uploading','confirming','done','failed','cancelled')),
  output_path          text,
  output_bucket        text,
  output_size_bytes    bigint,
  output_sha256        text check (output_sha256 ~ '^[0-9a-fA-F]{64}$' or output_sha256 is null),
  creatix_export_id    uuid,                 -- ariadne_exports.id in Creatix
  error_code           text,
  error_message        text,
  retry_count          integer not null default 0,
  modal_seconds        numeric,
  estimated_cost_usd   numeric,
  enqueued_at          timestamptz not null default now(),
  started_at           timestamptz,
  finished_at          timestamptz
);

create index if not exists renderjobs_user_idx    on markit.render_jobs (user_id, enqueued_at desc);
create index if not exists renderjobs_project_idx on markit.render_jobs (project_id);
create index if not exists renderjobs_state_idx   on markit.render_jobs (state, enqueued_at) where state in ('queued','running');

alter table markit.render_jobs enable row level security;

drop policy if exists renderjobs_select_own on markit.render_jobs;
create policy renderjobs_select_own on markit.render_jobs
  for select using (auth.uid() = user_id);

drop policy if exists renderjobs_insert_own on markit.render_jobs;
create policy renderjobs_insert_own on markit.render_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists renderjobs_update_own on markit.render_jobs;
create policy renderjobs_update_own on markit.render_jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table markit.render_jobs is
  'Render queue. edit_plan_json is the full EditPlan at submission time. Service role writes state transitions.';

-- ─── markit.brand_settings ────────────────────────────────────────────────────

create table if not exists markit.brand_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  platform         text not null check (platform in ('onlyfans','fansly','manyvids','custom')),
  handle           text not null check (length(handle) between 1 and 255),
  position         text not null check (position in (
                     'top-left','top-center','top-right',
                     'middle-left','middle-center','middle-right',
                     'bottom-left','bottom-center','bottom-right')),
  opacity_pct      integer not null check (opacity_pct between 20 and 100),
  custom_logo_path text,
  auto_apply       boolean not null default true,
  markit_only      boolean not null default false,
  updated_at       timestamptz not null default now()
);

alter table markit.brand_settings enable row level security;

drop policy if exists brand_settings_select_own on markit.brand_settings;
create policy brand_settings_select_own on markit.brand_settings
  for select using (auth.uid() = user_id);

drop policy if exists brand_settings_insert_own on markit.brand_settings;
create policy brand_settings_insert_own on markit.brand_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists brand_settings_update_own on markit.brand_settings;
create policy brand_settings_update_own on markit.brand_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists brand_settings_delete_own on markit.brand_settings;
create policy brand_settings_delete_own on markit.brand_settings
  for delete using (auth.uid() = user_id);

comment on table markit.brand_settings is
  'Per-creator brand watermark config. One row per user (upsert pattern). Synced via Supabase Realtime.';

-- ─── markit.leak_alert_views ─────────────────────────────────────────────────
-- Local cache of Creatix leak_alerts for vault panel display.
-- canonical_id mirrors the Creatix leak_alerts.id — used as the primary key
-- so Realtime upserts from Creatix are idempotent.

create table if not exists markit.leak_alert_views (
  id                           uuid primary key,    -- mirrors Creatix leak_alerts.id
  user_id                      uuid not null references auth.users(id) on delete cascade,
  url                          text not null,
  source                       text not null check (source in ('crawler','reported','manual')),
  detected_at                  timestamptz not null,
  attributed_to_recipient_label text,
  attribution_confidence       numeric check (attribution_confidence between 0 and 1),
  attribution_marker_id        text,
  attribution_fetched_at       timestamptz,
  viewed_at                    timestamptz,
  dismissed_at                 timestamptz,
  dmca_state                   text not null default 'none'
                                 check (dmca_state in ('none','drafted','sent','acknowledged')),
  dmca_draft_id                uuid,
  updated_at                   timestamptz not null default now()
);

create index if not exists leak_alert_views_user_idx on markit.leak_alert_views (user_id, detected_at desc);
create index if not exists leak_alert_views_needs_attention_idx on markit.leak_alert_views (user_id)
  where dismissed_at is null and dmca_state = 'none' and viewed_at is null;

alter table markit.leak_alert_views enable row level security;

drop policy if exists leak_alert_views_select_own on markit.leak_alert_views;
create policy leak_alert_views_select_own on markit.leak_alert_views
  for select using (auth.uid() = user_id);

drop policy if exists leak_alert_views_insert_own on markit.leak_alert_views;
create policy leak_alert_views_insert_own on markit.leak_alert_views
  for insert with check (auth.uid() = user_id);

drop policy if exists leak_alert_views_update_own on markit.leak_alert_views;
create policy leak_alert_views_update_own on markit.leak_alert_views
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists leak_alert_views_delete_own on markit.leak_alert_views;
create policy leak_alert_views_delete_own on markit.leak_alert_views
  for delete using (auth.uid() = user_id);

comment on table markit.leak_alert_views is
  'Vault-side cache of Creatix leak alerts. Populated via Supabase Realtime. Service role upserts on attribution updates.';
