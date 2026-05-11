import { describe, expect, it } from 'vitest'
import { validateVoiceIntentRequest } from '@/lib/voice-intent-contract'

describe('validateVoiceIntentRequest — valid', () => {
  it('accepts transcript only', () => {
    const r = validateVoiceIntentRequest({ transcript: 'split the clip at 5 seconds' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.request.transcript).toBe('split the clip at 5 seconds')
  })

  it('trims transcript whitespace', () => {
    const r = validateVoiceIntentRequest({ transcript: '  trim the clip  ' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.request.transcript).toBe('trim the clip')
  })

  it('accepts with full context', () => {
    const r = validateVoiceIntentRequest({
      transcript: 'show me the library',
      context: { durationSec: 60, playheadSec: 10, segmentCount: 3 },
    })
    expect(r.ok).toBe(true)
  })

  it('accepts with segment list in context', () => {
    const r = validateVoiceIntentRequest({
      transcript: 'remove segment two',
      context: {
        segments: [
          { id: 's1', startSec: 0, endSec: 10 },
          { id: 's2', startSec: 10, endSec: 20, label: 'B' },
        ],
      },
    })
    expect(r.ok).toBe(true)
  })

  it('accepts transcript of exactly 500 chars', () => {
    const r = validateVoiceIntentRequest({ transcript: 'a'.repeat(500) })
    expect(r.ok).toBe(true)
  })
})

describe('validateVoiceIntentRequest — invalid', () => {
  it('rejects non-object', () => {
    expect(validateVoiceIntentRequest(null).ok).toBe(false)
    expect(validateVoiceIntentRequest('transcript').ok).toBe(false)
  })

  it('rejects empty transcript', () => {
    const r = validateVoiceIntentRequest({ transcript: '   ' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.details.some((d) => d.includes('transcript'))).toBe(true)
  })

  it('rejects transcript over 500 chars', () => {
    const r = validateVoiceIntentRequest({ transcript: 'a'.repeat(501) })
    expect(r.ok).toBe(false)
  })

  it('rejects non-object context', () => {
    expect(validateVoiceIntentRequest({ transcript: 'go', context: 'bad' }).ok).toBe(false)
  })

  it('rejects non-finite durationSec', () => {
    expect(validateVoiceIntentRequest({ transcript: 'go', context: { durationSec: NaN } }).ok).toBe(false)
    expect(validateVoiceIntentRequest({ transcript: 'go', context: { durationSec: Infinity } }).ok).toBe(false)
  })

  it('rejects negative segmentCount', () => {
    expect(validateVoiceIntentRequest({ transcript: 'go', context: { segmentCount: -1 } }).ok).toBe(false)
  })

  it('rejects non-integer segmentCount', () => {
    expect(validateVoiceIntentRequest({ transcript: 'go', context: { segmentCount: 2.5 } }).ok).toBe(false)
  })
})
