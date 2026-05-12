import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyDivineActionToOpenReel } from './openreel-divine-adapter'

const mockStore = {
  project: {
    timeline: {
      tracks: [
        {
          id: 'track-1',
          clips: [
            { id: 'clip-1', startTime: 0,     duration: 10000 }, // 0–10 s
            { id: 'clip-2', startTime: 10000, duration: 5000  }, // 10–15 s
          ],
        },
      ],
    },
  },
  splitClip:       vi.fn().mockResolvedValue({ success: true }),
  trimClip:        vi.fn().mockResolvedValue({ success: true }),
  rippleDeleteClip: vi.fn().mockResolvedValue({ success: true }),
  executeAction:   vi.fn().mockResolvedValue({ success: true }),
  updateSettings:  vi.fn().mockResolvedValue({ success: true }),
}

vi.mock('@/vendor/openreel/web/stores/project-store', () => ({
  useProjectStore: { getState: () => mockStore },
}))

describe('applyDivineActionToOpenReel', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── split_segment ──────────────────────────────────────────────────────────

  it('split_segment with explicit segmentId converts sec → ms', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'split_segment',
      segmentId: 'clip-1',
      splitAtSec: 5,
    })
    expect(handled).toBe(true)
    expect(mockStore.splitClip).toHaveBeenCalledWith('clip-1', 5000)
  })

  it('split_segment without segmentId finds clip at splitAtSec', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'split_segment',
      splitAtSec: 12, // inside clip-2 (10–15 s)
    })
    expect(handled).toBe(true)
    expect(mockStore.splitClip).toHaveBeenCalledWith('clip-2', 12000)
  })

  it('split_segment returns false when no clip found at time', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'split_segment',
      splitAtSec: 99,
    })
    expect(handled).toBe(false)
    expect(mockStore.splitClip).not.toHaveBeenCalled()
  })

  // ── trim_segment ───────────────────────────────────────────────────────────

  it('trim_segment converts start and end sec → ms', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'trim_segment',
      segmentId: 'clip-1',
      startSec: 1,
      endSec: 8,
    })
    expect(handled).toBe(true)
    expect(mockStore.trimClip).toHaveBeenCalledWith('clip-1', 1000, 8000)
  })

  it('trim_segment with only startSec passes undefined for outPoint', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'trim_segment',
      segmentId: 'clip-1',
      startSec: 2,
    })
    expect(handled).toBe(true)
    expect(mockStore.trimClip).toHaveBeenCalledWith('clip-1', 2000, undefined)
  })

  it('trim_segment returns false for unknown clipId', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'trim_segment',
      segmentId: 'ghost',
      startSec: 1,
    })
    expect(handled).toBe(false)
    expect(mockStore.trimClip).not.toHaveBeenCalled()
  })

  // ── remove_segment ─────────────────────────────────────────────────────────

  it('remove_segment calls rippleDeleteClip', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'remove_segment',
      segmentId: 'clip-2',
    })
    expect(handled).toBe(true)
    expect(mockStore.rippleDeleteClip).toHaveBeenCalledWith('clip-2')
  })

  // ── set_segment_fade ───────────────────────────────────────────────────────

  it('set_segment_fade dispatches audio/setFade converting ms → sec', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'set_segment_fade',
      segmentId: 'clip-1',
      fadeInMs: 500,
      fadeOutMs: 1000,
    })
    expect(handled).toBe(true)
    expect(mockStore.executeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'audio/setFade',
        params: expect.objectContaining({ clipId: 'clip-1', fadeIn: 0.5, fadeOut: 1 }),
      }),
    )
  })

  it('set_segment_fade omits fadeIn when only fadeOutMs provided', () => {
    applyDivineActionToOpenReel({
      type: 'set_segment_fade',
      segmentId: 'clip-1',
      fadeOutMs: 2000,
    })
    const { params } = mockStore.executeAction.mock.calls[0][0] as { params: Record<string, unknown> }
    expect(params.fadeOut).toBe(2)
    expect(params.fadeIn).toBeUndefined()
  })

  // ── set_crop_profile ───────────────────────────────────────────────────────

  it('set_crop_profile 9:16 updates project to portrait dimensions', () => {
    const handled = applyDivineActionToOpenReel({ type: 'set_crop_profile', profile: '9:16' })
    expect(handled).toBe(true)
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ width: 1080, height: 1920 })
  })

  it('set_crop_profile 16:9 updates project to landscape dimensions', () => {
    const handled = applyDivineActionToOpenReel({ type: 'set_crop_profile', profile: '16:9' })
    expect(handled).toBe(true)
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ width: 1920, height: 1080 })
  })

  it('set_crop_profile 1:1 updates project to square dimensions', () => {
    const handled = applyDivineActionToOpenReel({ type: 'set_crop_profile', profile: '1:1' })
    expect(handled).toBe(true)
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ width: 1080, height: 1080 })
  })

  it('set_crop_profile original returns false (no dimension change)', () => {
    const handled = applyDivineActionToOpenReel({ type: 'set_crop_profile', profile: 'original' })
    expect(handled).toBe(false)
    expect(mockStore.updateSettings).not.toHaveBeenCalled()
  })

  // ── crop_to_aspect ─────────────────────────────────────────────────────────

  it('crop_to_aspect 9:16-of maps to portrait dimensions', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'crop_to_aspect',
      segmentId: 'clip-1',
      aspect: '9:16-of',
    })
    expect(handled).toBe(true)
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ width: 1080, height: 1920 })
  })

  it('crop_to_aspect 9:16-fansly maps to portrait dimensions', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'crop_to_aspect',
      segmentId: 'clip-1',
      aspect: '9:16-fansly',
    })
    expect(handled).toBe(true)
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ width: 1080, height: 1920 })
  })

  it('crop_to_aspect original returns false', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'crop_to_aspect',
      segmentId: 'clip-1',
      aspect: 'original',
    })
    expect(handled).toBe(false)
  })

  // ── fall-through cases ─────────────────────────────────────────────────────

  it('set_segment_speed falls through (no speed action in OpenReel)', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'set_segment_speed',
      segmentId: 'clip-1',
      speedPct: 200,
    })
    expect(handled).toBe(false)
  })

  it('seek_playhead falls through (nav action)', () => {
    const handled = applyDivineActionToOpenReel({ type: 'seek_playhead', sec: 5 })
    expect(handled).toBe(false)
  })

  it('set_recipient falls through (v8 trace domain)', () => {
    const handled = applyDivineActionToOpenReel({
      type: 'set_recipient',
      recipientLabel: 'Alice',
    })
    expect(handled).toBe(false)
  })

  it('returns false when project is null', () => {
    const saved = mockStore.project
    ;(mockStore as Record<string, unknown>).project = null
    const handled = applyDivineActionToOpenReel({ type: 'remove_segment', segmentId: 'clip-1' })
    expect(handled).toBe(false)
    ;(mockStore as Record<string, unknown>).project = saved
  })
})
