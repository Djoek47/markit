import { describe, it, expect } from 'vitest'
import { parseEditorDivineUiAction, isTimelineEditAction } from './divine-editor-actions'

// ─── parser: original 5 actions ──────────────────────────────────────────────

describe('parseEditorDivineUiAction — nav actions', () => {
  it('parses seek_playhead', () => {
    expect(parseEditorDivineUiAction({ type: 'seek_playhead', sec: 12.5 })).toEqual({
      type: 'seek_playhead',
      sec: 12.5,
    })
  })

  it('clamps negative seek to 0', () => {
    expect(parseEditorDivineUiAction({ type: 'seek_playhead', sec: -3 })).toEqual({
      type: 'seek_playhead',
      sec: 0,
    })
  })

  it('rejects seek_playhead with non-finite sec', () => {
    expect(parseEditorDivineUiAction({ type: 'seek_playhead', sec: NaN })).toBeNull()
    expect(parseEditorDivineUiAction({ type: 'seek_playhead', sec: Infinity })).toBeNull()
  })

  it('parses set_density', () => {
    expect(parseEditorDivineUiAction({ type: 'set_density', density: 'pro' })).toEqual({
      type: 'set_density',
      density: 'pro',
    })
  })

  it('rejects unknown density', () => {
    expect(parseEditorDivineUiAction({ type: 'set_density', density: 'ultra' })).toBeNull()
  })

  it('parses set_media_context', () => {
    expect(parseEditorDivineUiAction({ type: 'set_media_context', context: 'image' })).toEqual({
      type: 'set_media_context',
      context: 'image',
    })
  })

  it('parses focus_inspector all tabs', () => {
    for (const tab of ['clip', 'crop', 'trim', 'export', 'trace'] as const) {
      expect(parseEditorDivineUiAction({ type: 'focus_inspector', tab })).toEqual({
        type: 'focus_inspector',
        tab,
      })
    }
  })

  it('rejects unknown inspector tab', () => {
    expect(parseEditorDivineUiAction({ type: 'focus_inspector', tab: 'audio' })).toBeNull()
  })

  it('parses noop with and without reason', () => {
    expect(parseEditorDivineUiAction({ type: 'noop' })).toEqual({ type: 'noop', reason: undefined })
    expect(parseEditorDivineUiAction({ type: 'noop', reason: 'not sure' })).toEqual({
      type: 'noop',
      reason: 'not sure',
    })
  })
})

// ─── parser: 7 new timeline editing actions ───────────────────────────────────

