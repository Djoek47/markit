import { describe, expect, it } from 'vitest'
import { parseMarkitEditPlanJson } from '@/lib/markit-edit-plan'
import type { TimelineSegment } from '@/lib/timeline-project'
import { timelineToEditPlan } from '@/lib/timeline-project'

describe('parseMarkitEditPlanJson', () => {
  it('parses optional output', () => {
    const raw = JSON.stringify({
      version: 1,
      segments: [{ startSec: 0, endSec: 2 }],
      output: { format: 'webm', encoderProfile: 'test.vp9' },
    })
    const plan = parseMarkitEditPlanJson(raw)
    expect(plan?.output?.format).toBe('webm')
    expect(plan?.output?.encoderProfile).toBe('test.vp9')
  })
})

describe('timelineToEditPlan', () => {
  it('embeds output metadata', () => {
    const segments: TimelineSegment[] = [
      { id: 'a', startSec: 0, endSec: 1, source: 'primary' },
    ]
    const plan = timelineToEditPlan(segments, 't', undefined, {
      format: 'mp4',
      encoderProfile: 'h264',
    })
    expect(plan.output?.format).toBe('mp4')
  })
})
