# Markit architecture (V5)

Markit is a single Next.js App Router application (port 3020 in dev). Marketing pages, auth, and the studio editor share OKLch design tokens in `app/globals.css` and fonts from `app/layout.tsx`.

## Data flow

- **Vault bridge:** When opened from Circe et Venus with `importUrl`, `exportUrl`, and `exportToken`, the editor POSTs rendered files directly to Creatix vault export endpoints (large bodies avoid Markit proxy limits).
- **Ariadne:** Embed and detect calls use the shared M2M signing contract in `lib/ariadne/creatix-signing.ts`, matching Creatix `lib/ariadne/service-auth.ts`.
- **Divine:** Premium Realtime voice uses Markit API proxies under `app/api/creatix/*` with `Authorization: Bearer` from the shared Supabase session. Server-pushed editor actions use Creatix `GET /api/divine/action-stream` (fetch + SSE parsing) with the same Bearer token.

## Lazy modules

- **ffmpeg.wasm:** Heavy work is loaded from `lib/ffmpeg-trim.ts` and the thin entry `lib/ffmpeg/trim-preview.ts` so the main editor chunk stays small.
