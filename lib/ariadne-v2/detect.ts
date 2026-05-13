/**
 * Frame-level watermark detector — ported from Creatix lib/ariadne/watermark-engine/detect.ts.
 * Algorithm is identical: LCG-seeded position selection, LSB pixel reads, majority vote, parity decode.
 */
import { decodeWithParity, majorityVote } from './ecc'

export type GrayFrame = number[][]

export type WatermarkDetectOptions = {
  seed: number
  redundancy?: number
  expectedBits?: number
}

export type WatermarkDetectResult = {
  bits: number[]
  confidence: number
  hitRate: number
}

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s
  }
}

export function detectWatermark(inputFrame: GrayFrame, options: WatermarkDetectOptions): WatermarkDetectResult {
  if (!inputFrame.length || !inputFrame[0]?.length) return { bits: [], confidence: 0, hitRate: 0 }
  const h = inputFrame.length
  const w = inputFrame[0].length
  const redundancy = Math.max(1, Math.floor(options.redundancy ?? 3))
  const expected = Math.max(1, options.expectedBits ?? 40)
  const encodedLength = Math.ceil(expected / 4) * 5
  const repeatedLength = encodedLength * redundancy
  const rand = lcg(options.seed)
  const observed: number[] = []
  let validReads = 0

  for (let i = 0; i < repeatedLength; i++) {
    const y = 2 + (rand() % Math.max(1, h - 4))
    const x = 2 + (rand() % Math.max(1, w - 4))
    const px = inputFrame[y]?.[x]
    if (typeof px === 'number') {
      observed.push(px & 1 ? 1 : 0)
      validReads += 1
    }
  }

  const voted = majorityVote(observed, redundancy)
  const decoded = decodeWithParity(voted)
  const parityScore = Math.max(0, 1 - decoded.parityErrors / Math.max(1, Math.ceil(voted.length / 5)))
  const hitRate = validReads / Math.max(1, repeatedLength)
  const confidence = Math.max(0, Math.min(1, 0.65 * parityScore + 0.35 * hitRate))
  return {
    bits: decoded.bits.slice(0, expected),
    confidence,
    hitRate,
  }
}
