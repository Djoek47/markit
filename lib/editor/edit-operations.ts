import type { TimelineClip, TimelineOperation, TimelineState } from '@/lib/editor/timeline-model'
import { applyTimelineOperation } from '@/lib/editor/timeline-model'

export function createTrimOperation(trackId: string, clipId: string, startSec: number, endSec: number): TimelineOperation {
  return {
    op: 'update_clip',
    trackId,
    clipId,
    patch: { startSec, endSec },
  }
}

export function createClipAtPlayhead(
  durationSec: number,
  playheadSec: number,
  spanSec = 5,
  source: TimelineClip['source'] = 'primary',
): TimelineClip {
  const start = Math.max(0, Math.min(playheadSec, Math.max(0, durationSec - 0.1)))
  const end = Math.min(durationSec, start + Math.max(0.1, spanSec))
  return {
    id: crypto.randomUUID(),
    source,
    startSec: start,
    endSec: Math.max(start + 0.1, end),
    label: `Clip ${Math.round(start)}s`,
  }
}

export function applyOperations(state: TimelineState, operations: TimelineOperation[]): TimelineState {
  return operations.reduce((acc, op) => applyTimelineOperation(acc, op), state)
}

