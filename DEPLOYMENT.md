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

Set **`NEXT_PUBLIC_FRAME_URL`** to the Markit deployment origin (exact URL, no path), e.g. `https://your-markit.vercel.app`. Use **comma-separated** values if you have multiple (preview + production).

This value is used to:

- Build `frameLaunchUrl` in `GET /api/content/vault/[id]/frame-session`
- **CORS** on Creatix `POST /api/content/vault/[id]/frame-export` — required so the browser can upload trimmed/edited videos **directly to Creatix** (large files would hit Vercel’s ~4.5MB limit if proxied through Markit).

Vault uploads from Markit use the signed **`exportToken`** (HMAC); `FRAME_EXPORT_SECRET` is not sent from the browser.

**If uploads fail with CORS:** the Markit tab’s origin must appear exactly in `NEXT_PUBLIC_FRAME_URL` (scheme + host, no trailing slash).

### Dual camera / second angle (`importUrl2`)

Markit can load a **second** vault video for multi-angle cuts (Assist plans with `"source":"secondary"` segments, or the timeline when mixing angles).

1. Open **two** vault items that have video, in two tabs (or note both content IDs).
2. For each item, call **`GET /api/content/vault/[id]/frame-session`** (from the Circe et Venus UI this is what backs **Edit in Markit**). Copy each response’s **`assetProxyUrl`** (the signed `…/asset?t=…` URL).
3. Build Markit’s URL with the **primary** bridge as usual (`importUrl`, `exportUrl`, `exportToken` from the item you will **upload exports to**). Add a query param:  
   **`importUrl2=<URL-encoded second assetProxyUrl>`**  
   Example: `https://markit.example.com/?importUrl=…&exportUrl=…&exportToken=…&importUrl2=…`
4. **`NEXT_PUBLIC_FRAME_URL`** must still list your Markit origin so both `importUrl` and `importUrl2` requests succeed (CORS on Creatix `asset`).

Exports always go to the **primary** item’s `exportUrl` / `exportToken`. The second file is only a source for trims.

## End-to-end test

1. Deploy Markit; set `NEXT_PUBLIC_FRAME_URL` on Creatix; redeploy Creatix.
2. Sign in on Circe et Venus → **AI Studio** → **Media & vault** → open a video → **Edit in Markit** (or equivalent).
3. Confirm Markit loads with video; run **Trim & upload** or **Upload edited file**.
4. Optional: after upload, **Embed marker** with a recipient key (Ariadne credits apply on Creatix).
