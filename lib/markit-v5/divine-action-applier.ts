import type { EditorDivineUiAction } from './divine-editor-actions'
import { useEditorShellStore } from '@/lib/stores/editor-shell-store'
import {
  splitSegmentAtSec,
  updateSegment,
  removeSegment,
  moveSegment,
  patchSegment,
  rectForAspect,
} from '@/lib/timeline-project'
import type { TimelineSegment } from '@/lib/timeline-project'

type InspectorTab = 'clip' | 'crop' | 'trim' | 'export' | 'trace'

export type DivineApplierContext = {
  setInspectorTab: (t: InspectorTab) => void
  /**
   * Required for timeline editing actions.
   * The applier calls `setSegments(next)` with the new segment array and
   * `setCropRect(rect)` when a crop profile is applied.
   */
  segments?: TimelineSegment[]
  setSegments?: (next: TimelineSegment[]) => void
  setCropRect?: (rect: { x: number; y: number; width: number; height: number }) => void
  /** Source video duration — used to clamp split/trim. */
  durationSec?: number
}

/**
 * Apply a Divine action.
 *
 * - UI / nav actions → mutate the Zustand editor-shell store immediately.
 * - Timeline editing actions → call `ctx.setSegments` / `ctx.setCropRect`
 *   (these should already have been pulled out of the pending queue first).
 *
 * Call `applyDivineSideEffects` after this for any React state updates.
 */
export function applyEditorDivineAction(
  _state: unknown,
  action: EditorDivineUiAction,
  ctx: DivineApplierContext,
): void {
  const store = useEditorShellStore.getState()

  switch (action.type) {
    // ── UI / nav ────────────────────────────────────────────────────────────
    case 'seek_playhead':
      store.requestSeek(action.sec)
      return

    case 'set_density':
      store.setDensity(action.density)
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.density = action.density
      }
      return

    case 'set_media_context':
      store.setMediaContext(action.context)
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.mediaContext = action.context
      }
      return

    case 'focus_inspector':
      ctx.setInspectorTab(action.tab)
      return

    case 'noop':
      return

    // ── Timeline editing ────────────────────────────────────────────────────
    case 'split_segment': {
      const segs = ctx.segments
      if (!segs || !ctx.setSegments) return
      const splitAtSec = action.splitAtSec
      let targetId = action.segmentId
      if (!targetId) {
        // Find the segment whose window contains splitAtSec
        const found = segs.find((s) => s.startSec <= splitAtSec && splitAtSec < s.endSec)
        targetId = found?.id
      }
      if (!targetId) return
      ctx.setSegments(splitSegmentAtSec(segs, targetId, splitAtSec))
      return
    }

    case 'trim_segment': {
      const segs = ctx.segments
      if (!segs || !ctx.setSegments) return
      const patch: Partial<Pick<TimelineSegment, 'startSec' | 'endSec'>> = {}
      if (action.startSec !== undefined) patch.startSec = action.startSec
      if (action.endSec !== undefined) patch.endSec = action.endSec
      ctx.setSegments(updateSegment(segs, action.segmentId, patch))
      return
    }

    case 'remove_segment': {
      const segs = ctx.segments
      if (!segs || !ctx.setSegments) return
      ctx.setSegments(removeSegment(segs, action.segmentId))
      return
    }

    case 'reorder_segment': {
      const segs = ctx.segments
      if (!segs || !ctx.setSegments) return
      const fromIdx = segs.findIndex((s) => s.id === action.segmentId)
      if (fromIdx < 0) return
      const dir = action.toIndex > fromIdx ? 1 : -1
      let current = segs
      let cursor = fromIdx
      const target = Math.max(0, Math.min(action.toIndex, segs.length - 1))
      while (cursor !== target) {
        current = moveSegment(current, cursor, dir as 1 | -1)
        cursor += dir
      }
      ctx.setSegments(current)
      return
    }

    case 'set_crop_profile': {
      if (!ctx.setCropRect) return
      ctx.setCropRect(rectForAspect(action.profile))
      return
    }

    case 'set_segment_speed': {
      const segs = ctx.segments
      if (!segs || !ctx.setSegments) return
      ctx.setSegments(patchSegment(segs, action.segmentId, { speedPct: action.speedPct }))
      return
    }

    case 'set_segment_fade': {
      const segs = ctx.segments
      if (!segs || !ctx.setSegments) return
      const fadePatch: Parameters<typeof patchSegment>[2] = {}
      if (action.fadeInMs !== undefined) fadePatch.fadeInMs = action.fadeInMs
      if (action.fadeOutMs !== undefined) fadePatch.fadeOutMs = action.fadeOutMs
      ctx.setSegments(patchSegment(segs, action.segmentId, fadePatch))
      return
    }

    default:
      return
  }
}

/** Map Markit v2 tab setter to a minimal prop bag for tests / Storybook. */
export function makeDivineApplierContext(
  setTab: (t: InspectorTab) => void,
  opts?: Partial<Omit<DivineApplierContext, 'setInspectorTab'>>,
): DivineApplierContext {
  return { setInspectorTab: setTab, ...opts }
}

export type { InspectorTab }
