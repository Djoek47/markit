# OpenReel × Markit v8 — Integration Execution Plan

> **For any agent picking this up cold:** read this file top to bottom before writing a single line of code.
> Execute steps in order. Each step ends with `npm test && npx tsc --noEmit`. Do not proceed if either fails.

---

## Context

Two branches need to be unified:

| Branch | What it has |
|--------|------------|
| `claude/awesome-mclaren-aeac45` | Markit v8 — divine queue, voice, Ariadne trace, brand, DB, upload pipeline, library, leak monitor, DMCA |
| `codex/standalone-editor-local-import` | OpenReel vendored editor — real ffmpeg export, multi-track timeline, AI reframe, audio effects, vault bridge |

**Goal:** merge both into one branch where OpenReel is the primary editor engine and all v8 Markit systems (divine/voice/trace/brand/library/leaks) are wired into it.

**Working branch:** `claude/awesome-mclaren-aeac45`
**Worktree path:** `C:\Users\Ben Beckman\Documents\Circe et Venus\markit\.claude\worktrees\awesome-mclaren-aeac45`
**Test command:** `node "C:\Users\Ben Beckman\Documents\Circe et Venus\markit\node_modules\vitest\vitest.mjs" run`
**Current tests:** 369 passing — do not regress this number.

---

## Architecture decision (follow this, do not re-debate)

- **OpenReel** is the primary editor engine (real render, multi-track, AI)
- **MarkitEditorV2** is kept as the bridge-mode fallback only (`?mode=markit` query param)
- **All v8 systems** are wired into OpenReel via an adapter layer in `components/openreel/`
- **Never edit files inside `vendor/openreel/`** — patches go in adapter components
- The OpenReel `project-store` is the source of truth for timeline state
- Divine actions translate to OpenReel `action-executor` calls via a new `lib/openreel-divine-adapter.ts`

---

## Step 1 — Merge the branches

**What:** Bring `codex/standalone-editor-local-import` into `claude/awesome-mclaren-aeac45`.

```bash
cd <worktree-path>
git fetch origin
git merge origin/codex/standalone-editor-local-import --no-commit --no-ff
```

**Conflicts to expect and how to resolve:**

| File | Resolution |
|------|-----------|
| `app/editor/page.tsx` | Keep OpenReel as default; add `?mode=markit` fallback (see Step 2) |
| `app/globals.css` | Keep v8 version (has OKLch tokens + light mode). Append any OpenReel-specific CSS classes at the bottom. Do NOT overwrite the `:root` token block. |
| `components/editor-app.tsx` | Keep v8 version. OpenReel gets its own entry via `openreel-editor-client.tsx`. |
| `hooks/use-markit-divine-voice.ts` | Keep v8 version (codex removed 3 lines — check if intentional with `git diff`). |
| `vitest.config.ts` | Keep `.mts` extension version from v8. If codex added a `.ts` version, delete it — Windows ESM fix requires `.mts`. |
| `package.json` | Merge both dependency lists. Keep v8 scripts. |
| `tsconfig.json` | Keep v8 version; merge any path aliases codex added for `@openreel/core`. |
| `next.config.ts` | Merge: keep v8 config, add codex's webpack aliases for OpenReel worker files. |

After resolving all conflicts:
```bash
git add .
npm install  # installs new OpenReel deps
node "...vitest.mjs" run  # must be 369+ passing
npx tsc --noEmit           # must be clean
git commit -m "feat: merge OpenReel editor into v8 branch"
```

---

## Step 2 — Route switcher in editor page

**File:** `app/editor/page.tsx`

**What:** Read a `?mode=` query param. Default to OpenReel; `?mode=markit` loads MarkitEditorV2 (bridge fallback).

```tsx
import { OpenReelEditorLoader } from '@/components/openreel/openreel-editor-loader'
import { EditorApp } from '@/components/editor-app'

// Next 16: searchParams is async
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode } = await searchParams
  if (mode === 'markit') return <EditorApp />
  return <OpenReelEditorLoader />
}
```

**Test:** visit `/editor` → OpenReel loads. Visit `/editor?mode=markit` → MarkitEditorV2 loads.

---

## Step 3 — Auth gate OpenReel

