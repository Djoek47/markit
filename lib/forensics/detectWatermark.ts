import { createHash } from 'crypto'

export type DetectState = 'match' | 'no_match' | 'unknown'

export type DetectWatermarkResult = {
  state: DetectState
  confidence: number
  payloadCandidates: Array<{ payloadRef: string; score: number }>
  evidenceSummary: {
    sampledFrames: number
    contributingFrames: number
    method: 'spatial+frequency+temporal'
  }
}

export function detectWatermarkFromSignals(input: {
  extractedBitstrings: string[]
  knownPayloadRefs: string[]
}): DetectWatermarkResult {
  const sampled = input.extractedBitstrings.length
  if (!sampled) {
    return {
      state: 'unknown',
      confidence: 0,
      payloadCandidates: [],
      evidenceSummary: { sampledFrames: 0, contributingFrames: 0, method: 'spatial+frequency+temporal' },
    }
  }

  const scores = new Map<string, number>()
  for (const candidate of input.knownPayloadRefs) {
    const refSig = createHash('sha256').update(candidate).digest('hex').slice(0, 16)
    let hits = 0
    for (const b of input.extractedBitstrings) if (b.includes(refSig.slice(0, 8))) hits += 1
    scores.set(candidate, hits / sampled)
  }

  const payloadCandidates = [...scores.entries()]
    .map(([payloadRef, score]) => ({ payloadRef, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const top = payloadCandidates[0]
  if (!top) {
    return {
      state: 'no_match',
      confidence: 0.1,
      payloadCandidates: [],
      evidenceSummary: { sampledFrames: sampled, contributingFrames: 0, method: 'spatial+frequency+temporal' },
    }
  }

  const confidence = Number(Math.max(0, Math.min(1, top.score)).toFixed(4))
  const state: DetectState = confidence >= 0.85 ? 'match' : confidence >= 0.35 ? 'unknown' : 'no_match'
  return {
    state,
    confidence,
    payloadCandidates,
    evidenceSummary: {
      sampledFrames: sampled,
      contributingFrames: Math.round(sampled * top.score),
      method: 'spatial+frequency+temporal',
    },
  }
}

