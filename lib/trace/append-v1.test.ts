import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createTracePayload,
  embedAppendV1,
  extractAppendV1,
  MARKIT_TRACE_MARKER_PREFIX,
  sha256Hex,
  verifyTracePayload,
} from '@/lib/trace/append-v1'

const ORIGINAL_SECRET = process.env.MARKIT_ARIADNE_SHARED_SECRET
const ORIGINAL_TRACE = process.env.MARKIT_TRACE_SECRET
const TEST_SECRET = 'unit-test-secret-32-chars-aaaaaaa1'

beforeAll(() => {
  process.env.MARKIT_TRACE_SECRET = TEST_SECRET
})

afterAll(() => {
  if (ORIGINAL_TRACE === undefined) delete process.env.MARKIT_TRACE_SECRET
  else process.env.MARKIT_TRACE_SECRET = ORIGINAL_TRACE
  if (ORIGINAL_SECRET === undefined) delete process.env.MARKIT_ARIADNE_SHARED_SECRET
  else process.env.MARKIT_ARIADNE_SHARED_SECRET = ORIGINAL_SECRET
})

function fakeVideo(size = 1024): Buffer {
  const b = Buffer.alloc(size)
  for (let i = 0; i < size; i++) b[i] = (i * 31 + 7) & 0xff
  return b
}