**File:** `components/openreel/openreel-editor-loader.tsx`

**What:** Add Supabase session check before rendering. Redirect to `/sign-in` if no session.

```tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function OpenReelEditorLoader() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [EditorClient, setEditorClient] = useState(...)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/sign-in?next=/editor')
        return
      }
      setReady(true)
      // existing dynamic import...
    })
  }, [router])

  if (!ready) return <LoadingScreen />
  // existing render...
}
```

---

## Step 4 — Verify vault bridge still works

**File:** `components/openreel/openreel-editor-client.tsx` (already written by Codex)

**What:** The bridge reads `?importUrl=&exportUrl=&exportToken=` from the URL, imports the video into OpenReel, and exports back to vault. After the merge, confirm this still compiles and the types are correct.

Run:
```bash
npx tsc --noEmit
```

If `getExportEngine` import fails, check `next.config.ts` has the `@openreel/core` webpack alias from the codex branch.

No code changes needed if tsc is clean.

---

## Step 5 — Divine → OpenReel adapter

**New file:** `lib/openreel-divine-adapter.ts`

**What:** Map `EditorDivineUiAction` types to OpenReel `action-executor` calls. This is the core integration piece.

```typescript
import type { EditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'
import { getActionExecutor } from '@/vendor/openreel/core/actions/action-executor'
import { useProjectStore } from '@/vendor/openreel/web/stores/project-store'

/**
 * Translates a Markit divine action into an OpenReel action-executor call.
 * Returns true if the action was handled, false if it falls through to MarkitEditorV2 applier.
 */
export function applyDivineActionToOpenReel(action: EditorDivineUiAction): boolean {
  const executor = getActionExecutor()
  const { project } = useProjectStore.getState()
  if (!executor || !project) return false

  switch (action.type) {
    case 'split_segment': {
      // Find the clip at splitAtSec, call executor.execute({ type: 'split-clip', ... })
      // OpenReel action schema: check vendor/openreel/core/actions/action-validator.ts
      return true
    }
    case 'trim_segment': {
      return true
    }
    case 'remove_segment': {
      return true
    }
    case 'set_segment_speed': {
      return true
    }
    case 'set_crop_profile':
    case 'crop_to_aspect': {
      return true
    }
    case 'set_segment_fade': {
      return true
    }
    // Nav actions — handled by editor-shell-store, not OpenReel
    default:
      return false
  }
}
```

**How to find the right OpenReel action types:**
- Read `vendor/openreel/core/actions/action-validator.ts` — every valid action shape is validated there
- Read `vendor/openreel/core/actions/action-executor.ts` — `execute()` method accepts those shapes
- Match on `type` string (OpenReel uses kebab-case like `'split-clip'`, `'trim-clip'`, `'set-speed'`)

**Write tests** in `lib/openreel-divine-adapter.test.ts` — mock `useProjectStore` and `getActionExecutor`, verify each action type calls executor with correct shape.

---

## Step 6 — Voice mic in OpenReel UI

**What:** Mount `VoiceMicButton` from `components/brand/` inside the OpenReel toolbar. Wire it to the existing `useMarkitDivineVoice` hook.

**File:** `components/openreel/openreel-voice-overlay.tsx` (new file)

```tsx
'use client'
import { VoiceMicButton } from '@/components/brand'
import { useMarkitDivineVoice } from '@/hooks/use-markit-divine-voice'
import { useProjectStore } from '@/vendor/openreel/web/stores/project-store'

export function OpenReelVoiceOverlay() {
  const project = useProjectStore((s) => s.project)
  const segments = project?.clips ?? []

  const { isListening, isProcessing, toggleListening } = useMarkitDivineVoice({
    voiceIntentContext: {
      segmentCount: segments.length,
      segments: segments.slice(0, 12).map((c, i) => ({
        id: c.id,
        startSec: c.startTime / 1000,
        endSec: (c.startTime + c.duration) / 1000,
        label: c.name ?? `Clip ${i + 1}`,
      })),
    },
  })

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 24, zIndex: 200 }}>
      <VoiceMicButton
        isListening={isListening}
        isProcessing={isProcessing}
        onClick={toggleListening}
        size="lg"
      />
    </div>
  )
}
```

