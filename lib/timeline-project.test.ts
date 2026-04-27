import { describe, expect, it } from 'vitest'
import {
  resizeSegmentEdge,
  splitSegmentAtSec,
  rectForAspect,
  patchSegment,
  type TimelineSegment,
} from '@/lib/timeline-project'

function seg(id: string, start: number, end: number, extras: Partial<TimelineSegment> = {}): TimelineSegment {
  return { id, startSec: start, endSec: end, source: 'primary', ...extras }
}

describe('splitSegmentAtSec', () => {
  it('splits a single segment cleanly at the midpoint', () => {
    const next = splitSegmentAtSec([seg('a', 0, 10)], 'a', 4)
    expect(next).toHaveLength(2)
    expect(next[0].startSec).toBe(0)
    expect(next[0].endSec).toBe(4)
    expect(next[0].id).toBe('a')
    expect(next[1].startSec).toBe(4)
    expect(next[1].endSec).toBe(10)
    expect(next[1].id).not.toBe('a')
  })

  it('preserves source and labels with a (B) suffix on the right half', () => {
    const input = [seg('a', 0, 6, { source: 'secondary', label: 'B-roll' })]
    const next = splitSegmentAtSec(input, 'a', 3)
    expect(next[0].source).toBe('secondary')
    expect(next[0].label).toBe('B-roll')
    expect(next[1].source).toBe('secondary')
    expect(next[1].label).toBe('B-roll (B)')
  })

  it('omits the (B) suffix when the source had no label', () => {
    const next = splitSegmentAtSec([seg('a', 0, 6)], 'a', 3)
    expect(next[1].label).toBeUndefined()
  })

  it('is a no-op when id is missing', () => {
    const input = [seg('a', 0, 5)]
    expect(splitSegmentAtSec(input, 'b', 2)).toBe(input)
  })

  it('is a no-op when split sits inside the 0.1s edge buffer', () => {
    const input = [seg('a', 0, 5)]
    expect(splitSegmentAtSec(input, 'a', 0.05)).toBe(input)
    expect(splitSegmentAtSec(input, 'a', 4.97)).toBe(input)
  })

  it('is a no-op when split exactly on a boundary', () => {
    const input = [seg('a', 1, 5)]
    expect(splitSegmentAtSec(input, 'a', 1)).toBe(input)
    expect(splitSegmentAtSec(input, 'a', 5)).toBe(input)
  })

  it('is a no-op when splitAtSec is not finite', () => {
    const input = [seg('a', 0, 5)]
    expect(splitSegmentAtSec(input, 'a', Number.NaN)).toBe(input)
    expect(splitSegmentAtSec(input, 'a', Number.POSITIVE_INFINITY)).toBe(input)
  })

  it('preserves order around the split', () => {
    const input = [seg('a', 0, 4), seg('b', 4, 8), seg('c', 8, 12)]
    const next = splitSegmentAtSec(input, 'b', 6)
    expect(next.map((s) => [s.startSec, s.endSec])).toEqual([
      [0, 4],
      [4, 6],
      [6, 8],
      [8, 12],
    ])
  })

  it('refuses when the timeline is already at the segment cap', () => {
    const full = Array.from({ length: 24 }, (_, i) => seg(`s${i}`, i, i + 1))
    expect(splitSegmentAtSec(full, 's0', 0.5)).toBe(full)
  })
})

describe('resizeSegmentEdge', () => {
  it('moves the start edge to the right within bounds', () => {
    const next = resizeSegmentEdge([seg('a', 0, 10)], 'a', 'start', 3, 30)
    expect(next[0].startSec).toBe(3)
    expect(next[0].endSec).toBe(10)
  })

  it('moves the end edge to the left within bounds', () => {
    const next = resizeSegmentEdge([seg('a', 0, 10)], 'a', 'end', 7, 30)
    expect(next[0].startSec).toBe(0)
    expect(next[0].endSec).toBe(7)
  })

  it('clamps start above 0', () => {
    const next = resizeSegmentEdge([seg('a', 2, 10)], 'a', 'start', -5, 30)
    expect(next[0].startSec).toBe(0)
  })

  it('clamps end to media duration', () => {
    const next = resizeSegmentEdge([seg('a', 0, 5)], 'a', 'end', 99, 30)
    expect(next[0].endSec).toBe(30)
  })

  it('keeps a 0.1s minimum span when crossing the opposite edge', () => {
    const next = resizeSegmentEdge([seg('a', 0, 5)], 'a', 'start', 99, 30)
    expect(next[0].startSec).toBeCloseTo(4.9, 5)
    const next2 = resizeSegmentEdge([seg('a', 0, 5)], 'a', 'end', -99, 30)
    expect(next2[0].endSec).toBeCloseTo(0.1, 5)
  })

  it('is a no-op when id is missing', () => {
    const input = [seg('a', 0, 5)]
    expect(resizeSegmentEdge(input, 'b', 'start', 2, 30)).toBe(input)
  })

  it('is a no-op when toSec is not finite', () => {
    const input = [seg('a', 0, 5)]
    expect(resizeSegmentEdge(input, 'a', 'start', Number.NaN, 30)).toBe(input)
  })

  it('handles an unknown duration by deriving an upper bound from the segment', () => {
    const next = resizeSegmentEdge([seg('a', 0, 5)], 'a', 'end', 8, 0)
    expect(next[0].endSec).toBe(8)
  })
})