describe('createTracePayload', () => {
  it('mints a v1 payload with all fields and a base64url-shaped signature', () => {
    const p = createTracePayload({ recipientLabel: 'alice_test', userId: 'user-1' })
    expect(p.v).toBe(1)
    expect(p.payloadId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(p.recipientLabel).toBe('alice_test')
    expect(p.userId).toBe('user-1')
    expect(p.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(p.sig).toMatch(/^[A-Za-z0-9_-]{43,}$/) // base64url HMAC-SHA256
  })

  it('different recipients produce different payloadIds and signatures', () => {
    const a = createTracePayload({ recipientLabel: 'alice', userId: 'u' })
    const b = createTracePayload({ recipientLabel: 'bob', userId: 'u' })
    expect(a.payloadId).not.toBe(b.payloadId)
    expect(a.sig).not.toBe(b.sig)
  })

  it('rejects empty recipient label or userId', () => {
    expect(() => createTracePayload({ recipientLabel: '', userId: 'u' })).toThrow(/recipientLabel/)
    expect(() => createTracePayload({ recipientLabel: '   ', userId: 'u' })).toThrow(/recipientLabel/)
    expect(() => createTracePayload({ recipientLabel: 'r', userId: '' })).toThrow(/userId/)
  })

  it('truncates recipientLabel to 500 chars (defense against payload bloat)', () => {
    const long = 'a'.repeat(2000)
    const p = createTracePayload({ recipientLabel: long, userId: 'u' })
    expect(p.recipientLabel.length).toBe(500)
  })

  it('respects expSec override', () => {
    const fast = createTracePayload({ recipientLabel: 'r', userId: 'u', expSec: 60 })
    const now = Math.floor(Date.now() / 1000)
    expect(fast.exp).toBeGreaterThanOrEqual(now + 59)
    expect(fast.exp).toBeLessThanOrEqual(now + 61)
  })
})

describe('verifyTracePayload', () => {
  it('returns ok on a freshly-minted payload', () => {
    const p = createTracePayload({ recipientLabel: 'r', userId: 'u' })
    const result = verifyTracePayload(p)
    expect(result.ok).toBe(true)
  })

  it('rejects a tampered recipient (signature mismatch)', () => {
    const p = createTracePayload({ recipientLabel: 'alice', userId: 'u' })
    const tampered = { ...p, recipientLabel: 'bob' }
    const result = verifyTracePayload(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.state).toBe('marker_invalid_signature')
  })

  it('rejects a tampered exp (signature mismatch — sig binds the original exp)', () => {
    const p = createTracePayload({ recipientLabel: 'alice', userId: 'u' })
    const tampered = { ...p, exp: p.exp + 1000 }
    const result = verifyTracePayload(tampered)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.state).toBe('marker_invalid_signature')
  })

  it('rejects null / undefined / wrong-shape input', () => {
    expect(verifyTracePayload(null).ok).toBe(false)
    expect(verifyTracePayload(undefined).ok).toBe(false)
    expect(verifyTracePayload({} as never).ok).toBe(false)
    expect(verifyTracePayload({ v: 2 } as never).ok).toBe(false)
  })
})

describe('embedAppendV1 + extractAppendV1', () => {
  it('round-trips a payload through a video buffer', () => {
    const video = fakeVideo(2048)
    const before = sha256Hex(video)
    const payload = createTracePayload({ recipientLabel: 'alice_test', userId: 'user-1' })
    const traced = embedAppendV1(video, payload)
    expect(sha256Hex(traced)).not.toBe(before)
    expect(traced.length).toBeGreaterThan(video.length)
    const result = extractAppendV1(traced)
    expect(result.state).toBe('marker_valid')
    if (result.state === 'marker_valid') {
      expect(result.payload.recipientLabel).toBe('alice_test')
      expect(result.payload.payloadId).toBe(payload.payloadId)
    }
  })

  it('does not mutate the input buffer', () => {
    const video = fakeVideo(512)
    const before = sha256Hex(video)
    const payload = createTracePayload({ recipientLabel: 'r', userId: 'u' })
    embedAppendV1(video, payload)
    expect(sha256Hex(video)).toBe(before)
  })

  it('returns no_marker on an un-traced buffer', () => {
    const video = fakeVideo(2048)
    const result = extractAppendV1(video)
    expect(result.state).toBe('no_marker')
    expect(result.payload).toBeNull()
  })

  it('returns no_marker on an empty buffer', () => {
    const result = extractAppendV1(Buffer.alloc(0))
    expect(result.state).toBe('no_marker')
  })

  it('last-wins when a video has multiple markers (re-traced file)', () => {
    const video = fakeVideo(2048)
    const first = createTracePayload({ recipientLabel: 'alice', userId: 'u' })
    const second = createTracePayload({ recipientLabel: 'bob', userId: 'u' })
    const onceTrace = embedAppendV1(video, first)
    const twiceTrace = embedAppendV1(onceTrace, second)
    const result = extractAppendV1(twiceTrace)
    expect(result.state).toBe('marker_valid')
    if (result.state === 'marker_valid') {
      expect(result.payload.recipientLabel).toBe('bob')
    }
  })

  it('detects tampered marker bytes as invalid_signature', () => {
    const video = fakeVideo(2048)
    const payload = createTracePayload({ recipientLabel: 'alice', userId: 'u' })
    const traced = embedAppendV1(video, payload)
    // Flip one byte inside the JSON region (after the prefix).
    const prefixIdx = traced.lastIndexOf(MARKIT_TRACE_MARKER_PREFIX)
    const flipAt = prefixIdx + MARKIT_TRACE_MARKER_PREFIX.length + 30
    const corrupted = Buffer.from(traced)
    corrupted[flipAt] = corrupted[flipAt] ^ 0x10
    const result = extractAppendV1(corrupted)
    // Could be invalid_json (if we hit a structural byte) or invalid_signature — both are correct rejections.
    expect(['marker_invalid_json', 'marker_invalid_signature']).toContain(result.state)
    expect(result.payload).toBeNull()
  })

  it('returns marker_invalid_json when the marker prefix is present but no valid JSON follows', () => {
    const garbled = Buffer.concat([fakeVideo(512), MARKIT_TRACE_MARKER_PREFIX, Buffer.from('not-json-at-all')])
    const result = extractAppendV1(garbled)
    expect(result.state).toBe('marker_invalid_json')
  })

  it('returns marker_invalid_json when the JSON has no closing brace', () => {
    const truncated = Buffer.concat([fakeVideo(512), MARKIT_TRACE_MARKER_PREFIX, Buffer.from('{"v":1,"payloadId":')])
    const result = extractAppendV1(truncated)
    expect(result.state).toBe('marker_invalid_json')
  })

  it('returns marker_invalid_signature when payload JSON is well-formed but signed with a different secret', () => {
    const video = fakeVideo(512)
    // Fake payload: looks like ours but signature is for a different secret.
    const fakePayload = { v: 1, payloadId: 'aa', recipientLabel: 'alice', userId: 'u', exp: 9999999999, sig: 'AAAA' }
    const buf = Buffer.concat([video, MARKIT_TRACE_MARKER_PREFIX, Buffer.from(JSON.stringify(fakePayload))])
    const result = extractAppendV1(buf)
    expect(result.state).toBe('marker_invalid_signature')
  })
})

describe('marker_expired path', () => {
  it('extractAppendV1 returns marker_expired for a payload whose exp has passed', async () => {
    // Construct a payload with exp in the past, but signed correctly with our secret.
    const video = fakeVideo(512)
    const past = Math.floor(Date.now() / 1000) - 3600
    const payloadId = '11111111-1111-1111-1111-111111111111'
    const recipientLabel = 'alice'
    const userId = 'u'
    // Manually compute the signing message + sig using the test secret.
    const { createHmac } = await import('crypto')
    const message = [payloadId, recipientLabel, userId, String(past), 'v1'].join('|')
    const sig = createHmac('sha256', TEST_SECRET).update(message, 'utf8').digest('base64url')
    const expiredPayload = { v: 1, payloadId, recipientLabel, userId, exp: past, sig }
    const buf = Buffer.concat([video, MARKIT_TRACE_MARKER_PREFIX, Buffer.from(JSON.stringify(expiredPayload))])
    const result = extractAppendV1(buf)
    expect(result.state).toBe('marker_expired')
    expect(result.payload).toBeNull()
  })
})

describe('secret resolution', () => {
  it('throws when neither MARKIT_TRACE_SECRET nor MARKIT_ARIADNE_SHARED_SECRET is configured', () => {
    const t = process.env.MARKIT_TRACE_SECRET
    const a = process.env.MARKIT_ARIADNE_SHARED_SECRET
    delete process.env.MARKIT_TRACE_SECRET
    delete process.env.MARKIT_ARIADNE_SHARED_SECRET
    try {
      expect(() => createTracePayload({ recipientLabel: 'r', userId: 'u' })).toThrow(/MARKIT_TRACE_SECRET/)
    } finally {
      if (t !== undefined) process.env.MARKIT_TRACE_SECRET = t
      if (a !== undefined) process.env.MARKIT_ARIADNE_SHARED_SECRET = a
    }
  })

  it('falls back to MARKIT_ARIADNE_SHARED_SECRET when MARKIT_TRACE_SECRET is unset', () => {
    const t = process.env.MARKIT_TRACE_SECRET
    delete process.env.MARKIT_TRACE_SECRET
    process.env.MARKIT_ARIADNE_SHARED_SECRET = TEST_SECRET
    try {
      const p = createTracePayload({ recipientLabel: 'r', userId: 'u' })
      const v = verifyTracePayload(p)
      expect(v.ok).toBe(true)
    } finally {
      if (t !== undefined) process.env.MARKIT_TRACE_SECRET = t
      else delete process.env.MARKIT_TRACE_SECRET
      process.env.MARKIT_TRACE_SECRET = TEST_SECRET
    }
  })

  it('rejects secrets shorter than 16 chars', () => {
    const t = process.env.MARKIT_TRACE_SECRET
    process.env.MARKIT_TRACE_SECRET = 'short'
    try {
      expect(() => createTracePayload({ recipientLabel: 'r', userId: 'u' })).toThrow(/16 chars/)
    } finally {
      process.env.MARKIT_TRACE_SECRET = t!
    }
  })
})
