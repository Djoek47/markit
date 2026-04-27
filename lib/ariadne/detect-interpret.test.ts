import { describe, expect, it } from 'vitest'
import { interpretDetectResponse, formatVerdictLine, type DetectVerdict } from '@/lib/ariadne/detect-interpret'

describe('interpretDetectResponse', () => {
  it('returns identified verdict when marker_valid_registered with recipient_username', () => {
    const resp = {
      match_state: 'marker_valid_registered',
      confidence: 0.97,
      recipient_username: 'alice_test',
      recipient_display_name: 'Alice',
      payload_id: '550e8400-e29b-41d4-a716-446655440000',
      algorithm_version: 'v1.1',
    }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'identified',
      recipientLabel: 'alice_test',
      confidencePct: 97,
      payloadIdShort: '550e8400',
      algorithmVersion: 'v1.1',
    })
  })

  it('returns identified verdict with recipient_display_name when username is missing', () => {
    const resp = {
      match_state: 'marker_valid_registered',
      confidence: 0.88,
      recipient_display_name: 'Bob Smith',
      recipient_key: 'bob-key-123',
      payload_id: '550e8400-e29b-41d4-a716-446655440001',
    }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'identified',
      recipientLabel: 'Bob Smith',
      confidencePct: 88,
      payloadIdShort: '550e8400',
    })
  })

  it('returns identified verdict with recipient_key fallback', () => {
    const resp = {
      match_state: 'marker_valid_registered',
      confidence: 0.75,
      recipient_key: 'charlie-uuid-456',
      payload_id: '550e8400-e29b-41d4-a716-446655440002',
    }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'identified',
      recipientLabel: 'charlie-uuid-456',
      confidencePct: 75,
      payloadIdShort: '550e8400',
    })
  })

  it('returns identified with empty string payloadIdShort when payload_id is missing', () => {
    const resp = {
      match_state: 'marker_valid_registered',
      confidence: 0.92,
      recipient_username: 'dave',
    }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'identified',
      recipientLabel: 'dave',
      confidencePct: 92,
      payloadIdShort: '',
    })
  })

  it('returns identified with short payloadIdShort when payload_id is shorter than 8 chars', () => {
    const resp = {
      match_state: 'marker_valid_registered',
      confidence: 0.8,
      recipient_username: 'eve',
      payload_id: 'short-id',
    }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'identified',
      recipientLabel: 'eve',
      confidencePct: 80,
      payloadIdShort: 'short-id',
    })
  })

  it('clamps confidence > 1 to 100', () => {
    const resp = {
      match_state: 'marker_valid_registered',
      confidence: 1.5,
      recipient_username: 'frank',
    }
    const verdict = interpretDetectResponse(resp)
    if (verdict.kind === 'identified') {
      expect(verdict.confidencePct).toBe(100)
    }
  })

  it('clamps confidence < 0 to 0', () => {
    const resp = {
      match_state: 'marker_valid_registered',
      confidence: -0.5,
      recipient_username: 'grace',
    }
    const verdict = interpretDetectResponse(resp)
    if (verdict.kind === 'identified') {
      expect(verdict.confidencePct).toBe(0)
    }
  })

  it('treats non-numeric confidence as 0', () => {
    const resp = {
      match_state: 'marker_valid_registered',
      confidence: 'not-a-number',
      recipient_username: 'henry',
    }
    const verdict = interpretDetectResponse(resp)
    if (verdict.kind === 'identified') {
      expect(verdict.confidencePct).toBe(0)
    }
  })

  it('returns candidate verdict for marker_valid_unregistered', () => {
    const resp = {
      match_state: 'marker_valid_unregistered',
      confidence: 0.65,
      match_reason: 'signal detected but not in database',
    }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'candidate',
      confidencePct: 65,
      reason: 'signal detected but not in database',
    })
  })

  it('uses default reason for marker_valid_unregistered when match_reason is missing', () => {
    const resp = {
      match_state: 'marker_valid_unregistered',
      confidence: 0.6,
    }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'candidate',
      confidencePct: 60,
      reason: 'valid marker, no canonical record',
    })
  })

  it('returns no_marker verdict', () => {
    const resp = { match_state: 'no_marker' }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({ kind: 'no_marker' })
  })

  it('returns invalid verdict for marker_invalid_signature', () => {
    const resp = { match_state: 'marker_invalid_signature' }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'invalid',
      reason: 'marker signature did not verify',
    })
  })

  it('returns invalid verdict for marker_expired', () => {
    const resp = { match_state: 'marker_expired' }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'invalid',
      reason: 'marker payload expired',
    })
  })

  it('returns error verdict for explicit error field', () => {
    const resp = { error: 'File too large' }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'error',
      message: 'File too large',
    })
  })

  it('returns error verdict for null response', () => {
    const verdict = interpretDetectResponse(null)
    expect(verdict).toEqual({
      kind: 'error',
      message: 'No response',
    })
  })

  it('returns error verdict for undefined response', () => {
    const verdict = interpretDetectResponse(undefined)
    expect(verdict).toEqual({
      kind: 'error',
      message: 'No response',
    })
  })

  it('returns error verdict for non-object response', () => {
    const verdict = interpretDetectResponse('string response')
    expect(verdict).toEqual({
      kind: 'error',
      message: 'No response',
    })
  })

  it('returns error verdict for array response', () => {
    const verdict = interpretDetectResponse([1, 2, 3])
    expect(verdict).toEqual({
      kind: 'error',
      message: 'No response',
    })
  })

  it('returns error verdict for unknown match_state', () => {
    const resp = { match_state: 'unknown_state' }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'error',
      message: 'unexpected match_state: unknown_state',
    })
  })

  it('returns error verdict when match_state is missing', () => {
    const resp = { confidence: 0.9 }
    const verdict = interpretDetectResponse(resp)
    expect(verdict).toEqual({
      kind: 'error',
      message: 'No response',
    })
  })
})

