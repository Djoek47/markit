# Roadmap — Markit

## Done (v0)

- Vault bridge (`importUrl`, `exportUrl`, `exportToken`)
- Server proxies: export (`FRAME_EXPORT_SECRET`), AI Assist (Creatix `/api/frame/ai/assist`), Ariadne embed proxy
- In-browser trim via ffmpeg.wasm → upload to vault
- Markit Assist presets + chat
- Optional Ariadne append-v1 embed after vault upload

## Phase B — multi-clip timeline

**Goal:** multiple segments on a timeline, basic transitions, single export.

**Options:**

1. **Remotion** — `@remotion/player` + composition state; export pipeline still likely needs ffmpeg or server render (evaluate bundle size and Vercel limits).
2. **Custom timeline** — clip list + in/out per clip; concat with ffmpeg.wasm filter graph or sequential encode (heavier client work).

**Prerequisite:** define project format (JSON: tracks, clips, transitions) and keep vault export contract unchanged.

## Phase C — deeper Ariadne

Current MVP uses append-v1 at end of file. Surviving aggressive re-encode is a separate R&D track (signal-level / robust watermarking), not bundled into Markit v0.
