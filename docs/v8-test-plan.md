# Markit v8 — manual end-to-end test + polish list

**Run this before every release.** Paired with `MARKIT_REALITY_MEMO.md` in the workspace root, this is the operational ground truth as of Day 4.

State after Day 4: 79 vitest cases green, tsc clean, eslint clean. Trace embed + detect both wired through real Creatix M2M-signed routes. Build is bridge-mode-only (no standalone uploads yet).

---

## 1. Pre-flight checklist

Verify before starting the test pass — all are blockers.

### Markit env (`.env.local` for dev, Vercel env for staging/prod)

| Var | Purpose | How to set |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase project as Creatix | Copy from Creatix env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase key | Same |
| `NEXT_PUBLIC_CREATIX_APP_URL` | Creatix base URL | `https://www.circeetvenus.com` (prod) or staging URL |
| `NEXT_PUBLIC_MARKIT_APP_URL` | Markit's own URL, no trailing slash | e.g. `https://markit.app` |
| `MARKIT_ARIADNE_SHARED_SECRET` | M2M shared secret, ≥16 chars | **Must match Creatix's value exactly.** Get from whoever manages Creatix prod env |
| `CREATIX_ACTOR_USER_ID` | Creator's Supabase `profiles.id` | The user UUID for whom Markit acts |
| `FRAME_EXPORT_SECRET` | Vault upload service secret | Same as Creatix's `FRAME_EXPORT_SECRET` |

### Creatix env to confirm with Creatix maintainer
- `MARKIT_ARIADNE_SHARED_SECRET` is identical to Markit's
- `NEXT_PUBLIC_MARKIT_URL` includes Markit's origin so CORS doesn't block proxied calls
- Markit Ariadne service mode flag is enabled (Creatix `lib/ariadne/feature-flags.ts` → `isMarkitAriadneServiceModeEnabled`)

### Test fixtures
- `creator-test@<your-domain>` — a Creatix account with at least one published video and a paid plan (or service-mode billing enabled)
- A 30-second mp4 in vault (preferably 1080p H.264) — note its `contentId`
- Three test recipient labels: `alice_test`, `bob_test`, `charlie_test`

### Sanity-test the wiring before manual flow
```bash
cd markit
npm install --no-audit --no-fund
npx vitest run            # expect 79 passing
npx tsc --noEmit          # expect no output
```

If anything above fails, **stop and fix before running the manual flow.**

---

## 2. Manual end-to-end test (target: under 8 minutes)

Pick a clean browser (no localStorage state from previous runs). Open Markit at your staging URL.

### Phase 1 — Bridge launch (1 min)

1. From the Creatix vault, click "Open in Markit" on `test-video-30s.mp4`. This redirects to Markit with `?importUrl=…&exportUrl=…&exportToken=…&contentId=…` in the URL.
2. **Verify**: editor loads, the video preview shows the source clip in `MarkitEditorV2`, the timeline shows one V1 segment for the source.

### Phase 2 — Edit timeline (Days 1–2, 2 min)

1. Click the V1 clip to select it. Move the playhead to ~5 seconds.
2. Click the **Split** button in the toolbar.
   - **Verify**: clip becomes two segments at the playhead; both still on V1; the right half has a `(B)` suffix on its label; total clip count = 2.
3. Hover the right segment, drag its **left edge** rightward by ~1 second.
   - **Verify**: the left edge moves; the segment shrinks; the playhead doesn't jump.
4. Switch the right inspector to the **Crop** tab. Click the **9:16** chip.
   - **Verify**: the chip shows active (gold border), the X / Y / W / H sliders update to a centered vertical rect (`width ≈ 0.316`, `height = 1.0`).
5. Click **1:1**. Verify a centered square (`width ≈ 0.5625`, `height = 1.0`).
6. Click **Original** chip. Verify full frame restored.
7. With a V1 clip still selected, switch to the **Clip** tab. Drag **Speed** to 200%.
   - **Verify**: label shows "Speed 200%", the slider position holds.
8. Drag **Fade** to 1500ms.
   - **Verify**: label shows "Fade 1500ms", state holds.

### Phase 3 — Trace embed (Day 3, 2 min)

1. Click **Send source to vault** in the toolbar (or the equivalent vault-export button — depends on the current toolbar state). Wait for the success status.
2. Switch the inspector to the **Trace** tab.
3. Type `alice_test` in the recipient input.
4. Click **Embed Ariadne marker**.
   - **Verify**: spinner / "Embedding…" status, then within 4–8 seconds the message updates to **"Traced copy ready (append-v1). Download below or share the link with alice_test."**
   - **Verify**: a gold **Download traced copy** button appears, plus a **Copy link** button and a `payload <8-char>` chip.
