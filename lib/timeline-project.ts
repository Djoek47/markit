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
): MarkitEditPlanV1 {
  return {
    version: 1,
    kind: 'concat_segments',
    label,
    ...(crop && !isFullFrameCrop(crop) ? { crop } : {}),
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
