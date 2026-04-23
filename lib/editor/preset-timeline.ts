import type { TimelineSegment } from '@/lib/timeline-project'

function id() {
  return crypto.randomUUID()
}

/** Tight 1.5–3s cuts across the full source (or first ~90s) for promos. */
export function buildTeaserFastCuts(durationSec: number): TimelineSegment[] {
  const d = Math.max(0.5, durationSec)
  const windowCap = Math.min(d, 90)
  const num = 10
  const clipLen = Math.min(2.5, windowCap / (num + 0.5))
  const step = windowCap / (num + 0.5)
  const segs: TimelineSegment[] = []
  for (let i = 0; i < num; i++) {
    const start = i * step
    const end = Math.min(d, start + clipLen)
    if (end > start + 0.08) {
      segs.push({ id: id(), startSec: start, endSec: end, source: 'primary', label: `Cut ${i + 1}` })
    }
  }
  return segs.length > 0 ? segs : [{ id: id(), startSec: 0, endSec: Math.min(5, d), source: 'primary', label: 'Teaser' }]
}

/** Slower holds: hook → build → value → CTA. */
export function buildPpvPacing(durationSec: number): TimelineSegment[] {
  const d = Math.max(0.5, durationSec)
  return [
    { id: id(), startSec: 0, endSec: d * 0.12, source: 'primary', label: 'Hook' },
    { id: id(), startSec: d * 0.12, endSec: d * 0.45, source: 'primary', label: 'Build' },
    { id: id(), startSec: d * 0.45, endSec: d * 0.78, source: 'primary', label: 'Value' },
    { id: id(), startSec: d * 0.78, endSec: d, source: 'primary', label: 'CTA / PPV' },
  ]
}

/** Three acts, equal length. */
export function buildLongFormStory(durationSec: number): TimelineSegment[] {
  const d = Math.max(0.5, durationSec)
  const t = d / 3
  return [
    { id: id(), startSec: 0, endSec: t, source: 'primary', label: 'Act I' },
    { id: id(), startSec: t, endSec: 2 * t, source: 'primary', label: 'Act II' },
    { id: id(), startSec: 2 * t, endSec: d, source: 'primary', label: 'Act III' },
  ]
}

export function buildPresetSegments(presetId: string, durationSec: number): TimelineSegment[] {
  switch (presetId) {
    case 'teaser-fast-cuts':
    case 'prompt-teaser':
      return buildTeaserFastCuts(durationSec)
    case 'ppv-pacing':
      return buildPpvPacing(durationSec)
    case 'long-form-story':
      return buildLongFormStory(durationSec)
    default:
      return buildTeaserFastCuts(durationSec)
  }
}