5. Click **Download traced copy**.
   - **Verify**: a file downloads with `ariadne-<payloadId>.mp4` in its name. Open it — it plays cleanly. Visually identical to the source (append-v1 modifies only post-EOF bytes).
6. Repeat steps 3–5 for `bob_test`, then `charlie_test`. You should now have three traced files, three different `payload_id` values.

### Phase 4 — Detect / verification (Day 4, 1 min)

1. Still on the Trace tab. Drag bob's downloaded mp4 from your file system into the **Verify a leak** drop zone (or use the file picker if drag-drop isn't behaving).
   - **Verify**: spinner / "Verifying…" status, then within 2–4 seconds the verdict shows: **"Sent to bob_test (97% confidence)"** rendered as a gold pill.
2. Drop alice's file. Verdict: **"Sent to alice_test (97% confidence)"**.
3. Take a screenshot of one frame of bob's video using OS native screenshot. Save as PNG. Drop it.
   - **Expected outcome with append-v1**: `"No Ariadne marker found in this file."` This is documented behavior — append-v1 is post-EOF bytes, so a screenshot strips it. Do not flag this as a bug; it's the v1 caveat. v2 will fix.
4. Convert bob's mp4 to a different format (e.g. `ffmpeg -i bob.mp4 -c:v libx264 bob-reencoded.mp4`). Drop the re-encoded file.
   - **Expected outcome with append-v1**: `"No Ariadne marker found in this file."` Same caveat — re-encoding strips post-EOF bytes.
5. Drop the original source video (un-traced).
   - **Verify**: `"No Ariadne marker found in this file."`
6. Drop a totally unrelated mp4 (any stock clip).
   - **Verify**: `"No Ariadne marker found in this file."`

### Phase 5 — Cross-recipient isolation (1 min)

This is the one that has to work for the product to mean anything.

1. Drop alice's file. Verdict: `Sent to alice_test`.
2. Drop bob's file. Verdict: `Sent to bob_test`.
3. Drop charlie's file. Verdict: `Sent to charlie_test`.

If any of those mis-identifies, **STOP** — the isolation is broken. That's a launch blocker.

### Phase 6 — Error paths (1 min)

1. Disconnect from the internet. Hit Embed.
   - **Verify**: an error message appears in the inspector. The Download button does not appear. State is recoverable (reconnect, retry → succeeds).
2. Reconnect. Type a recipient. Hit Embed twice fast (double-click).
   - **Verify**: only one trace embed runs (button is disabled while busy). Two download buttons should NOT appear.
3. Drop an empty/invalid file in Verify.
   - **Verify**: error verdict ("Verification failed: …" or HTTP 400 surfaces cleanly) — no app crash.

---

## 3. Append-v1 caveat — documentation surface

**For each launch creator**, this caveat must be communicated. Where it should appear:

- **Inline in the Trace tab** (small muted text below the Embed button): *"v1 trace survives direct file shares and most platform re-uploads. Does not survive re-encoding or screenshots."*
- **In your launch help center** under "How does the trace work": "We currently use append-v1 marking. Re-encoded leaks will not be traceable until we ship v2 (in development). For now, leaks via direct file copy or platform re-upload are traceable; leaks via re-encoded copies or screenshots are not."
- **In the welcome / onboarding flow** if the creator's first action is creating a trace: a one-line modal or tooltip with the same wording.

We can ship without this surface, but support volume will spike when creators screenshot a frame and report "trace doesn't work." Better to set the expectation up front.

---

## 4. Polish tickets (defer to v1.1 unless flagged 🚨)

Things noticed during Days 1–4 that don't block launch but should be on the post-launch list.

