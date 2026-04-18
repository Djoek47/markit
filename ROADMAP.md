# Roadmap — Markit

**Ecosystem plan (phases 0–6, exit criteria):** in the Creatix repo, [`docs/MARKIT_MASTER_PLAN.md`](https://github.com/Djoek47/Creatix/blob/main/docs/MARKIT_MASTER_PLAN.md) (or `../Creatix/docs/MARKIT_MASTER_PLAN.md` if both clones sit side by side).

## Done (v0)

- Vault bridge (`importUrl`, `exportUrl`, `exportToken`)
- Server proxies: export (`FRAME_EXPORT_SECRET`), AI Assist (Creatix `/api/frame/ai/assist`), Ariadne embed proxy
- In-browser trim via ffmpeg.wasm → upload to vault
- Markit Assist presets + chat
- Optional Ariadne append-v1 embed after vault upload

## Phase B — AI → executable plan (in progress)

- **`markit-edit` JSON** (v1) from Frame Assist: `segments[]` with `startSec`/`endSec` (+ optional `secondary` source).
- **Browser executor:** `trimVideoToMp4` per segment → `concatMp4Blobs` → upload to primary vault.
- **Dual angle:** optional query `importUrl2` (second asset proxy URL from another `frame-session`).
- **Not yet:** side-by-side two-up layout, crossfades, server-side renders, transcript-based auto-cuts (needs ASR + alignment job).

## Phase C — multi-clip timeline UI

**Shipped (v1):** `lib/timeline-project.ts` (storage per `contentId`), clip list + mini strip in footer, reorder, A/B cam when `importUrl2`, **Export clip list** → same `executeEditPlan` / `runMarkitEditPlan` path as AI builds.

**Next:** drag trim handles on strip, transitions, optional Remotion or worker export.

**Prerequisite:** extend project format (transitions); keep vault export contract.

## Phase D — deeper Ariadne

Current MVP uses append-v1 at end of file. Surviving aggressive re-encode is a separate R&D track (signal-level / robust watermarking), not bundled into Markit v0.