Mount `<OpenReelVoiceOverlay />` inside `openreel-editor-client.tsx` alongside `<OpenReelApp />`.

> **Note on OpenReel project schema:** OpenReel clips use milliseconds (`startTime`, `duration`). Markit uses seconds. Always convert: `ms / 1000` ↔ `sec * 1000`.

---

## Step 7 — Post-export trace hook

**File:** `components/openreel/openreel-editor-client.tsx`

**What:** After `exportProjectToBlob()` resolves with the rendered file, run the sign-upload → finalize → trace flow.

Codex's existing export code ends with sending the blob back to the Creatix vault. Add a hook point BEFORE the vault send:

```typescript
// After: const blob = await exportProjectToBlob(settings, onProgress)
// Add:
if (traceRecipient) {
  const traceResult = await runMarkitTraceFlow(blob, traceRecipient)
  // traceResult.downloadUrl replaces the original blob URL for vault send
}
```

**New file:** `lib/openreel-trace-flow.ts`

```typescript
export async function runMarkitTraceFlow(
  renderedBlob: Blob,
  recipientLabel: string,
): Promise<{ downloadUrl: string; payloadId: string }> {
  // 1. sign-upload
  const sign = await fetch('/api/media/sign-upload', { ... }).then(r => r.json())
  // 2. PUT blob to sign.uploadUrl
  // 3. finalize
  await fetch('/api/media/finalize', { ... })
  // 4. trace/embed
  const embed = await fetch('/api/trace/embed', {
    method: 'POST',
    body: JSON.stringify({ uploadId: sign.mediaId, recipientLabel }),
  }).then(r => r.json())
  return { downloadUrl: embed.downloadUrl, payloadId: embed.payloadId }
}
```

The `recipientLabel` comes from the divine queue (`set_recipient` action) or the export panel UI.

---

## Step 8 — Brand overlay adapter

**What:** Read the user's `BrandSnapshot` from `/api/brand` and create an OpenReel overlay text/image layer.

**New file:** `lib/openreel-brand-adapter.ts`

```typescript
import type { BrandSnapshot } from '@/lib/brand-contract'
import { formatBrandHandle } from '@/lib/brand-contract'
import { useProjectStore } from '@/vendor/openreel/web/stores/project-store'

export function applyBrandToOpenReelProject(snapshot: BrandSnapshot): void {
  if (!snapshot.enabled) return
  const store = useProjectStore.getState()
  const handle = formatBrandHandle(snapshot)
  // Add a text overlay layer to every clip using OpenReel's project-store actions
  // Position maps: 'bottom-right' → { x: 0.85, y: 0.9 }, etc.
  // Opacity: snapshot.opacityPct / 100
  store.dispatch({ type: 'add-text-overlay', text: handle, ... })
}
```

Wire this into `openreel-editor-client.tsx` — call `applyBrandToOpenReelProject(brandSnapshot)` when the project loads and when brand settings change.

---

## Step 9 — Library → OpenReel media

**What:** When a user navigates from `/library?ids=m1,m2` to `/editor`, bootstrap the OpenReel project with those media items pre-loaded.

