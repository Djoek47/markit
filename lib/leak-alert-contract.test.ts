import { describe, expect, it } from 'vitest'
import { validateLeakAlertView, classifyLeakAlertSeverity, leakAlertNeedsAttention } from '@/lib/leak-alert-contract'
import type { LeakAlertView } from '@/lib/leak-alert-contract'

const baseView: LeakAlertView = {
  id: 'lv-1',
  url: 'https://example.com/leak',
  source: 'crawler',
  detectedAt: '2026-01-01T00:00:00Z',
  dmcaState: 'none',
}

describe('classifyLeakAlertSeverity', () => {
  it('high: confidence >= 0.85 with recipient', () => {
    expect(classifyLeakAlertSeverity({ ...baseView, attributedToRecipientLabel: 'alice', attributionConfidence: 0.95 })).toBe('high')
    expect(classifyLeakAlertSeverity({ ...baseView, attributedToRecipientLabel: 'alice', attributionConfidence: 0.85 })).toBe('high')
  })

  it('medium: confidence >= 0.55 and < 0.85 with recipient', () => {
    expect(classifyLeakAlertSeverity({ ...baseView, attributedToRecipientLabel: 'alice', attributionConfidence: 0.7 })).toBe('medium')
    expect(classifyLeakAlertSeverity({ ...baseView, attributedToRecipientLabel: 'alice', attributionConfidence: 0.55 })).toBe('medium')
  })

  it('low: no recipient', () => {
    expect(classifyLeakAlertSeverity({ ...baseView, attributionConfidence: 0.9 })).toBe('low')
  })

  it('low: confidence below 0.55', () => {
    expect(classifyLeakAlertSeverity({ ...baseView, attributedToRecipientLabel: 'alice', attributionConfidence: 0.3 })).toBe('low')
  })

  it('low: no confidence at all', () => {
    expect(classifyLeakAlertSeverity(baseView)).toBe('low')
  })
})

describe('leakAlertNeedsAttention', () => {
  it('true when dismissedAt null, dmcaState none, viewedAt null', () => {
    expect(leakAlertNeedsAttention(baseView)).toBe(true)
  })

  it('false when viewedAt set', () => {
    expect(leakAlertNeedsAttention({ ...baseView, viewedAt: '2026-01-02T00:00:00Z' })).toBe(false)
  })

  it('false when dismissedAt set', () => {
    expect(leakAlertNeedsAttention({ ...baseView, dismissedAt: '2026-01-02T00:00:00Z' })).toBe(false)
  })

  it('false when dmcaState is not none', () => {
    expect(leakAlertNeedsAttention({ ...baseView, dmcaState: 'drafted' })).toBe(false)
    expect(leakAlertNeedsAttention({ ...baseView, dmcaState: 'sent' })).toBe(false)
  })
})

describe('validateLeakAlertView — valid', () => {
  it('accepts minimal valid view', () => {
    expect(validateLeakAlertView(baseView).ok).toBe(true)
  })

  it('round-trips all optional fields', () => {
    const full: LeakAlertView = {
      ...baseView,
      attributedToRecipientLabel: 'alice',
      attributionConfidence: 0.97,
      attributionMarkerId: 'mk-1',
      attributionFetchedAt: '2026-01-01T01:00:00Z',
      viewedAt: '2026-01-01T02:00:00Z',
      dismissedAt: '2026-01-01T03:00:00Z',
      dmcaState: 'sent',
      dmcaDraftId: 'dmca-1',
    }
    const r = validateLeakAlertView(full)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.view.attributedToRecipientLabel).toBe('alice')
      expect(r.view.attributionConfidence).toBe(0.97)
      expect(r.view.dmcaDraftId).toBe('dmca-1')
    }
  })

  it('accepts all valid sources', () => {
    for (const source of ['crawler', 'reported', 'manual'] as const) {
      expect(validateLeakAlertView({ ...baseView, source }).ok, `source ${source}`).toBe(true)
    }
  })

  it('accepts all valid dmcaStates', () => {
    for (const dmcaState of ['none', 'drafted', 'sent', 'acknowledged'] as const) {
      expect(validateLeakAlertView({ ...baseView, dmcaState }).ok, `dmcaState ${dmcaState}`).toBe(true)
    }
  })
})

describe('validateLeakAlertView — invalid', () => {
  it('rejects non-object', () => {
    expect(validateLeakAlertView(null).ok).toBe(false)
    expect(validateLeakAlertView('string').ok).toBe(false)
  })

  it('rejects empty id', () => {
    expect(validateLeakAlertView({ ...baseView, id: '' }).ok).toBe(false)
  })

  it('rejects invalid source', () => {
    expect(validateLeakAlertView({ ...baseView, source: 'api' }).ok).toBe(false)
  })

  it('rejects invalid dmcaState', () => {
    expect(validateLeakAlertView({ ...baseView, dmcaState: 'pending' }).ok).toBe(false)
  })

  it('rejects attributionConfidence > 1', () => {
    expect(validateLeakAlertView({ ...baseView, attributionConfidence: 1.5 }).ok).toBe(false)
  })

  it('rejects attributionConfidence < 0', () => {
    expect(validateLeakAlertView({ ...baseView, attributionConfidence: -0.1 }).ok).toBe(false)
  })

  it('rejects non-string optional field', () => {
    expect(validateLeakAlertView({ ...baseView, viewedAt: 12345 }).ok).toBe(false)
  })
})