describe('formatVerdictLine', () => {
  it('formats identified verdict with recipient and confidence', () => {
    const verdict: DetectVerdict = {
      kind: 'identified',
      recipientLabel: 'alice_test',
      confidencePct: 97,
      payloadIdShort: '550e8400',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toBe('Sent to alice_test (97% confidence)')
  })

  it('formats identified with rounded confidence', () => {
    const verdict: DetectVerdict = {
      kind: 'identified',
      recipientLabel: 'bob',
      confidencePct: 87.6,
      payloadIdShort: '550e8400',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toBe('Sent to bob (88% confidence)')
  })

  it('formats candidate verdict', () => {
    const verdict: DetectVerdict = {
      kind: 'candidate',
      confidencePct: 65.2,
      reason: 'valid marker, no canonical record',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toBe('Marker found but unregistered (65%)')
  })

  it('formats no_marker verdict', () => {
    const verdict: DetectVerdict = { kind: 'no_marker' }
    const line = formatVerdictLine(verdict)
    expect(line).toBe('No Ariadne marker found in this file.')
  })

  it('formats invalid verdict', () => {
    const verdict: DetectVerdict = {
      kind: 'invalid',
      reason: 'marker signature did not verify',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toBe('Marker invalid: marker signature did not verify')
  })

  it('formats error verdict', () => {
    const verdict: DetectVerdict = {
      kind: 'error',
      message: 'File too large',
    }
    const line = formatVerdictLine(verdict)
    expect(line).toBe('Verification failed: File too large')
  })
})


describe('interpretDetectResponse — registered without recipient (defensive)', () => {
  it('falls through to candidate when match_state is registered but no recipient label', () => {
    const verdict = interpretDetectResponse({
      match_state: 'marker_valid_registered',
      confidence: 0.93,
      payload_id: 'abcdef0123456789',
    })
    expect(verdict.kind).toBe('candidate')
    if (verdict.kind === 'candidate') {
      expect(verdict.confidencePct).toBeCloseTo(93, 5)
      expect(verdict.reason).toMatch(/recipient unresolved/i)
    }
  })

  it('falls through to candidate when recipient strings are all empty', () => {
    const verdict = interpretDetectResponse({
      match_state: 'marker_valid_registered',
      confidence: 0.5,
      recipient_username: '',
      recipient_display_name: '',
      recipient_key: '',
    })
    expect(verdict.kind).toBe('candidate')
  })

  it('does NOT fall through when at least one recipient string is non-empty', () => {
    const verdict = interpretDetectResponse({
      match_state: 'marker_valid_registered',
      confidence: 0.97,
      recipient_username: '',
      recipient_display_name: 'Alice',
      recipient_key: 'alice_test',
    })
    expect(verdict.kind).toBe('identified')
    if (verdict.kind === 'identified') {
      expect(verdict.recipientLabel).toBe('Alice')
    }
  })
})
