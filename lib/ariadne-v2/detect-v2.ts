/**
 * Standalone Ariadne v2 screenshot/image detector — no Creatix dependency.
 * Ported algorithm from Creatix lib/ariadne/detect-v2.ts.
 *
 * KEY DIFFERENCE FROM CREATIX VERSION:
 * Creatix's runDetectV2 samples raw bytes from the buffer directly — that works
 * for raw frame data but NOT for compressed PNG/JPEG/WebP (which has DCT
 * coefficients, not pixel values, in its raw bytes).
 * This version uses `sharp` to decode compressed images to raw grayscale pixels
 * before running the detector, so it works correctly on screenshots.
 */
import { createHash } from 'crypto'
import sharp from 'sharp'
import { detectWatermark, type GrayFrame } from './detect'
import { bitsToUuidWithDashes } from './payload-id-bits'

export type DetectV2Result = {
  match_state: 'none' | 'candidate'
  payload_candidates: Array<{
    payload_id: string
    confidence: number
    source: 'watermark_v2' | 'watermark_v2_uuid'
  }>
  confidence: number
  evidence_summary: {
    sampled_frames: number
    contributing_regions: number
    watermark_hit_rate: number
  }
}

function bufferToGrayFrame(data: Buffer, width: number, height: number): GrayFrame {
  const frame: GrayFrame = []
  for (let y = 0; y < height; y++) {
    const row: number[] = []
    for (let x = 0; x < width; x++) {
      row.push(data[y * width + x] ?? 0)
    }
    frame.push(row)
  }
  return frame
}

/**
 * Tile a single decoded image into a grid of sub-frames so the detector can
 * sample multiple "regions" — mirrors how Creatix samples multiple video frames.
 * For a screenshot, the same watermark is spread across the whole image, so
 * slicing it into tiles gives independent samples.
 */
function tileIntoFrames(data: Buffer, width: number, height: number, tiles = 4): GrayFrame[] {
  const frames: GrayFrame[] = []
  // Full image as one frame
  frames.push(bufferToGrayFrame(data, width, height))
  // Quadrant tiles
  if (tiles > 1 && width >= 8 && height >= 8) {
    const hw = Math.floor(width / 2)
    const hh = Math.floor(height / 2)
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const tile: GrayFrame = []
        for (let y = ty * hh; y < (ty + 1) * hh; y++) {
          const row: number[] = []
          for (let x = tx * hw; x < (tx + 1) * hw; x++) {
            row.push(data[y * width + x] ?? 0)
          }
          tile.push(row)
        }
        frames.push(tile)
      }
    }
  }
  return frames
}

function bitsToHex(bits: number[]): string {
  const bytes: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0
    for (let b = 0; b < 8; b++) value = (value << 1) | (bits[i + b] ? 1 : 0)
    bytes.push(value)
  }
  return Buffer.from(bytes).toString('hex')
}

/**
 * Detect Ariadne v2 watermark in a compressed image (PNG/JPEG/WebP).
 * Uses sharp to decode to raw grayscale pixels — required for correct LSB reading.
 */
export async function detectV2FromImage(buf: Buffer, seed = 42): Promise<DetectV2Result> {
  // Decode to raw grayscale pixels
  const { data, info } = await sharp(buf)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const frames = tileIntoFrames(data, width, height, 4)

  return runDetectOnFrames(frames, seed)
}

function runDetectOnFrames(frames: GrayFrame[], seed: number): DetectV2Result {
  const scores = frames.map((f) => detectWatermark(f, { seed, redundancy: 3, expectedBits: 40 }))
  const scores128 = frames.map((f) => detectWatermark(f, { seed, redundancy: 3, expectedBits: 128 }))

  const avgConfidence = scores.reduce((acc, s) => acc + s.confidence, 0) / Math.max(1, scores.length)
  const avgHit = scores.reduce((acc, s) => acc + s.hitRate, 0) / Math.max(1, scores.length)
  const best = [...scores].sort((a, b) => b.confidence - a.confidence)[0]
  const best128 = [...scores128].sort((a, b) => b.confidence - a.confidence)[0]

  const uuidFromVisual =
    best128 && best128.bits.length >= 128
      ? bitsToUuidWithDashes(best128.bits.slice(0, 128))
      : null

  const watermarkCandidate = best ? bitsToHex(best.bits) : ''
  const watermarkPayloadId =
    uuidFromVisual ||
    (watermarkCandidate
      ? `wmv2_${createHash('sha256').update(watermarkCandidate).digest('hex').slice(0, 24)}`
      : '')

  const payload_candidates: DetectV2Result['payload_candidates'] = []
  if (watermarkPayloadId) {
    payload_candidates.push({
      payload_id: watermarkPayloadId,
      confidence: Number((uuidFromVisual ? best128?.confidence ?? avgConfidence : avgConfidence).toFixed(4)),
      source: uuidFromVisual ? 'watermark_v2_uuid' : 'watermark_v2',
    })
  }

  const match_state: DetectV2Result['match_state'] = payload_candidates.length ? 'candidate' : 'none'
  const visualConf = uuidFromVisual && best128 ? best128.confidence : avgConfidence
  const confidence = Number(visualConf.toFixed(4))

  return {
    match_state,
    payload_candidates,
    confidence,
    evidence_summary: {
      sampled_frames: frames.length,
      contributing_regions: frames.length * 2,
      watermark_hit_rate: Number(avgHit.toFixed(4)),
    },
  }
}
