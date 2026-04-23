import { createHash } from 'crypto'

export type WatermarkEmbedOptions = {
  temporalStrideSec?: number
  redundancy?: number
  dctStrength?: number
  spatialStrength?: number
}

export type WatermarkSignal = {
  payloadRef: string
  bits: number[]
}

function bitsFromHex(hex: string): number[] {
  const out: number[] = []
  for (const ch of hex) {
    const n = Number.parseInt(ch, 16)
    for (let i = 3; i >= 0; i--) out.push((n >> i) & 1)
  }
  return out
}

export function payloadToSignal(payloadRef: string): WatermarkSignal {
  const digest = createHash('sha256').update(payloadRef).digest('hex')
  return { payloadRef, bits: bitsFromHex(digest.slice(0, 32)) }
}

/**
 * Spatial + pseudo-frequency + temporal scheduling descriptor.
 * Actual pixel math is executed by ffmpeg worker hooks.
 */
export function buildWatermarkEmbeddingPlan(
  payloadRef: string,
  frameCount: number,
  fps: number,
  options?: WatermarkEmbedOptions,
) {
  const signal = payloadToSignal(payloadRef)
  const strideSec = Math.max(1, options?.temporalStrideSec ?? 2)
  const strideFrames = Math.max(1, Math.floor(strideSec * Math.max(1, fps)))
  const redundancy = Math.max(1, options?.redundancy ?? 3)
  const windows: Array<{ frame: number; layer: 'spatial' | 'frequency'; strength: number; bitIndex: number }> = []

  let bitIndex = 0
  for (let f = 0; f < frameCount; f += strideFrames) {
    for (let r = 0; r < redundancy; r++) {
      windows.push({
        frame: Math.min(frameCount - 1, f + r),
        layer: 'frequency',
        strength: options?.dctStrength ?? 1,
        bitIndex: bitIndex % signal.bits.length,
      })
      windows.push({
        frame: Math.min(frameCount - 1, f + r),
        layer: 'spatial',
        strength: options?.spatialStrength ?? 1,
        bitIndex: bitIndex % signal.bits.length,
      })
      bitIndex += 1
    }
  }

  return {
    payloadRef,
    frameCount,
    strideFrames,
    redundancy,
    windows,
    signalBits: signal.bits.length,
  }
}

