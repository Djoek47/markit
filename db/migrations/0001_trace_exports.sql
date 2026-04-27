-- Markit standalone trace tool — minimal schema.
-- Idempotent: safe to re-run.
--
-- Run via Supabase SQL editor (https://supabase.com/dashboard/project/_/sql) or:
--   supabase db push --include-all
--
-- Buckets must be created separately (Supabase dashboard → Storage):
--   markit-trace-uploads  (private; signed URL only; 60 min upload window)
--   markit-trace-renders  (private; signed URL only; 7 day download window)

create schema if not exists markit;

-- One row per traced export. payload_id is the canonical lookup key for detect.
create table if not exists markit.trace_exports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  payload_id      uuid not null unique,                 -- matches the embedded marker's payload_id
  recipient_label text not null check (length(recipient_label) <= 500),
  source_path     text not null,                        -- markit-trace-uploads/{userId}/{uploadId}.{ext}
  source_sha256   text,                                 -- pre-embed hash (for evidence packets)
  output_path     text,                                 -- markit-trace-renders/{userId}/{payloadId}.{ext}
  output_sha256   text,                                 -- post-embed hash
  size_bytes      bigint,                               -- final embedded size
  algorithm       text not null default 'append-v1',    -- forward-compat for future v2 dct
  created_at      timestamptz not null default now(),
  expires_at      timestamptz                           -- mirrors payload.exp; null = no expiry
);

create index if not exists trace_exports_user_idx on markit.trace_exports (user_id, created_at desc);
create index if not exists trace_exports_payload_idx on markit.trace_exports (payload_id);
create index if not exists trace_exports_recipient_idx on markit.trace_exports (user_id, recipient_label);

-- Row-level security: every creator only ever sees their own traces.
-- Service-role still bypasses; the embed/detect API routes use the service-role key
-- after they've already verified the JWT belongs to user_id.
alter table markit.trace_exports enable row level security;

drop policy if exists trace_exports_select_own on markit.trace_exports;
create policy trace_exports_select_own on markit.trace_exports
  for select using (auth.uid() = user_id);

drop policy if exists trace_exports_insert_own on markit.trace_exports;
create policy trace_exports_insert_own on markit.trace_exports
  for insert with check (auth.uid() = user_id);

drop policy if exists trace_exports_update_own on markit.trace_exports;
create policy trace_exports_update_own on markit.trace_exports
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists trace_exports_delete_own on markit.trace_exports;
create policy trace_exports_delete_own on markit.trace_exports
  for delete using (auth.uid() = user_id);

comment on table markit.trace_exports is
  'Markit standalone forensic-trace registry. One row per traced export. Detect resolves payload_id → recipient_label.';

-- ---------------------------------------------------------------------------
-- Storage bucket policies (run AFTER creating the buckets in the dashboard).
-- These are the policies Supabase Storage uses; they live in storage.objects.
-- ---------------------------------------------------------------------------

-- Read: only the owning user can read uploads + renders.
drop policy if exists markit_trace_storage_read on storage.objects;
create policy markit_trace_storage_read on storage.objects
  for select using (
    bucket_id in ('markit-trace-uploads', 'markit-trace-renders')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Insert: a user can only upload to their own folder.
drop policy if exists markit_trace_storage_insert on storage.objects;
create policy markit_trace_storage_insert on storage.objects
  for insert with check (
    bucket_id in ('markit-trace-uploads', 'markit-trace-renders')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Delete: a user can only delete their own files (creator-initiated cleanup).
drop policy if exists markit_trace_storage_delete on storage.objects;
create policy markit_trace_storage_delete on storage.objects
  for delete using (
    bucket_id in ('markit-trace-uploads', 'markit-trace-renders')
    and auth.uid()::text = (storage.foldername(name))[1]
  );
