# Markit standalone trace tool — setup

What you do once, in Supabase, before the trace tool will work in production. ~5 minutes total.

## 1. Run the SQL migration

Open Supabase Dashboard → SQL Editor → New Query. Paste the contents of `db/migrations/0001_trace_exports.sql` and run it.

Verify:
- `markit.trace_exports` table exists with RLS enabled
- 4 RLS policies on `markit.trace_exports` (select/insert/update/delete, all `auth.uid() = user_id`)
- 3 storage policies on `storage.objects` for the two buckets

If the storage policies fail because the buckets don't exist yet, that's fine — create the buckets first (step 2), then re-run just the storage-policy block.

## 2. Create the two storage buckets

Supabase Dashboard → Storage → New Bucket. Create both:

| Bucket | Public? | Purpose |
|---|---|---|
| `markit-trace-uploads` | **Private** | Source videos uploaded by creators (60-min signed URLs). |
| `markit-trace-renders` | **Private** | Traced output files (7-day signed URLs). |

Both must be **Private**. The RLS policies in the SQL migration handle access control.

## 3. Set env vars

In Vercel → Markit project → Settings → Environment Variables, confirm or add:

```
NEXT_PUBLIC_SUPABASE_URL=...                 # already set (auth uses it)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...            # already set
SUPABASE_SERVICE_ROLE_KEY=...                # required for trace embed (server-side storage writes)
MARKIT_TRACE_SECRET=...                      # 16+ chars; can equal MARKIT_ARIADNE_SHARED_SECRET
```

`MARKIT_TRACE_SECRET` signs every embedded payload. **If you change it, every previously-traced file becomes "marker_invalid_signature" on detect.** Pick once and don't rotate without a migration plan.

For local dev, drop the same values into `.env.local`.

## 4. Smoke test

After deploy:
1. Sign in to Markit
2. Navigate to `/trace`
3. Drop a small mp4 (≤30s)
4. Type `alice_test` as recipient
5. Click Sign & Download — file downloads with `_alice_test` in the name
6. Drop the downloaded file into `/detect` — verdict reads "Sent to alice_test"

If steps 4–6 work end-to-end, trace is operational.

## Caveats (on the user-facing UI we'll surface this same copy)

Append-v1 trace **survives** direct file shares and most platform re-uploads (mp4 → mp4 with no re-encode).

Append-v1 **does not survive** re-encoding, screenshots, or any operation that strips trailing bytes. v2 (re-encode-survival via DCT-domain watermarking) is on the v1.1 roadmap.
