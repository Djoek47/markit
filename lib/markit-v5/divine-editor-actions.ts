import type { MediaContext } from '@/lib/stores/editor-shell-store'

// ─── UI / Navigation actions (applied immediately, no confirmation needed) ────

/** Seek the preview video to a specific second. */
export type DivineSeekPlayhead = { type: 'seek_playhead'; sec: number }

/** Switch between simple / pro editor density. */
export type DivineSetDensity = { type: 'set_density'; density: 'simple' | 'pro' }

/** Switch between video / image editing context. */
export type DivineSetMediaContext = { type: 'set_media_context'; context: MediaContext }

/** Focus a specific inspector tab. */
export type DivineFocusInspector = {
  type: 'focus_inspector'
  tab: 'clip' | 'crop' | 'trim' | 'export' | 'trace'
}

/** No-op (used when the model wants to acknowledge but not change anything). */
export type DivineNoop = { type: 'noop'; reason?: string }

// ─── Timeline editing actions (queued for user confirmation) ──────────────────

/**
 * Split a segment at the given absolute time on the timeline.
 * If `segmentId` is omitted the segment containing `splitAtSec` is targeted.
 */
export type DivineSplitSegment = {
  type: 'split_segment'
  segmentId?: string
  splitAtSec: number
}

/**
 * Adjust the in/out points of a segment.
 * Omitting `startSec` or `endSec` leaves that edge unchanged.
 */
export type DivineTrimSegment = {
  type: 'trim_segment'
  segmentId: string
  startSec?: number
  endSec?: number
}

/** Remove a segment from the timeline. */
export type DivineRemoveSegment = {
  type: 'remove_segment'
  segmentId: string
}

/** Move a segment to a new zero-based index in the timeline. */
export type DivineReorderSegment = {
  type: 'reorder_segment'
  segmentId: string
  toIndex: number
}

/**
 * Apply a crop / aspect-ratio preset to the whole timeline.
 * This updates the global `cropRect` in the editor shell.
 */
export type DivineSetCropProfile = {
  type: 'set_crop_profile'
  profile: '9:16' | '16:9' | '1:1' | '4:5' | '3:4' | 'original'
}

/** Set playback speed on a segment (25–400 %). */
export type DivineSetSegmentSpeed = {
  type: 'set_segment_speed'
  segmentId: string
  speedPct: number
}

/** Set fade-in and/or fade-out duration on a segment (0–5000 ms). */
export type DivineSetSegmentFade = {
  type: 'set_segment_fade'
  segmentId: string
  fadeInMs?: number
  fadeOutMs?: number
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type EditorDivineUiAction =
  // UI / nav (5 — applied immediately)
  | DivineSeekPlayhead
  | DivineSetDensity
  | DivineSetMediaContext
  | DivineFocusInspector
  | DivineNoop
  // Timeline editing (7 — queued for confirmation)
  | DivineSplitSegment
  | DivineTrimSegment
  | DivineRemoveSegment
  | DivineReorderSegment
  | DivineSetCropProfile
  | DivineSetSegmentSpeed
  | DivineSetSegmentFade

/** True for actions that mutate the timeline and must be confirmed before applying. */
export function isTimelineEditAction(
  action: EditorDivineUiAction,
): action is
  | DivineSplitSegment
  | DivineTrimSegment
  | DivineRemoveSegment
  | DivineReorderSegment
  | DivineSetCropProfile
  | DivineSetSegmentSpeed
  | DivineSetSegmentFade {
  return (
    action.type === 'split_segment' ||
    action.type === 'trim_segment' ||
    action.type === 'remove_segment' ||
    action.type === 'reorder_segment' ||
    action.type === 'set_crop_profile' ||
    action.type === 'set_segment_speed' ||
    action.type === 'set_segment_fade'
  )
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseEditorDivineUiAction(raw: unknown): EditorDivineUiAction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const t = o.type

  // ── UI / nav ──────────────────────────────────────────────────────────────
  if (t === 'seek_playhead' && typeof o.sec === 'number' && Number.isFinite(o.sec)) {
    return { type: 'seek_playhead', sec: Math.max(0, o.sec) }
  }
  if (t === 'set_density' && (o.density === 'simple' || o.density === 'pro')) {
    return { type: 'set_density', density: o.density }
  }
  if (t === 'set_media_context' && (o.context === 'video' || o.context === 'image')) {
    return { type: 'set_media_context', context: o.context }
  }
  if (t === 'focus_inspector') {
    const tab = o.tab
    if (tab === 'clip' || tab === 'crop' || tab === 'trim' || tab === 'export' || tab === 'trace') {
      return { type: 'focus_inspector', tab }
    }
  }
  if (t === 'noop') {
    return { type: 'noop', reason: typeof o.reason === 'string' ? o.reason : undefined }
  }

  // ── Timeline editing ──────────────────────────────────────────────────────
  if (t === 'split_segment' && typeof o.splitAtSec === 'number' && Number.isFinite(o.splitAtSec)) {
    return {
      type: 'split_segment',
      segmentId: typeof o.segmentId === 'string' ? o.segmentId : undefined,
      splitAtSec: Math.max(0, o.splitAtSec),
    }
  }
  if (t === 'trim_segment' && typeof o.segmentId === 'string') {
    const action: DivineTrimSegment = { type: 'trim_segment', segmentId: o.segmentId }
    if (typeof o.startSec === 'number' && Number.isFinite(o.startSec)) action.startSec = Math.max(0, o.startSec)
    if (typeof o.endSec === 'number' && Number.isFinite(o.endSec)) action.endSec = Math.max(0, o.endSec)
    if (action.startSec === undefined && action.endSec === undefined) return null
    return action
  }
  if (t === 'remove_segment' && typeof o.segmentId === 'string') {
    return { type: 'remove_segment', segmentId: o.segmentId }
  }
  if (t === 'reorder_segment' && typeof o.segmentId === 'string' && typeof o.toIndex === 'number') {
    return { type: 'reorder_segment', segmentId: o.segmentId, toIndex: Math.max(0, Math.floor(o.toIndex)) }
  }
  if (t === 'set_crop_profile') {
    const p = o.profile
    if (p === '9:16' || p === '16:9' || p === '1:1' || p === '4:5' || p === '3:4' || p === 'original') {
      return { type: 'set_crop_profile', profile: p }
    }
  }
  if (t === 'set_segment_speed' && typeof o.segmentId === 'string' && typeof o.speedPct === 'number') {
    return {
      type: 'set_segment_speed',
      segmentId: o.segmentId,
      speedPct: Math.max(25, Math.min(400, o.speedPct)),
    }
  }
  if (t === 'set_segment_fade' && typeof o.segmentId === 'string') {
    const action: DivineSetSegmentFade = { type: 'set_segment_fade', segmentId: o.segmentId }
    if (typeof o.fadeInMs === 'number' && Number.isFinite(o.fadeInMs)) action.fadeInMs = Math.max(0, Math.min(5000, o.fadeInMs))
    if (typeof o.fadeOutMs === 'number' && Number.isFinite(o.fadeOutMs)) action.fadeOutMs = Math.max(0, Math.min(5000, o.fadeOutMs))
    if (action.fadeInMs === undefined && action.fadeOutMs === undefined) return null
    return action
  }

  return null
}