describe('rectForAspect', () => {
  it('returns full frame for original', () => {
    expect(rectForAspect('original')).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('returns full frame for invalid aspect string', () => {
    expect(rectForAspect('invalid')).toEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(rectForAspect('1:0')).toEqual({ x: 0, y: 0, width: 1, height: 1 })
    expect(rectForAspect('-1:1')).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  // Pixel-aspect helper: given a normalized rect on a frame, return the resulting pixel-aspect.
  // rectWidthPx / rectHeightPx = (rect.width * frameW) / (rect.height * frameH)
  //                           = (rect.width / rect.height) * frameAspect
  function pixelAspect(rect: { width: number; height: number }, frameAspect: number) {
    return (rect.width / rect.height) * frameAspect
  }

  const cases: Array<[string, number, number]> = [
    ['9:16', 16 / 9, 9 / 16],
    ['1:1', 16 / 9, 1],
    ['4:5', 16 / 9, 4 / 5],
    ['16:9', 16 / 9, 16 / 9],
    ['3:4', 16 / 9, 3 / 4],
    ['16:9', 9 / 16, 16 / 9],
    ['1:1', 9 / 16, 1],
    ['9:16', 1, 9 / 16],
  ]

  it.each(cases)('produces a rect with the requested pixel aspect (%s on frame %f)', (aspect, frameAspect, expected) => {
    const rect = rectForAspect(aspect, frameAspect)
    expect(pixelAspect(rect, frameAspect)).toBeCloseTo(expected, 5)
  })

  it('centers the rect inside the frame', () => {
    const rect = rectForAspect('1:1', 16 / 9)
    expect(rect.x).toBeCloseTo((1 - rect.width) / 2, 5)
    expect(rect.y).toBeCloseTo((1 - rect.height) / 2, 5)
  })

  it('clamps inside the frame for every supported aspect', () => {
    for (const aspect of ['9:16', '1:1', '4:5', '16:9', '3:4', 'original']) {
      const rect = rectForAspect(aspect)
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.width).toBeGreaterThan(0)
      expect(rect.height).toBeGreaterThan(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(1)
      expect(rect.y + rect.height).toBeLessThanOrEqual(1)
    }
  })

  it('1:1 on 16:9 frame is a centered square (regression for Day-2 review bug)', () => {
    const rect = rectForAspect('1:1', 16 / 9)
    expect(rect.width).toBeCloseTo(9 / 16, 5)
    expect(rect.height).toBe(1)
    expect(pixelAspect(rect, 16 / 9)).toBeCloseTo(1, 5)
  })
})

describe('patchSegment', () => {
  it('clamps speedPct to [25, 400]', () => {
    let next = patchSegment([seg('a', 0, 5)], 'a', { speedPct: 10 })
    expect(next[0].speedPct).toBe(25)
    next = patchSegment([seg('a', 0, 5)], 'a', { speedPct: 500 })
    expect(next[0].speedPct).toBe(400)
    next = patchSegment([seg('a', 0, 5)], 'a', { speedPct: 100 })
    expect(next[0].speedPct).toBe(100)
  })

  it('clamps fadeInMs to [0, 5000]', () => {
    let next = patchSegment([seg('a', 0, 5)], 'a', { fadeInMs: -100 })
    expect(next[0].fadeInMs).toBe(0)
    next = patchSegment([seg('a', 0, 5)], 'a', { fadeInMs: 10000 })
    expect(next[0].fadeInMs).toBe(5000)
    next = patchSegment([seg('a', 0, 5)], 'a', { fadeInMs: 250 })
    expect(next[0].fadeInMs).toBe(250)
  })

  it('clamps fadeOutMs to [0, 5000]', () => {
    const next = patchSegment([seg('a', 0, 5)], 'a', { fadeOutMs: 3000 })
    expect(next[0].fadeOutMs).toBe(3000)
  })

  it('preserves other fields when patching', () => {
    const input = [seg('a', 0, 5, { label: 'clip1', source: 'secondary' })]
    const next = patchSegment(input, 'a', { speedPct: 150 })
    expect(next[0].label).toBe('clip1')
    expect(next[0].source).toBe('secondary')
    expect(next[0].startSec).toBe(0)
    expect(next[0].endSec).toBe(5)
  })

  it('returns same reference when id not found', () => {
    const input = [seg('a', 0, 5)]
    const next = patchSegment(input, 'b', { speedPct: 100 })
    expect(next).toBe(input)
  })

  it('allows updating label and source', () => {
    const next = patchSegment([seg('a', 0, 5)], 'a', { label: 'renamed', source: 'secondary' })
    expect(next[0].label).toBe('renamed')
    expect(next[0].source).toBe('secondary')
  })

  it('handles multiple fields in one patch', () => {
    const next = patchSegment([seg('a', 0, 5)], 'a', { speedPct: 200, fadeInMs: 500, fadeOutMs: 1000 })
    expect(next[0].speedPct).toBe(200)
    expect(next[0].fadeInMs).toBe(500)
    expect(next[0].fadeOutMs).toBe(1000)
  })
})
