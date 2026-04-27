import type { MarkitEditPlanV1 } from '@/lib/markit-edit-plan'
import { isFullFrameCrop } from '@/lib/crop-utils'

export type TimelineSegmentSource = 'primary' | 'secondary'

/** One ordered clip for concat export (matches `markit-edit` segment shape + stable id for UI). */
export type TimelineSegment = {
  id: string
  startSec: number
  endSec: number
  source?: TimelineSegmentSource
  label?: string
  speedPct?: number
  fadeInMs?: number
  fadeOutMs?: number
}

const STORAGE_PREFIX = 'markit-timeline-'
export const TIMELINE_MAX_SEGMENTS = 24

function isValidSegment(x: unknown): x is TimelineSegment {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.length < 1) return false
  const a = Number(o.startSec)
  const b = Number(o.endSec)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return false
  if (o.source !== undefined && o.source !== 'primary' && o.source !== 'secondary') return false
  return true
}

export function loadTimelineFromStorage(contentId: string | null): TimelineSegment[] {
  if (!contentId || typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + contentId)
    if (!raw) return []
    const j = JSON.parse(raw) as unknown
    if (!Array.isArray(j)) return []
    return j.filter(isValidSegment).slice(0, TIMELINE_MAX_SEGMENTS)
  } catch {
    return []
  }
}

export function saveTimelineToStorage(contentId: string | null, segments: TimelineSegment[]): void {
  if (!contentId || typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_PREFIX + contentId, JSON.stringify(segments.slice(0, TIMELINE_MAX_SEGMENTS)))
  } catch {
    /* quota */
  }
}

/** Map UI segments to a v1 edit plan (same executor as Assist `markit-edit`). */
export function timelineToEditPlan(
  segments: TimelineSegment[],
  label = 'timeline-export',
  crop?: MarkitEditPlanV1['crop'],
  output?: MarkitEditPlanV1['output'] | null,
): MarkitEditPlanV1 {
  return {
    version: 1,
    kind: 'concat_segments',
    label,
    ...(crop && !isFullFrameCrop(crop) ? { crop } : {}),
    ...(output ? { output } : {}),
    segments: segments.map((s) => ({
      startSec: s.startSec,
      endSec: s.endSec,
      ...(s.source === 'secondary' ? { source: 'secondary' as const } : {}),
    })),
  }
}

export function clampSegmentToDuration(s: TimelineSegment, durationSec: number): TimelineSegment {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return s
  const start = Math.max(0, Math.min(s.startSec, durationSec - 0.05))
  const end = Math.max(start + 0.05, Math.min(s.endSec, durationSec))
  return { ...s, startSec: start, endSec: end }
}

export function clampAllSegments(segments: TimelineSegment[], durationSec: number): TimelineSegment[] {
  return segments.map((s) => clampSegmentToDuration(s, durationSec))
}

/** Default clip: ~5s from playhead (or shorter near end). */
export function newSegmentAtPlayhead(currentTime: number, durationSec: number): TimelineSegment {
  const d = Math.max(0.2, durationSec)
  const start = Math.max(0, Math.min(currentTime, d - 0.1))
  const span = Math.min(5, d - start)
  const end = Math.min(d, start + Math.max(0.1, span))
  return {
    id: crypto.randomUUID(),
    startSec: start,
    endSec: end,
    source: 'primary',
  }
}

export function moveSegment(segments: TimelineSegment[], index: number, dir: -1 | 1): TimelineSegment[] {
  const j = index + dir
  if (j < 0 || j >= segments.length) return segments
  const next = [...segments]
  ;[next[index], next[j]] = [next[j], next[index]]
  return next
}

export function updateSegment(
  segments: TimelineSegment[],
  id: string,
  patch: Partial<Pick<TimelineSegment, 'startSec' | 'endSec' | 'source' | 'label'>>,
): TimelineSegment[] {
  return segments.map((s) => (s.id === id ? { ...s, ...patch } : s))
}

export function removeSegment(segments: TimelineSegment[], id: string): TimelineSegment[] {
  return segments.filter((s) => s.id !== id)
}

/** Minimum span enforced after splitting so the right half is always playable. */
const SPLIT_MIN_SPAN_SEC = 0.1

/**
 * Split one segment in two at splitAtSec (an absolute time on the timeline).
 * No-op when:
 *   - id not found
 *   - splitAtSec falls within SPLIT_MIN_SPAN_SEC of either edge (would create a sub-100ms slice)
 *   - timeline already at TIMELINE_MAX_SEGMENTS
 * Source/label are preserved on both halves; the right half gets a fresh id and a "(B)" label suffix.
 */