### UI/UX polish
- **🚨 Add the append-v1 caveat copy** to the Trace tab UI per §3 above. ~15 min of work, ship before launch.
- **Unify the two-step flow** ("Send to vault" then "Embed marker") into a single **Sign & Download** button that does both atomically. Trade-off: loses the ability to edit between vault-export and trace, but that's a rare workflow. ~1 day.
- **Verify dropzone polish**: support drag-and-drop visually (currently it works but doesn't show drop-target hover state). ~30 min.
- **Crop redundancy**: now that aspect chips work, the X/Y/W/H sliders are redundant unless the user wants a non-standard crop. Consider hiding sliders behind an "Advanced" toggle. ~30 min.
- **Snap toolbar button** is still dead (only Split was wired). Either implement snap-to-playhead/segment-edge or remove the button. ~1 hour.
- **`/editor/simple` vs `/editor/pro` mode toggle** in the editor header — unclear differentiation today. Either spec what's hidden in Simple, or collapse to one mode. Decision needed.

### Code-quality / correctness
- **`verifyVerdict` is typed as `string | null`** (`components/editor-app.tsx`) instead of structured `DetectVerdict | null`. Currently uses brittle `startsWith('Sent to ')` to detect the identified case for styling. Refactor to store the structured verdict, render based on `kind`. ~20 min.
- **`detect-interpret.ts` "registered but no recipient label" case** returns `identified` with label `'unknown'`. Defensive against a Creatix bug that shouldn't happen. Should fall through to `candidate` or `error` instead. ~10 min + test update.
- **`detect-proxy/route.ts`** comment claims streaming but uses `req.formData()` which buffers. Either fix the comment or implement true streaming via `req.body` passthrough. Cosmetic. ~10 min.
- **Pre-existing lint errors in `hooks/use-markit-divine-voice.ts`** (`react-hooks/refs`, line 391 + line 28-29). Will block CI if your eslint config is strict. Independent of v8 work; touch when convenient.
- **`lib/forensics/*` is dead code** (duplicate of Creatix's watermark engine). Delete in a future cleanup pass to reduce confusion. ~10 min.

### Operational / launch-prep
- **Add a `/healthz` endpoint** that returns `{ ok: true, contractVersion: 'v1.1', commit: <git-sha> }`. Used for staging smoke tests and uptime monitoring. ~15 min.
- **Sentry + PostHog wiring** (Day 9). Make sure both have no-op fallbacks so missing env vars don't crash anything.
- **Rate limit `/api/ariadne-proxy` and `/api/ariadne/detect-proxy`** at the Markit edge — say 60 calls/hour per Authorization-Bearer-token. The Creatix side already rate-limits but Markit-edge limits prevent runaway costs from a buggy client. ~1 hour.
- **Privacy / ToS / age verification gate on signup** — you write these, not me. Required before launch.
- **Status page** at `status.markit.app` (Better Stack free tier). ~30 min setup.

### Documentation
- **Architecture doc** in `docs/architecture.md` describing the bridge-mode flow, the M2M signing wire format, and the detect verdict types. Referenced by future agent briefs. ~30 min.
- **`AGENTS.md`** in repo root: the Next.js 16 / React 19 reminder is good but should add a pointer to `MARKIT_REALITY_MEMO.md` and `OPERATING_MODEL.md` so future spawn-and-go agents don't accidentally rebuild against the playbook fictions.

---

## 5. Day 6 readiness gate

Before starting Day 6 (voice loop):

1. ✅ This test plan runs end-to-end with no failures (or only documented append-v1 caveats)
2. ✅ The 🚨 polish items in §4 are done (append-v1 caveat surfaced)
3. ✅ At least one human creator has used the trace flow without help — a real human, not just you
4. ✅ Creatix-side maintainer has signed off on the M2M traffic patterns being correct in their logs
5. ✅ Decision recorded: voice loop in v1, or v1.1?

Day 6 spec (preview, not yet active): Anthropic + OpenAI clients, `/api/voice/intent` route, `/api/voice/tts` route, extend divine action set from 5 ghost actions to ~12 real ones, hook the existing OpenAI Realtime voice into the editor's pending divine queue. Estimated 2 days of Haiku + 1 day Opus review. Total ~3 days.

If Day 6 is descoped to v1.1, Day 5 is the entire path to launch — manual test → fix what breaks → polish list → ship.

---

## 6. Quick reference: known caveats by component

| Layer | Caveat | Plan |
|---|---|---|
| Watermark | append-v1 doesn't survive re-encode or screenshot | v1.1: Creatix builds ffmpeg v2 worker (algorithm + table exist) |
| Render | Browser ffmpeg.wasm caps ~60s clips at 1080p | v1.1: server-side render via Vercel function or Modal |
| Mode | Bridge-only — must come from Creatix vault | v1.1: standalone Markit signup + own uploads |
| Voice | OpenAI Realtime requires premium plan; 5 ghost actions only | Day 6 (or v1.1) |
| Leak alerts | Markit polls Creatix `/api/leaks/alerts`; no Realtime push | v1.1: Creatix adds `markit:leak-alerts:{userId}` channel |
| Billing | All trace ops debit Creatix AI credits via M2M | Stripe per-trace metering is a v1.1 standalone-mode feature |

If a creator asks "why doesn't X work?" and X is on this table, the answer is in the right column.
