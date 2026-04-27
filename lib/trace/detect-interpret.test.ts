import { describe, expect, it } from 'vitest'
import { buildDetectVerdict, formatVerdictLine, type DetectVerdict } from '@/lib/trace/detect-interpret'

describe('buildDetectVerdict', () => {
  it('returns no_marker when extract state is no_marker', () => {
    const verdict = buildDetectVerdict({ state: 'no_marker', payload: null }, null)
    expect(verdict.kind).toBe('no_marker')
  })

  it('returns invalid with malformed reason when extract state is marker_invalid_json', () => {
    const verdict = buildDetectVerdict({ state: 'marker_invalid_json', payload: null }, null)
    expect(verdict.kind).toBe('invalid')
    if (verdict.kind === 'invalid') {
      expect(verdict.reason).toBe('marker JSON malformed or truncated')
    }
  })

  it('returns invalid with signature reason when extract state is marker_invalid_signature', () => {
    const verdict = buildDetectVerdict({ state: 'marker_invalid_signature', payload: null }, null)
    expect(verdict.kind).toBe('invalid')
    if (verdict.kind === 'invalid') {
      expect(verdict.reason).toBe('marker signature did not verify')
    }
  })

  it('returns expired when extract state is marker_expired', () => {
    const verdict = buildDetectVerdict({ state: 'marker_expired', payload: null }, null)
    expect(verdict.kind).toBe('expired')
  })

  it('returns identified with recipient label and short payload id when marker valid and registry row exists', () => {
    const payload = {
      v: 1 as const,
      payloadId: 'a1b2c3d4-e5f6-4789-0abc-def012345678',
      recipientLabel: 'alice_test',
      userId: 'user-1',
      exp: 9999999999,
      sig: 'fake-sig',
    }
    const verdict = buildDetectVerdict(
      { state: 'marker_valid', payload },
      { recipient_label: 'alice_test', algorithm: 'append-v1' },
    )
    expect(verdict.kind).toBe('identified')
    if (verdict.kind === 'identified') {
      expect(verdict.recipientLabel).toBe('alice_test')
      expect(verdict.payloadIdShort).toBe('a1b2c3d4')
      expect(verdict.algorithmVersion).toBe('append-v1')
    }
  })

  it('returns orphaned when marker valid but registry row is null', () => {
    const payload = {
      v: 1 as const,
      payloadId: 'a1b2c3d4-e5f6-4789-0abc-def012345678',
      recipientLabel: 'alice_test',
      userId: 'user-1',
      exp: 9999999999,
      sig: 'fake-sig',
    }
    const verdict = buildDetectVerdict({ state: 'marker_valid', payload }, null)
    expect(verdict.kind).toBe('orphaned')
    if (verdict.kind === 'orphaned') {
      expect(verdict.payloadIdShort).toBe('a1b2c3d4')
      expect(verdict.reason).toContain('no record exists')
    }
  })

  it('truncates payloadId to 8 chars when payloadId is shorter than 8', () => {
    const payload = {
      v: 1 as const,
      payloadId: 'abcd',
      recipientLabel: 'alice',
      userId: 'user-1',
      exp: 9999999999,
      sig: 'fake-sig',
    }
    const verdict = buildDetectVerdict({ state: 'marker_valid', payload }, null)
    expect(verdict.kind).toBe('orphaned')
    if (verdict.kind === 'orphaned') {
      expect(verdict.payloadIdShort).toBe('abcd')
    }
  })
})

describe('formatVerdictLine', () => {
  it('formats identified verdict with recipient label', () => {
    const verdict: DetectVerdict = {
      kind: 'identified',
      recipientLabel: 'alice_test',
      payloadIdShort: 'a1b2c3d4',
      algorithmVersion: 'append-v1',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toBe('Sent to alice_test')
  })

  it('formats orphaned verdict with payload id', () => {
    const verdict: DetectVerdict = {
      kind: 'orphaned',
      payloadIdShort: 'a1b2c3d4',
      reason: 'marker is valid but no record exists for this user',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toContain('Marker valid but no record')
    expect(line).toContain('a1b2c3d4')
  })

  it('formats no_marker verdict', () => {
    const verdict: DetectVerdict = { kind: 'no_marker' }
    const line = formatVerdictLine(verdict)
    expect(line).toContain('No Markit trace marker found')
  })

  it('formats invalid verdict with reason', () => {
    const verdict: DetectVerdict = {
      kind: 'invalid',
      reason: 'marker signature did not verify',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toContain('Marker invalid')
    expect(line).toContain('signature')
  })

  it('formats expired verdict', () => {
    const verdict: DetectVerdict = { kind: 'expired' }
    const line = formatVerdictLine(verdict)
    expect(line).toContain('expired')
  })

  it('includes the full orphaned reason in output', () => {
    const verdict: DetectVerdict = {
      kind: 'orphaned',
      payloadIdShort: 'xyz12345',
      reason: 'marker is valid but no record exists for this user',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toContain('marker is valid but no record exists for this user')
  })

  it('handles identified with different recipients', () => {
    const verdicts: DetectVerdict[] = [
      { kind: 'identified', recipientLabel: 'bob', payloadIdShort: 'x1', algorithmVersion: 'append-v1' },
      { kind: 'identified', recipientLabel: 'charlie_prod', payloadIdShort: 'y2', algorithmVersion: 'append-v1' },
    ]
    expect(formatVerdictLine(verdicts[0])).toBe('Sent to bob')
    expect(formatVerdictLine(verdicts[1])).toBe('Sent to charlie_prod')
  })
})
