# Markit deployment checklist

## Vercel (this project)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Same Supabase project as Circe et Venus |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same as Creatix |
| `NEXT_PUBLIC_CREATIX_APP_URL` | Yes | e.g. `https://www.circeetvenus.com` (no trailing slash) |
| `FRAME_EXPORT_SECRET` | Yes | Must match Creatix `FRAME_EXPORT_SECRET` |
| `CREATIX_EXPORT_HOST_ALLOWLIST` | No | Extra hostnames for `exportUrl` (defaults always include production Creatix hosts) |

After changing env vars, **Redeploy**.

## Creatix (main app)

Set **`NEXT_PUBLIC_FRAME_URL`** to the Markit deployment origin, e.g. `https://your-markit.vercel.app`.

This value is used to:

- Build `frameLaunchUrl` in `GET /api/content/vault/[id]/frame-session`
- CORS for Frame/Markit origins on relevant API routes

## End-to-end test

1. Deploy Markit; set `NEXT_PUBLIC_FRAME_URL` on Creatix; redeploy Creatix.
2. Sign in on Circe et Venus → **AI Studio** → **Media & vault** → open a video → **Edit in Markit** (or equivalent).
3. Confirm Markit loads with video; run **Trim & upload** or **Upload edited file**.
4. Optional: after upload, **Embed marker** with a recipient key (Ariadne credits apply on Creatix).
