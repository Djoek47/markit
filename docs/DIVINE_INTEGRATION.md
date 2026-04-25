# Divine integration

## Realtime voice (existing)

`hooks/use-markit-divine-voice.ts` opens a WebRTC session to OpenAI Realtime via Creatix `POST /api/ai/divine-manager-realtime`, forwarded through Markit `POST /api/creatix/divine-manager-realtime` so the browser never sends cookies cross-origin.

## Action stream + context (Creatix)

Upstream routes on Creatix:

- **`GET /api/divine/action-stream`** — SSE with `connected`, `heartbeat`, `divine_action` (`{ action: ... }`).
- **`POST /api/divine/register-context`** — JSON stored per user (`lib/divine/markit-divine-bridge.ts` on Creatix).

**Markit app** calls same-origin proxies only (no cross-origin browser requests to circeetvenus.com):

- **`GET /api/creatix/divine-action-stream`** → forwards with session → Creatix.
- **`POST /api/creatix/divine-register-context`** → same.

So you do **not** need `NEXT_PUBLIC_MARKIT_URL` on Creatix for these two flows. Direct browser calls to Creatix still need CORS (see below).

Context registration runs on a debounced timer from `components/editor-app.tsx`; the stream is consumed in `hooks/use-divine-action-stream.ts`. Suggestions are approval-gated in `components/studio/markit-editor-v2.tsx`.

## CORS (optional)

Only needed if something calls Creatix divine APIs **from the browser** on another origin. Set `NEXT_PUBLIC_MARKIT_URL` on Creatix (comma-separated allowed in `lib/cors-markit.ts` if you extend it).

## End-to-end smoke (test enqueue)

Actions only appear in the stream after something **enqueues** them (`enqueueMarkitDivineAction` on Creatix).

1. Set the **same** secret on **Markit** and **Creatix**: `DIVINE_TEST_ENQUEUE_SECRET` (strong random string).
2. Sign in to Markit and open the editor (so `useDivineActionStream` is active).
3. From the browser console (same origin as Markit):

```js
fetch('/api/creatix/divine-test-enqueue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ type: 'set_density', density: 'pro' }),
}).then((r) => r.json()).then(console.log)
```

Within a few seconds the **Divine suggestion** bar should appear (Apply / Dismiss).  
**Direct Creatix** (optional): `POST /api/divine/test-enqueue` with `Authorization: Bearer`, `Content-Type: application/json`, and header `x-divine-test-secret` when `DIVINE_TEST_ENQUEUE_SECRET` is set; in **development** only, the secret may be omitted if the env var is unset.

Creatix route: `app/api/divine/test-enqueue/route.ts`. Markit proxy: `app/api/creatix/divine-test-enqueue/route.ts`.
