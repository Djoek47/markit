import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyEditorDivineAction, makeDivineApplierContext } from '@/lib/markit-v5/divine-action-applier'
import { useEditorShellStore } from '@/lib/stores/editor-shell-store'
import type { TimelineSegment } from '@/lib/timeline-project'

/** Helper: cast mock.calls[0][0] to TimelineSegment[]. */
function firstCallSegments(mock: ReturnType<typeof vi.fn>): TimelineSegment[] {
  return mock.mock.calls[0][0] as TimelineSegment[]
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function seg(id: string, start: number, end: number, label?: string): TimelineSegment {
  return { id, startSec: start, endSec: end, source: 'primary', label }
}

beforeEach(() => {
  useEditorShellStore.setState({
    density: 'simple',
    mediaContext: 'video',
    playheadSec: 0,
    seekRequest: null,
    exportFormat: 'mp4',
    encoderProfile: 'markit.v1.h264',
  })
})

// ─── nav actions (unchanged behaviour) ───────────────────────────────────────

describe('applyEditorDivineAction — nav', () => {
  it('sets density and media context via store', () => {
    const setTab = vi.fn()
    applyEditorDivineAction(null, { type: 'set_density', density: 'pro' }, makeDivineApplierContext(setTab))
    expect(useEditorShellStore.getState().density).toBe('pro')

    applyEditorDivineAction(null, { type: 'set_media_context', context: 'image' }, makeDivineApplierContext(setTab))
    expect(useEditorShellStore.getState().mediaContext).toBe('image')
  })

  it('seeks playhead via store', () => {
    const setTab = vi.fn()
    applyEditorDivineAction(null, { type: 'seek_playhead', sec: 7.5 }, makeDivineApplierContext(setTab))
    expect(useEditorShellStore.getState().seekRequest?.sec).toBe(7.5)
  })

  it('calls setInspectorTab', () => {
    const setTab = vi.fn()
    applyEditorDivineAction(null, { type: 'focus_inspector', tab: 'export' }, makeDivineApplierContext(setTab))
    expect(setTab).toHaveBeenCalledWith('export')
  })

  it('noop is a no-op', () => {
    const setTab = vi.fn()
    applyEditorDivineAction(null, { type: 'noop' }, makeDivineApplierContext(setTab))
    expect(setTab).not.toHaveBeenCalled()
  })
})

// ─── timeline editing actions ────────────────────────────────────────────────

describe('applyEditorDivineAction — split_segment', () => {
  it('splits segment by id', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 10, 'Clip')]
    applyEditorDivineAction(
      null,
      { type: 'split_segment', segmentId: 's1', splitAtSec: 4 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result).toHaveLength(2)
    expect(result[0].endSec).toBe(4)
    expect(result[1].startSec).toBe(4)
  })

  it('resolves segment by time when segmentId omitted', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 10)]
    applyEditorDivineAction(
      null,
      { type: 'split_segment', splitAtSec: 5 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    expect(setSegments).toHaveBeenCalledOnce()
    const result = firstCallSegments(setSegments)
    expect(result).toHaveLength(2)
  })

  it('no-ops when time is outside all segments', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 5)]
    applyEditorDivineAction(
      null,
      { type: 'split_segment', splitAtSec: 20 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    expect(setSegments).not.toHaveBeenCalled()
  })

  it('no-ops when segments context is missing', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    applyEditorDivineAction(
      null,
      { type: 'split_segment', splitAtSec: 3 },
      makeDivineApplierContext(setTab, { setSegments }),
    )
    expect(setSegments).not.toHaveBeenCalled()
  })
})

describe('applyEditorDivineAction — trim_segment', () => {
  it('updates startSec', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 10)]
    applyEditorDivineAction(
      null,
      { type: 'trim_segment', segmentId: 's1', startSec: 2 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result[0].startSec).toBe(2)
    expect(result[0].endSec).toBe(10)
  })

  it('updates endSec', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 10)]
    applyEditorDivineAction(
      null,
      { type: 'trim_segment', segmentId: 's1', endSec: 7 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result[0].endSec).toBe(7)
  })
})

describe('applyEditorDivineAction — remove_segment', () => {
  it('removes the target segment', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 5), seg('s2', 5, 10)]
    applyEditorDivineAction(
      null,
      { type: 'remove_segment', segmentId: 's1' },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s2')
  })
})

describe('applyEditorDivineAction — reorder_segment', () => {
  it('moves segment forward', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('a', 0, 1), seg('b', 1, 2), seg('c', 2, 3)]
    applyEditorDivineAction(
      null,
      { type: 'reorder_segment', segmentId: 'a', toIndex: 2 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result.map((s: TimelineSegment) => s.id)).toEqual(['b', 'c', 'a'])
  })

  it('moves segment backward', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('a', 0, 1), seg('b', 1, 2), seg('c', 2, 3)]
    applyEditorDivineAction(
      null,
      { type: 'reorder_segment', segmentId: 'c', toIndex: 0 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result.map((s: TimelineSegment) => s.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('applyEditorDivineAction — set_crop_profile', () => {
  it('calls setCropRect with correct rect for 9:16', () => {
    const setTab = vi.fn()
    const setCropRect = vi.fn()
    applyEditorDivineAction(
      null,
      { type: 'set_crop_profile', profile: '9:16' },
      makeDivineApplierContext(setTab, { setCropRect }),
    )
    expect(setCropRect).toHaveBeenCalledOnce()
    const rect = setCropRect.mock.calls[0][0] as { x: number; y: number; width: number; height: number }
    expect(rect.height).toBe(1)
    expect(rect.width).toBeCloseTo(9 / 16 / (16 / 9), 5)
  })

  it('no-ops when setCropRect is missing', () => {
    const setTab = vi.fn()
    // Should not throw
    expect(() =>
      applyEditorDivineAction(
        null,
        { type: 'set_crop_profile', profile: 'original' },
        makeDivineApplierContext(setTab),
      ),
    ).not.toThrow()
  })
})

describe('applyEditorDivineAction — set_segment_speed', () => {
  it('patches speedPct on segment', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 10)]
    applyEditorDivineAction(
      null,
      { type: 'set_segment_speed', segmentId: 's1', speedPct: 200 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result[0].speedPct).toBe(200)
  })
})

describe('applyEditorDivineAction — set_segment_fade', () => {
  it('patches fadeOutMs', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 10)]
    applyEditorDivineAction(
      null,
      { type: 'set_segment_fade', segmentId: 's1', fadeOutMs: 1500 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result[0].fadeOutMs).toBe(1500)
  })

  it('patches both fadeInMs and fadeOutMs', () => {
    const setTab = vi.fn()
    const setSegments = vi.fn()
    const segments = [seg('s1', 0, 10)]
    applyEditorDivineAction(
      null,
      { type: 'set_segment_fade', segmentId: 's1', fadeInMs: 300, fadeOutMs: 800 },
      makeDivineApplierContext(setTab, { segments, setSegments }),
    )
    const result = firstCallSegments(setSegments)
    expect(result[0].fadeInMs).toBe(300)
    expect(result[0].fadeOutMs).toBe(800)
  })
})
