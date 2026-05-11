import { describe, expect, it } from 'vitest'
import { validateBrandSnapshot, formatBrandHandle, defaultBrandSnapshot } from '@/lib/brand-contract'

const validSnapshot = {
  enabled: true,
  platform: 'onlyfans' as const,
  handle: 'cisse',
  position: 'bottom-right' as const,
  opacityPct: 80,
}

describe('defaultBrandSnapshot', () => {
  it('returns disabled snapshot with sane defaults', () => {
    const snap = defaultBrandSnapshot()
    expect(snap.enabled).toBe(false)
    expect(snap.opacityPct).toBeGreaterThanOrEqual(20)
    expect(snap.opacityPct).toBeLessThanOrEqual(100)
  })
})

describe('formatBrandHandle', () => {
  it('formats onlyfans handle', () => {
    expect(formatBrandHandle({ ...validSnapshot, platform: 'onlyfans', handle: 'cisse' }))
      .toBe('onlyfans.com/cisse')
  })

  it('formats fansly handle', () => {
    expect(formatBrandHandle({ ...validSnapshot, platform: 'fansly', handle: 'alice' }))
      .toBe('fansly.com/alice')
  })

  it('formats manyvids handle', () => {
    expect(formatBrandHandle({ ...validSnapshot, platform: 'manyvids', handle: 'bella' }))
      .toBe('manyvids.com/Profile/bella')
  })

  it('formats custom handle with @ prefix', () => {
    expect(formatBrandHandle({ ...validSnapshot, platform: 'custom', handle: 'myname' }))
      .toBe('@myname')
  })

  it('strips leading @ from handle before formatting', () => {
    expect(formatBrandHandle({ ...validSnapshot, platform: 'onlyfans', handle: '@cisse' }))
      .toBe('onlyfans.com/cisse')
  })
})

describe('validateBrandSnapshot — valid', () => {
  it('accepts valid snapshot', () => {
    expect(validateBrandSnapshot(validSnapshot).ok).toBe(true)
  })

  it('accepts optional customLogoUrl', () => {
    const r = validateBrandSnapshot({ ...validSnapshot, customLogoUrl: 'https://cdn.example.com/logo.png' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.snapshot.customLogoUrl).toBe('https://cdn.example.com/logo.png')
  })

  it('accepts all valid positions', () => {
    const positions = ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const
    for (const position of positions) {
      expect(validateBrandSnapshot({ ...validSnapshot, position }).ok, `position ${position}`).toBe(true)
    }
  })

  it('accepts boundary opacity values 20 and 100', () => {
    expect(validateBrandSnapshot({ ...validSnapshot, opacityPct: 20 }).ok).toBe(true)
    expect(validateBrandSnapshot({ ...validSnapshot, opacityPct: 100 }).ok).toBe(true)
  })
})

describe('validateBrandSnapshot — invalid', () => {
  it('rejects non-object', () => {
    expect(validateBrandSnapshot(null).ok).toBe(false)
    expect(validateBrandSnapshot(42).ok).toBe(false)
  })

  it('rejects non-boolean enabled', () => {
    expect(validateBrandSnapshot({ ...validSnapshot, enabled: 'yes' }).ok).toBe(false)
  })

  it('rejects invalid platform', () => {
    expect(validateBrandSnapshot({ ...validSnapshot, platform: 'twitter' }).ok).toBe(false)
  })

  it('rejects empty handle', () => {
    expect(validateBrandSnapshot({ ...validSnapshot, handle: '' }).ok).toBe(false)
  })

  it('rejects invalid position', () => {
    expect(validateBrandSnapshot({ ...validSnapshot, position: 'diagonal-left' }).ok).toBe(false)
  })

  it('rejects opacityPct below 20', () => {
    expect(validateBrandSnapshot({ ...validSnapshot, opacityPct: 19 }).ok).toBe(false)
  })

  it('rejects opacityPct above 100', () => {
    expect(validateBrandSnapshot({ ...validSnapshot, opacityPct: 101 }).ok).toBe(false)
  })

  it('rejects non-numeric opacity', () => {
    expect(validateBrandSnapshot({ ...validSnapshot, opacityPct: '80' }).ok).toBe(false)
  })
})
