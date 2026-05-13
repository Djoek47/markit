/**
 * Frame-level watermark embedder — ported from Creatix lib/ariadne/watermark-engine/embed.ts.
 * Algorithm is identical: LCG-seeded position selection, LSB pixel writes, parity + repeat encoding.
 */
import { encodeWithParity, repeatBits } from './ecc'
import { uuidHexToBits, normalizePayloadIdHex } from './payload-id-bits'
import type { GrayFrame } from './detect'

export type WatermarkEmbedOptions = {
  seed?: number
  strength?: number
  redundancy?: number
  useSpatialLayer?: boolean
}

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s
  }
}

function cloneFrame(frame: GrayFrame): GrayFrame {
  return frame.map((row) => [...row])
}

/**
 * Embed payload bits into a single grayscale frame using pseudo-DCT LSB writes.
 * Returns a new frame with the watermark applied — original is not mutated.
 */
export function embedWatermark(
  inputFrame: GrayFrame,
  payloadBits: number[],
  options: WatermarkEmbedOptions = {},
): GrayFrame {
  const frame = cloneFrame(inputFrame)
  if (!frame.length || !frame[0]?.length) return frame
  const h = frame.length
  const w = frame[0].length
  const seed = options.seed ?? 42
  const strength = Math.max(1, Math.floor(options.strength ?? 1))
  const redundancy = Math.max(1, Math.floor(options.redundancy ?? 3))
  const useSpatialLayer = options.useSpatialLayer ?? true
  const rand = lcg(seed)
  const encoded = repeatBits(encodeWithParity(payloadBits), redundancy)

  for (let i = 0; i < encoded.length; i++) {
    const y = 2 + (rand() % Math.max(1, h - 4))
    const x = 2 + (rand() % Math.max(1, w - 4))
    const current = frame[y]?.[x] ?? 0
    const targetParity = encoded[i] ? 1 : 0
    const currentParity = current & 1
    const delta = currentParity === targetParity ? 0 : strength
    frame[y][x] = Math.max(0, Math.min(255, current + delta))

    if (useSpatialLayer) {
      const nY = Math.min(h - 1, y + 1)
      const nX = Math.min(w - 1, x + 1)
      const n = frame[nY]?.[nX] ?? 0
      frame[nY][nX] = Math.max(0, Math.min(255, encoded[i] ? n + 1 : n - 1))
    }
  }

  return frame
}

/**
 * Build the 128-bit payload from a UUID (with or without dashes).
 * Throws if the payloadId is not a valid UUID/hex.
 */
export function buildPayloadBits(payloadId: string): number[] {
  const hex = normalizePayloadIdHex(payloadId)
  if (!hex) throw new Error(`Invalid payloadId: ${payloadId}`)
  return uuidHexToBits(hex)
}