describe('parseEditorDivineUiAction — timeline actions', () => {
  it('parses split_segment with segmentId', () => {
    expect(
      parseEditorDivineUiAction({ type: 'split_segment', segmentId: 'abc', splitAtSec: 5.2 }),
    ).toEqual({ type: 'split_segment', segmentId: 'abc', splitAtSec: 5.2 })
  })

  it('parses split_segment without segmentId', () => {
    expect(parseEditorDivineUiAction({ type: 'split_segment', splitAtSec: 3 })).toEqual({
      type: 'split_segment',
      segmentId: undefined,
      splitAtSec: 3,
    })
  })

  it('clamps negative splitAtSec to 0', () => {
    expect(parseEditorDivineUiAction({ type: 'split_segment', splitAtSec: -1 })).toEqual({
      type: 'split_segment',
      segmentId: undefined,
      splitAtSec: 0,
    })
  })

  it('rejects split_segment without splitAtSec', () => {
    expect(parseEditorDivineUiAction({ type: 'split_segment' })).toBeNull()
  })

  it('parses trim_segment with both edges', () => {
    expect(
      parseEditorDivineUiAction({ type: 'trim_segment', segmentId: 'x', startSec: 1, endSec: 8 }),
    ).toEqual({ type: 'trim_segment', segmentId: 'x', startSec: 1, endSec: 8 })
  })

  it('parses trim_segment with only endSec', () => {
    expect(parseEditorDivineUiAction({ type: 'trim_segment', segmentId: 'x', endSec: 5 })).toEqual({
      type: 'trim_segment',
      segmentId: 'x',
      endSec: 5,
    })
  })

  it('rejects trim_segment with neither edge', () => {
    expect(parseEditorDivineUiAction({ type: 'trim_segment', segmentId: 'x' })).toBeNull()
  })

  it('parses remove_segment', () => {
    expect(parseEditorDivineUiAction({ type: 'remove_segment', segmentId: 'seg1' })).toEqual({
      type: 'remove_segment',
      segmentId: 'seg1',
    })
  })

  it('parses reorder_segment', () => {
    expect(
      parseEditorDivineUiAction({ type: 'reorder_segment', segmentId: 's', toIndex: 2 }),
    ).toEqual({ type: 'reorder_segment', segmentId: 's', toIndex: 2 })
  })

  it('clamps negative toIndex to 0', () => {
    expect(
      parseEditorDivineUiAction({ type: 'reorder_segment', segmentId: 's', toIndex: -5 }),
    ).toEqual({ type: 'reorder_segment', segmentId: 's', toIndex: 0 })
  })

  it('parses set_crop_profile all profiles', () => {
    for (const profile of ['9:16', '16:9', '1:1', '4:5', '3:4', 'original'] as const) {
      expect(parseEditorDivineUiAction({ type: 'set_crop_profile', profile })).toEqual({
        type: 'set_crop_profile',
        profile,
      })
    }
  })

  it('rejects unknown crop profile', () => {
    expect(parseEditorDivineUiAction({ type: 'set_crop_profile', profile: '2:1' })).toBeNull()
  })

  it('parses set_segment_speed and clamps to [25,400]', () => {
    expect(
      parseEditorDivineUiAction({ type: 'set_segment_speed', segmentId: 'a', speedPct: 200 }),
    ).toEqual({ type: 'set_segment_speed', segmentId: 'a', speedPct: 200 })
    expect(
      parseEditorDivineUiAction({ type: 'set_segment_speed', segmentId: 'a', speedPct: 1 }),
    ).toEqual({ type: 'set_segment_speed', segmentId: 'a', speedPct: 25 })
    expect(
      parseEditorDivineUiAction({ type: 'set_segment_speed', segmentId: 'a', speedPct: 999 }),
    ).toEqual({ type: 'set_segment_speed', segmentId: 'a', speedPct: 400 })
  })

  it('parses set_segment_fade with both values', () => {
    expect(
      parseEditorDivineUiAction({
        type: 'set_segment_fade',
        segmentId: 'b',
        fadeInMs: 500,
        fadeOutMs: 1000,
      }),
    ).toEqual({ type: 'set_segment_fade', segmentId: 'b', fadeInMs: 500, fadeOutMs: 1000 })
  })

  it('clamps set_segment_fade to [0, 5000]', () => {
    const r = parseEditorDivineUiAction({
      type: 'set_segment_fade',
      segmentId: 'b',
      fadeInMs: -100,
      fadeOutMs: 9999,
    })
    expect(r).toEqual({ type: 'set_segment_fade', segmentId: 'b', fadeInMs: 0, fadeOutMs: 5000 })
  })

  it('rejects set_segment_fade with neither value', () => {
    expect(parseEditorDivineUiAction({ type: 'set_segment_fade', segmentId: 'b' })).toBeNull()
  })
})

// ─── isTimelineEditAction ─────────────────────────────────────────────────────

describe('isTimelineEditAction', () => {
  it('returns true for all 7 timeline actions', () => {
    const timelineActions = [
      { type: 'split_segment', splitAtSec: 1 },
      { type: 'trim_segment', segmentId: 'x', endSec: 5 },
      { type: 'remove_segment', segmentId: 'x' },
      { type: 'reorder_segment', segmentId: 'x', toIndex: 1 },
      { type: 'set_crop_profile', profile: '9:16' },
      { type: 'set_segment_speed', segmentId: 'x', speedPct: 100 },
      { type: 'set_segment_fade', segmentId: 'x', fadeOutMs: 200 },
    ] as const
    for (const a of timelineActions) {
      expect(isTimelineEditAction(a)).toBe(true)
    }
  })

  it('returns false for all 5 nav actions', () => {
    const navActions = [
      { type: 'seek_playhead', sec: 0 },
      { type: 'set_density', density: 'pro' },
      { type: 'set_media_context', context: 'video' },
      { type: 'focus_inspector', tab: 'clip' },
      { type: 'noop' },
    ] as const
    for (const a of navActions) {
      expect(isTimelineEditAction(a)).toBe(false)
    }
  })
})

// ─── rejects null / non-objects ───────────────────────────────────────────────

describe('parseEditorDivineUiAction — edge cases', () => {
  it('returns null for null, undefined, non-object', () => {
    expect(parseEditorDivineUiAction(null)).toBeNull()
    expect(parseEditorDivineUiAction(undefined)).toBeNull()
    expect(parseEditorDivineUiAction('seek_playhead')).toBeNull()
    expect(parseEditorDivineUiAction(42)).toBeNull()
  })

  it('returns null for unknown type', () => {
    expect(parseEditorDivineUiAction({ type: 'fly_to_moon' })).toBeNull()
  })
})
