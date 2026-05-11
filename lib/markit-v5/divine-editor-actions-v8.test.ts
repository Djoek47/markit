import { describe, expect, it } from 'vitest'
import {
  parseEditorDivineUiAction,
  isTimelineEditAction,
  isIntensityScanRequired,
} from '@/lib/markit-v5/divine-editor-actions'

// ─── v8 AI editing ────────────────────────────────────────────────────────────

describe('parseEditorDivineUiAction — auto_trim_silence', () => {
  it('parses valid action', () => {
    const result = parseEditorDivineUiAction({ type: 'auto_trim_silence', segmentId: 's1' })
    expect(result).toEqual({ type: 'auto_trim_silence', segmentId: 's1' })
  })

  it('rejects missing segmentId', () => {
    expect(parseEditorDivineUiAction({ type: 'auto_trim_silence' })).toBeNull()
  })

  it('is timeline edit action (requires confirmation)', () => {
    const action = parseEditorDivineUiAction({ type: 'auto_trim_silence', segmentId: 's1' })!
    expect(isTimelineEditAction(action)).toBe(true)
  })

  it('requires intensity scan', () => {
    const action = parseEditorDivineUiAction({ type: 'auto_trim_silence', segmentId: 's1' })!
    expect(isIntensityScanRequired(action)).toBe(true)
  })
})

describe('parseEditorDivineUiAction — crop_to_aspect', () => {
  it('parses 9:16-of', () => {
    const result = parseEditorDivineUiAction({ type: 'crop_to_aspect', segmentId: 's1', aspect: '9:16-of' })
    expect(result).toEqual({ type: 'crop_to_aspect', segmentId: 's1', aspect: '9:16-of' })
  })

  it('parses all valid aspect values', () => {
    const aspects = ['9:16-of', '9:16-fansly', '9:16', '1:1', '4:5', '16:9', 'original'] as const
    for (const aspect of aspects) {
      const r = parseEditorDivineUiAction({ type: 'crop_to_aspect', segmentId: 's1', aspect })
      expect(r).not.toBeNull()
    }
  })

  it('rejects unknown aspect', () => {
    expect(parseEditorDivineUiAction({ type: 'crop_to_aspect', segmentId: 's1', aspect: '4:3' })).toBeNull()
  })

  it('rejects missing segmentId', () => {
    expect(parseEditorDivineUiAction({ type: 'crop_to_aspect', aspect: '1:1' })).toBeNull()
  })

  it('is timeline edit action', () => {
    const action = parseEditorDivineUiAction({ type: 'crop_to_aspect', segmentId: 's1', aspect: '1:1' })!
    expect(isTimelineEditAction(action)).toBe(true)
  })

  it('does not require intensity scan', () => {
    const action = parseEditorDivineUiAction({ type: 'crop_to_aspect', segmentId: 's1', aspect: '1:1' })!
    expect(isIntensityScanRequired(action)).toBe(false)
  })
})

describe('parseEditorDivineUiAction — blur_faces', () => {
  it('parses auto mode', () => {
    const result = parseEditorDivineUiAction({ type: 'blur_faces', segmentId: 's1', mode: 'auto' })
    expect(result).toEqual({ type: 'blur_faces', segmentId: 's1', mode: 'auto' })
  })

  it('parses manual mode with valid regions', () => {
    const regions = [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }]
    const result = parseEditorDivineUiAction({ type: 'blur_faces', segmentId: 's1', mode: 'manual', regions })
    expect(result).toMatchObject({ type: 'blur_faces', mode: 'manual', regions })
  })

  it('strips invalid region objects', () => {
    const result = parseEditorDivineUiAction({
      type: 'blur_faces', segmentId: 's1', mode: 'manual',
      regions: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, 'bad', null],
    }) as { regions: unknown[] }
    expect(result).not.toBeNull()
    expect(result.regions).toHaveLength(1)
  })

  it('rejects invalid mode', () => {
    expect(parseEditorDivineUiAction({ type: 'blur_faces', segmentId: 's1', mode: 'magic' })).toBeNull()
  })
})

describe('parseEditorDivineUiAction — set_clip_speed', () => {
  it('parses valid speed', () => {
    const result = parseEditorDivineUiAction({ type: 'set_clip_speed', segmentId: 's1', speedPct: 150 })
    expect(result).toEqual({ type: 'set_clip_speed', segmentId: 's1', speedPct: 150 })
  })

  it('clamps to 25–400', () => {
    const lo = parseEditorDivineUiAction({ type: 'set_clip_speed', segmentId: 's1', speedPct: 5 }) as { speedPct: number }
    expect(lo.speedPct).toBe(25)
    const hi = parseEditorDivineUiAction({ type: 'set_clip_speed', segmentId: 's1', speedPct: 999 }) as { speedPct: number }
    expect(hi.speedPct).toBe(400)
  })

  it('is timeline edit action', () => {
    const action = parseEditorDivineUiAction({ type: 'set_clip_speed', segmentId: 's1', speedPct: 200 })!
    expect(isTimelineEditAction(action)).toBe(true)
  })
})

