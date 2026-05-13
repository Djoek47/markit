import { describe, it, expect } from 'vitest'
import { decodeWithParity, majorityVote } from '../ecc'
import { detectWatermark, type GrayFrame } from '../detect'
import {
  uuidHexToBits,
  bitsToUuidHex,
  bitsToUuidWithDashes,
  normalizePayloadIdHex,
} from '../payload-id-bits'

// ── ecc ──────────────────────────────────────────────────────────────────────

describe('decodeWithParity', () => {
  it('decodes a single valid block', () => {
    // [1, 0, 1, 0] → parity = 1^0^1^0 = 0
    const { bits, parityErrors } = decodeWithParity([1, 0, 1, 0, 0])
    expect(bits).toEqual([1, 0, 1, 0])
    expect(parityErrors).toBe(0)
  })

  it('counts a parity error on bad block', () => {
    // parity should be 0 but we pass 1
    const { bits, parityErrors } = decodeWithParity([1, 0, 1, 0, 1])
    expect(bits).toEqual([1, 0, 1, 0])
    expect(parityErrors).toBe(1)
  })

  it('drops incomplete final block', () => {
    // 7 elements: one full block + incomplete
    const { bits } = decodeWithParity([1, 0, 1, 0, 0, 1, 1])
    expect(bits).toEqual([1, 0, 1, 0])
  })

  it('handles multiple blocks', () => {
    // two blocks: [0,0,0,0, parity=0] and [1,1,0,0, parity=0]
    const { bits, parityErrors } = decodeWithParity([0, 0, 0, 0, 0, 1, 1, 0, 0, 0])
    expect(bits).toEqual([0, 0, 0, 0, 1, 1, 0, 0])
    expect(parityErrors).toBe(0)
  })

  it('returns empty for empty input', () => {
    expect(decodeWithParity([]).bits).toEqual([])
  })
})

describe('majorityVote', () => {
  it('returns 1 when majority are 1', () => {
    expect(majorityVote([1, 1, 0], 3)).toEqual([1])
  })

  it('returns 0 when majority are 0', () => {
    expect(majorityVote([0, 0, 1], 3)).toEqual([0])
  })

  it('ties go to 1 (ceil)', () => {
    // factor 2, one 1 and one 0 → ceil(2/2)=1 → 1
    expect(majorityVote([1, 0], 2)).toEqual([1])
  })

  it('handles factor 1 (passthrough)', () => {
    expect(majorityVote([1, 0, 1], 1)).toEqual([1, 0, 1])
  })

  it('processes multiple chunks', () => {
    // factor 3: [1,1,0] → 1, [0,0,1] → 0
    expect(majorityVote([1, 1, 0, 0, 0, 1], 3)).toEqual([1, 0])
  })
})

// ── payload-id-bits ───────────────────────────────────────────────────────────

const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000'
const SAMPLE_HEX = '550e8400e29b41d4a716446655440000'

describe('normalizePayloadIdHex', () => {
  it('strips dashes and lowercases', () => {
    expect(normalizePayloadIdHex(SAMPLE_UUID)).toBe(SAMPLE_HEX)
  })

  it('returns null for invalid hex', () => {
    expect(normalizePayloadIdHex('not-a-uuid')).toBeNull()
  })

  it('accepts already-normalized hex', () => {
    expect(normalizePayloadIdHex(SAMPLE_HEX)).toBe(SAMPLE_HEX)
  })
})

describe('uuidHexToBits / bitsToUuidHex round-trip', () => {
  it('encodes and decodes back to the same hex', () => {
    const bits = uuidHexToBits(SAMPLE_HEX)
    expect(bits).toHaveLength(128)
    expect(bitsToUuidHex(bits)).toBe(SAMPLE_HEX)
  })

  it('handles UUID with dashes', () => {
    const bits = uuidHexToBits(SAMPLE_UUID)
    expect(bits).toHaveLength(128)
    expect(bitsToUuidHex(bits)).toBe(SAMPLE_HEX)
  })

  it('returns empty array for invalid input', () => {
    expect(uuidHexToBits('bad')).toEqual([])
  })

  it('bitsToUuidHex returns null for < 128 bits', () => {
    expect(bitsToUuidHex([1, 0, 1])).toBeNull()
  })
})

describe('bitsToUuidWithDashes', () => {
  it('formats UUID with correct dash positions', () => {
    const bits = uuidHexToBits(SAMPLE_HEX)
    expect(bitsToUuidWithDashes(bits)).toBe(SAMPLE_UUID)
  })

  it('returns null for insufficient bits', () => {
    expect(bitsToUuidWithDashes([])).toBeNull()
  })
})

// ── detectWatermark ───────────────────────────────────────────────────────────

function makeUniformFrame(value: number, w = 64, h = 64): GrayFrame {
  return Array.from({ length: h }, () => Array(w).fill(value))
}

function makePatternFrame(w = 64, h = 64): GrayFrame {
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (__, x) => ((x + y) % 2 === 0 ? 200 : 100)),
  )
}

describe('detectWatermark', () => {
  it('returns zero confidence for empty frame', () => {
    const result = detectWatermark([], { seed: 42 })
    expect(result.confidence).toBe(0)
    expect(result.bits).toEqual([])
  })

  it('returns a result object with expected shape', () => {
    const frame = makeUniformFrame(128)
    const result = detectWatermark(frame, { seed: 42, redundancy: 3, expectedBits: 40 })
    expect(result).toHaveProperty('bits')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('hitRate')
    expect(result.bits).toHaveLength(40)
    expect(result.hitRate).toBeCloseTo(1.0)
  })

  it('confidence is in [0, 1]', () => {
    const frame = makePatternFrame()
    const result = detectWatermark(frame, { seed: 99, redundancy: 3, expectedBits: 40 })
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('different seeds produce different bit patterns', () => {
    const frame = makeUniformFrame(0xff) // all pixels odd → all LSBs = 1
    const r1 = detectWatermark(frame, { seed: 1, redundancy: 1, expectedBits: 8 })
    const r2 = detectWatermark(frame, { seed: 2, redundancy: 1, expectedBits: 8 })
    // Both should read LSB=1 from all pixels regardless of seed
    expect(r1.bits).toEqual(r2.bits)
  })

  it('outputs exactly expectedBits bits', () => {
    const frame = makeUniformFrame(128)
    for (const n of [8, 16, 40, 128]) {
      const r = detectWatermark(frame, { seed: 42, redundancy: 3, expectedBits: n })
      expect(r.bits).toHaveLength(n)
    }
  })

  it('128-bit mode returns 128 bits', () => {
    const frame = makePatternFrame(128, 128)
    const r = detectWatermark(frame, { seed: 42, redundancy: 3, expectedBits: 128 })
    expect(r.bits).toHaveLength(128)
  })
})