The URL will be `/editor?from=library&ids=m1,m2,m3` (set by the library's Create with AI button).

**File:** `components/openreel/openreel-editor-client.tsx`

```typescript
// On mount, read ?from=library&ids= params
const fromLibrary = searchParams.get('from') === 'library'
const mediaIds = searchParams.get('ids')?.split(',') ?? []

if (fromLibrary && mediaIds.length > 0) {
  // Fetch signed download URLs from /api/media/batch-urls
  // Load each into OpenReel project store as clips
}
```

**New route needed:** `GET /api/media/batch-urls?ids=m1,m2` — returns `{ id, signedUrl }[]` for the user's media items.

---

## Step 10 — Leak monitor + divine banner as overlays

**What:** The leak panel and divine queue confirm banner need to appear alongside OpenReel (which owns the full screen). Mount them as fixed-position overlays.

**File:** `components/openreel/openreel-editor-client.tsx`

```tsx
return (
  <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
    <OpenReelApp />

    {/* Divine queue banner — top of screen */}
    <DivineQueueBanner />

    {/* Voice mic — bottom right */}
    <OpenReelVoiceOverlay />

    {/* Leaks inspector — toggled via floating button */}
    {showLeaks && <LeaksPanel alerts={leakAlerts} ... />}
  </div>
)
```

`DivineQueueBanner` already exists in `components/studio/markit-editor-v2.tsx` — extract it into its own component `components/studio/divine-queue-banner.tsx` so both editors can use it.

---

## Step 11 — Upstream sync workflow

Codex added `scripts/sync-openreel.ts` and `.github/workflows/` for upstream sync. After the merge, verify the sync script runs:

```bash
npx tsx scripts/sync-openreel.ts --dry-run
```

Document any sync conflicts in `docs/openreel-sync.md` (already created by Codex).

---

## Step 12 — Tests

After each step above, add tests. Minimum coverage required:

| File | What to test |
|------|-------------|
| `lib/openreel-divine-adapter.test.ts` | Each action type calls executor with correct shape |
| `lib/openreel-trace-flow.test.ts` | sign → PUT → finalize → embed sequence, error paths |
| `lib/openreel-brand-adapter.test.ts` | Position mapping, opacity conversion, enabled=false no-ops |

**Test count target:** 420+ passing (currently 369).

---

## Step 13 — Final integration test

Run the full `docs/v8-test-plan.md` manual E2E with OpenReel as the engine:

- Phase 1: Bridge launch → OpenReel loads with vault video
- Phase 2: Edit timeline → split/trim in OpenReel, verify divine banner appears
- Phase 3: Trace embed → export from OpenReel → trace flow runs → download works
- Phase 4–6: Detect, cross-recipient isolation, error paths

---

## Execution order summary

```
Step 1  — Merge branches (git merge, resolve conflicts, npm install)
Step 2  — Route switcher (?mode=openreel default, ?mode=markit fallback)
Step 3  — Auth gate OpenReel loader
Step 4  — Verify vault bridge compiles
Step 5  — Divine → OpenReel adapter (lib/openreel-divine-adapter.ts)
Step 6  — Voice mic overlay (components/openreel/openreel-voice-overlay.tsx)
Step 7  — Post-export trace hook (lib/openreel-trace-flow.ts)
Step 8  — Brand overlay adapter (lib/openreel-brand-adapter.ts)
Step 9  — Library bootstrap (/api/media/batch-urls + editor client wiring)
Step 10 — Leak panel + divine banner as fixed overlays
Step 11 — Upstream sync script verification
Step 12 — Tests (420+ passing)
Step 13 — Manual E2E (human)
```

**After each step:** `npm test && npx tsc --noEmit` must pass before moving on.

**Commit after each step** with message format: `feat(openreel/stepN): <description>`

**Push after every commit:**
```bash
git push origin claude/awesome-mclaren-aeac45
```

---

## Key file reference

| File | Purpose |
|------|---------|
| `vendor/openreel/core/actions/action-validator.ts` | All valid OpenReel action shapes |
| `vendor/openreel/core/actions/action-executor.ts` | `execute()` method — call this for timeline mutations |
| `vendor/openreel/web/stores/project-store.ts` | Main state — clips, tracks, project |
| `vendor/openreel/web/App.tsx` | Root OpenReel component (do not edit) |
| `components/openreel/openreel-editor-client.tsx` | Integration entry point (edit here) |
| `components/openreel/openreel-editor-loader.tsx` | Dynamic import wrapper + auth gate |
| `lib/markit-v5/divine-editor-actions.ts` | All 29 divine action types |
| `lib/stores/divine-queue-store.ts` | Zustand queue — enqueue/confirm/dismiss |
| `hooks/use-markit-divine-voice.ts` | Voice hook — pass voiceIntentContext |
| `lib/brand-contract.ts` | BrandSnapshot type + formatBrandHandle |
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/route-handler.ts` | API route Supabase client |

---

## OpenReel unit: milliseconds. Markit unit: seconds. Always convert.

```typescript
// OpenReel → Markit
const startSec = clip.startTime / 1000

// Markit → OpenReel
const startMs = action.splitAtSec * 1000
```