describe('parseEditorDivineUiAction — create_teaser', () => {
  it('parses single mode', () => {
    const result = parseEditorDivineUiAction({
      type: 'create_teaser', segmentId: 's1', targetSec: 30, mode: 'single',
    })
    expect(result).toEqual({ type: 'create_teaser', segmentId: 's1', targetSec: 30, mode: 'single' })
  })

  it('parses multi-shot mode with shotCount', () => {
    const result = parseEditorDivineUiAction({
      type: 'create_teaser', segmentId: 's1', targetSec: 45, mode: 'multi-shot', shotCount: 5,
    })
    expect(result).toMatchObject({ mode: 'multi-shot', shotCount: 5 })
  })

  it('rejects invalid mode', () => {
    expect(parseEditorDivineUiAction({ type: 'create_teaser', segmentId: 's1', targetSec: 30, mode: 'loop' })).toBeNull()
  })

  it('rejects non-finite targetSec', () => {
    expect(parseEditorDivineUiAction({ type: 'create_teaser', segmentId: 's1', targetSec: NaN, mode: 'single' })).toBeNull()
  })

  it('requires intensity scan', () => {
    const action = parseEditorDivineUiAction({ type: 'create_teaser', segmentId: 's1', targetSec: 30, mode: 'single' })!
    expect(isIntensityScanRequired(action)).toBe(true)
  })
})

describe('parseEditorDivineUiAction — end_on_climax', () => {
  it('parses without tailSec', () => {
    const result = parseEditorDivineUiAction({ type: 'end_on_climax', segmentId: 's1' })
    expect(result).toEqual({ type: 'end_on_climax', segmentId: 's1' })
  })

  it('parses with tailSec', () => {
    const result = parseEditorDivineUiAction({ type: 'end_on_climax', segmentId: 's1', tailSec: 2 })
    expect(result).toMatchObject({ tailSec: 2 })
  })

  it('requires intensity scan', () => {
    const action = parseEditorDivineUiAction({ type: 'end_on_climax', segmentId: 's1' })!
    expect(isIntensityScanRequired(action)).toBe(true)
  })
})

// ─── v8 brand + trace + export ────────────────────────────────────────────────

describe('parseEditorDivineUiAction — set_recipient', () => {
  it('parses label only', () => {
    const result = parseEditorDivineUiAction({ type: 'set_recipient', recipientLabel: 'alice_test' })
    expect(result).toEqual({ type: 'set_recipient', recipientLabel: 'alice_test' })
  })

  it('parses with platform and platformId', () => {
    const result = parseEditorDivineUiAction({
      type: 'set_recipient', recipientLabel: 'bob', platform: 'onlyfans', platformId: 'bob123',
    })
    expect(result).toMatchObject({ platform: 'onlyfans', platformId: 'bob123' })
  })

  it('trims whitespace from label', () => {
    const result = parseEditorDivineUiAction({ type: 'set_recipient', recipientLabel: '  alice  ' }) as { recipientLabel: string }
    expect(result.recipientLabel).toBe('alice')
  })

  it('rejects empty label', () => {
    expect(parseEditorDivineUiAction({ type: 'set_recipient', recipientLabel: '   ' })).toBeNull()
  })

  it('ignores invalid platform (keeps valid label)', () => {
    const result = parseEditorDivineUiAction({
      type: 'set_recipient', recipientLabel: 'test', platform: 'twitter',
    }) as { platform?: string }
    expect(result).not.toBeNull()
    expect(result.platform).toBeUndefined()
  })

  it('is timeline edit action', () => {
    const action = parseEditorDivineUiAction({ type: 'set_recipient', recipientLabel: 'x' })!
    expect(isTimelineEditAction(action)).toBe(true)
  })
})

describe('parseEditorDivineUiAction — set_brand_apply', () => {
  it('parses true and false', () => {
    expect(parseEditorDivineUiAction({ type: 'set_brand_apply', applyBrand: true })).toEqual({ type: 'set_brand_apply', applyBrand: true })
    expect(parseEditorDivineUiAction({ type: 'set_brand_apply', applyBrand: false })).toEqual({ type: 'set_brand_apply', applyBrand: false })
  })

  it('rejects non-boolean', () => {
    expect(parseEditorDivineUiAction({ type: 'set_brand_apply', applyBrand: 1 })).toBeNull()
  })
})

