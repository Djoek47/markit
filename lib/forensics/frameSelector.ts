export type FrameRegion = { x: number; y: number; w: number; h: number }

export type FrameCandidate = {
  frameIndex: number
  second: number
  motionScore: number
  faceScore: number
  stabilityScore: number
  selectedRegion: FrameRegion
}

export type FrameSelectorOptions = {
  sampleEverySec?: number
  width: number
  height: number
}

function pseudoFaceScore(frameIndex: number): number {
  return ((frameIndex * 37) % 100) / 100
}

function pseudoMotionScore(frameIndex: number): number {
  return ((frameIndex * 17 + 11) % 100) / 100
}

export function selectEmbeddingFrames(
  durationSec: number,
  fps: number,
  options: FrameSelectorOptions,
): FrameCandidate[] {
  const sampleEverySec = Math.max(1, options.sampleEverySec ?? 2)
  const maxFrame = Math.max(1, Math.floor(durationSec * Math.max(1, fps)))
  const candidates: FrameCandidate[] = []

  for (let sec = 0; sec < durationSec; sec += sampleEverySec) {
    const frameIndex = Math.min(maxFrame - 1, Math.floor(sec * fps))
    const face = pseudoFaceScore(frameIndex)
    const motion = pseudoMotionScore(frameIndex)
    const stability = Math.max(0, 1 - (face * 0.55 + motion * 0.45))
    const region: FrameRegion = {
      x: Math.floor(options.width * 0.2),
      y: Math.floor(options.height * 0.2),
      w: Math.floor(options.width * 0.6),
      h: Math.floor(options.height * 0.6),
    }
    candidates.push({
      frameIndex,
      second: sec,
      motionScore: motion,
      faceScore: face,
      stabilityScore: stability,
      selectedRegion: region,
    })
  }

  return candidates.sort((a, b) => b.stabilityScore - a.stabilityScore)
}

