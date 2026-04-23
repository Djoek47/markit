import type { MarkitEditPlanV1 } from '@/lib/markit-edit-plan'
import type { TimelineState } from '@/lib/editor/timeline-model'

export type DeterministicExportManifest = {
  revision: number
  generatedAt: string
  tracks: Array<{ id: string; clipCount: number }>
  segmentChecksum: string
}

function checksum(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)
  }
  return (h >>> 0).toString(16)
}

export function timelineStateToEditPlan(state: TimelineState, label = 'deterministic-export'): MarkitEditPlanV1 {
  const main = state.tracks[0]
  return {
    version: 1,
    kind: 'concat_segments',
    label,
    segments: main.clips.map((c) => ({
      startSec: c.startSec,
      endSec: c.endSec,
      ...(c.source === 'secondary' ? { source: 'secondary' as const } : {}),
    })),
  }
}

export function createExportManifest(state: TimelineState): DeterministicExportManifest {
  const main = state.tracks[0]
  const payload = JSON.stringify(
    main.clips.map((c) => [c.source, c.startSec.toFixed(3), c.endSec.toFixed(3), c.label || '']),
  )
  return {
    revision: state.revision,
    generatedAt: new Date().toISOString(),
    tracks: state.tracks.map((t) => ({ id: t.id, clipCount: t.clips.length })),
    segmentChecksum: checksum(payload),
  }
}