describe('parseEditorDivineUiAction — set_trace_layers', () => {
  it('parses all booleans', () => {
    const result = parseEditorDivineUiAction({
      type: 'set_trace_layers', spatialGrid: true, temporalRedundancy: false, metadataAppend: true,
    })
    expect(result).toEqual({ type: 'set_trace_layers', spatialGrid: true, temporalRedundancy: false, metadataAppend: true })
  })

  it('rejects partial payload', () => {
    expect(parseEditorDivineUiAction({ type: 'set_trace_layers', spatialGrid: true })).toBeNull()
  })
})

describe('parseEditorDivineUiAction — start_export', () => {
  it('parses confirm: true', () => {
    expect(parseEditorDivineUiAction({ type: 'start_export', confirm: true })).toEqual({ type: 'start_export', confirm: true })
  })

  it('rejects missing confirm', () => {
    expect(parseEditorDivineUiAction({ type: 'start_export' })).toBeNull()
  })
})

// ─── v8 library / vault navigation ───────────────────────────────────────────

describe('parseEditorDivineUiAction — library_search', () => {
  it('parses query', () => {
    expect(parseEditorDivineUiAction({ type: 'library_search', query: 'sunset' })).toEqual({ type: 'library_search', query: 'sunset' })
  })

  it('rejects missing query', () => {
    expect(parseEditorDivineUiAction({ type: 'library_search' })).toBeNull()
  })

  it('is NOT a timeline edit action (applied immediately)', () => {
    const action = parseEditorDivineUiAction({ type: 'library_search', query: 'x' })!
    expect(isTimelineEditAction(action)).toBe(false)
  })
})

describe('parseEditorDivineUiAction — library_select_media', () => {
  it('parses mediaId', () => {
    expect(parseEditorDivineUiAction({ type: 'library_select_media', mediaId: 'm1' })).toEqual({ type: 'library_select_media', mediaId: 'm1' })
  })

  it('includes multi flag when true', () => {
    const result = parseEditorDivineUiAction({ type: 'library_select_media', mediaId: 'm1', multi: true }) as { multi?: boolean }
    expect(result.multi).toBe(true)
  })

  it('omits multi when false', () => {
    const result = parseEditorDivineUiAction({ type: 'library_select_media', mediaId: 'm1', multi: false }) as { multi?: boolean }
    expect(result.multi).toBeUndefined()
  })
})

describe('parseEditorDivineUiAction — library_create_with_ai', () => {
  it('parses mediaIds array', () => {
    expect(parseEditorDivineUiAction({ type: 'library_create_with_ai', mediaIds: ['a', 'b'] })).toEqual({
      type: 'library_create_with_ai', mediaIds: ['a', 'b'],
    })
  })

  it('rejects empty mediaIds array', () => {
    expect(parseEditorDivineUiAction({ type: 'library_create_with_ai', mediaIds: [] })).toBeNull()
  })

  it('filters non-string entries', () => {
    const result = parseEditorDivineUiAction({ type: 'library_create_with_ai', mediaIds: ['a', 42, null] }) as { mediaIds: string[] }
    expect(result.mediaIds).toEqual(['a'])
  })
})

describe('parseEditorDivineUiAction — vault_open_marker', () => {
  it('parses markerId', () => {
    expect(parseEditorDivineUiAction({ type: 'vault_open_marker', markerId: 'mk1' })).toEqual({ type: 'vault_open_marker', markerId: 'mk1' })
  })
})

describe('parseEditorDivineUiAction — vault_dismiss_leak', () => {
  it('parses leakViewId', () => {
    expect(parseEditorDivineUiAction({ type: 'vault_dismiss_leak', leakViewId: 'lv1' })).toEqual({ type: 'vault_dismiss_leak', leakViewId: 'lv1' })
  })
})

describe('parseEditorDivineUiAction — vault_generate_dmca', () => {
  it('parses leakViewId', () => {
    expect(parseEditorDivineUiAction({ type: 'vault_generate_dmca', leakViewId: 'lv1' })).toEqual({ type: 'vault_generate_dmca', leakViewId: 'lv1' })
  })
})

describe('parseEditorDivineUiAction — vault_send_dmca', () => {
  it('parses leakViewId', () => {
    expect(parseEditorDivineUiAction({ type: 'vault_send_dmca', leakViewId: 'lv1' })).toEqual({ type: 'vault_send_dmca', leakViewId: 'lv1' })
  })

  it('includes hostDestination when present', () => {
    const result = parseEditorDivineUiAction({ type: 'vault_send_dmca', leakViewId: 'lv1', hostDestination: 'example.com' }) as { hostDestination?: string }
    expect(result.hostDestination).toBe('example.com')
  })

  it('rejects missing leakViewId', () => {
    expect(parseEditorDivineUiAction({ type: 'vault_send_dmca' })).toBeNull()
  })

  it('is NOT a timeline edit action', () => {
    const action = parseEditorDivineUiAction({ type: 'vault_send_dmca', leakViewId: 'lv1' })!
    expect(isTimelineEditAction(action)).toBe(false)
  })
})