export function splitSegmentAtSec(
  segments: TimelineSegment[],
  id: string,
  splitAtSec: number,
): TimelineSegment[] {
  if (!Number.isFinite(splitAtSec)) return segments
  if (segments.length >= TIMELINE_MAX_SEGMENTS) return segments
  const idx = segments.findIndex((s) => s.id === id)
  if (idx < 0) return segments
  const target = segments[idx]
  if (splitAtSec <= target.startSec + SPLIT_MIN_SPAN_SEC) return segments
  if (splitAtSec >= target.endSec - SPLIT_MIN_SPAN_SEC) return segments
  const left: TimelineSegment = { ...target, endSec: splitAtSec }
  const right: TimelineSegment = {
    ...target,
    id: crypto.randomUUID(),
    startSec: splitAtSec,
    label: target.label ? `${target.label} (B)` : undefined,
  }
  const next = [...segments]
  next.splice(idx, 1, left, right)
  return next
}

/** Edge-resize a segment by setting start or end. Clamps to neighbors / duration / min span. */
export function resizeSegmentEdge(
  segments: TimelineSegment[],
  id: string,
  edge: 'start' | 'end',
  toSec: number,
  durationSec: number,
): TimelineSegment[] {
  if (!Number.isFinite(toSec)) return segments
  const idx = segments.findIndex((s) => s.id === id)
  if (idx < 0) return segments
  const seg = segments[idx]
  const minSpan = SPLIT_MIN_SPAN_SEC
  const d = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : Math.max(seg.endSec, toSec) + minSpan
  if (edge === 'start') {
    const next = Math.max(0, Math.min(toSec, seg.endSec - minSpan))
    return updateSegment(segments, id, { startSec: next })
  }
  const next = Math.max(seg.startSec + minSpan, Math.min(toSec, d))
  return updateSegment(segments, id, { endSec: next })
}

/** Centered crop rect for a given aspect ratio on a frame. Aspect: 9:16, 1:1, 4:5, 16:9, 3:4, or original. */
export function rectForAspect(aspect: string, frameAspect = 16 / 9): {
  x: number
  y: number
  width: number
  height: number
} {
  if (aspect === 'original') {
    return { x: 0, y: 0, width: 1, height: 1 }
  }

  const parts = aspect.split(':')
  if (parts.length !== 2) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }

  const w = Number(parts[0])
  const h = Number(parts[1])
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }

  const targetAspect = w / h
  let rectWidth: number
  let rectHeight: number

  if (targetAspect > frameAspect) {
    // Target is wider than the frame — width is the binding edge.
    rectWidth = 1
    rectHeight = frameAspect / targetAspect
  } else {
    // Target is taller than (or equal to) the frame — height is the binding edge.
    rectHeight = 1
    rectWidth = targetAspect / frameAspect
  }

  const x = (1 - rectWidth) / 2
  const y = (1 - rectHeight) / 2

  return {
    x: Math.max(0, Math.min(x, 1 - rectWidth)),
    y: Math.max(0, Math.min(y, 1 - rectHeight)),
    width: Math.min(rectWidth, 1),
    height: Math.min(rectHeight, 1),
  }
}

/** Patch clip properties: speed, fade in/out, label, source. Clamps speedPct to [25,400], fade to [0,5000]. */
export function patchSegment(
  segments: TimelineSegment[],
  id: string,
  patch: Partial<Pick<TimelineSegment, 'speedPct' | 'fadeInMs' | 'fadeOutMs' | 'label' | 'source'>>,
): TimelineSegment[] {
  const idx = segments.findIndex((s) => s.id === id)
  if (idx < 0) return segments

  const clamped: Partial<TimelineSegment> = {}
  if ('speedPct' in patch && patch.speedPct !== undefined) {
    clamped.speedPct = Math.max(25, Math.min(400, patch.speedPct))
  }
  if ('fadeInMs' in patch && patch.fadeInMs !== undefined) {
    clamped.fadeInMs = Math.max(0, Math.min(5000, patch.fadeInMs))
  }
  if ('fadeOutMs' in patch && patch.fadeOutMs !== undefined) {
    clamped.fadeOutMs = Math.max(0, Math.min(5000, patch.fadeOutMs))
  }
  if ('label' in patch) {
    clamped.label = patch.label
  }
  if ('source' in patch) {
    clamped.source = patch.source
  }

  return segments.map((s) => (s.id === id ? { ...s, ...clamped } : s))
}
