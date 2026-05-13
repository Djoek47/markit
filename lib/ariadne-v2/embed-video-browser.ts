'use client'

/**
 * Browser-side v2 video watermarking.
 * No server, no Creatix, no ffmpeg.
 *
 * Uses Canvas + MediaRecorder:
 *   1. Play video into a hidden <video> element
 *   2. Each animation frame: drawImage → read pixels → apply LSB watermark → putImageData
 *   3. canvas.captureStream() → MediaRecorder → watermarked video Blob
 *
 * Output is WebM (browser MediaRecorder default). Can be detected by /detect
 * after screenshotting any frame.
 */

import { encodeWithParity, repeatBits } from './ecc'
import { uuidHexToBits, normalizePayloadIdHex } from './payload-id-bits'

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s
  }
}

/** Apply LSB watermark directly to a Uint8ClampedArray of RGBA pixels. */
function applyWatermarkToPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  payloadId: string,
  seed = 42,
  redundancy = 3,
) {
  const hex = normalizePayloadIdHex(payloadId)
  if (!hex) return
  const bits = uuidHexToBits(hex)
  const encoded = repeatBits(encodeWithParity(bits), redundancy)
  const rand = lcg(seed)

  for (let i = 0; i < encoded.length; i++) {
    const y = 2 + (rand() % Math.max(1, height - 4))
    const x = 2 + (rand() % Math.max(1, width - 4))
    const idx = (y * width + x) * 4 // RGBA — use R channel
    const current = pixels[idx]
    if (current === undefined) continue
    const targetParity = encoded[i] ? 1 : 0
    const currentParity = current & 1
    if (currentParity !== targetParity) {
      pixels[idx] = Math.max(0, Math.min(255, current + 1))
    }
    // spatial layer on green channel
    const nY = Math.min(height - 1, y + 1)
    const nX = Math.min(width - 1, x + 1)
    const nIdx = (nY * width + nX) * 4 + 1
    const n = pixels[nIdx]
    if (n !== undefined) {
      pixels[nIdx] = Math.max(0, Math.min(255, encoded[i] ? n + 1 : n - 1))
    }
  }
}

export type WatermarkVideoProgress = {
  stage: 'loading' | 'processing' | 'encoding' | 'done'
  percent: number
}

/**
 * Watermark a video Blob client-side using Canvas + MediaRecorder.
 * Returns a new Blob (WebM) with the LSB watermark embedded in every frame.
 */
export async function watermarkVideoInBrowser(
  inputBlob: Blob,
  payloadId: string,
  onProgress?: (p: WatermarkVideoProgress) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(inputBlob)

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = objectUrl

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) { reject(new Error('Canvas 2D not supported')); return }

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Video failed to load'))
    }

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 360
      onProgress?.({ stage: 'loading', percent: 10 })

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : ''

      const stream = canvas.captureStream(30)
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      recorder.onstop = () => {
        URL.revokeObjectURL(objectUrl)
        onProgress?.({ stage: 'done', percent: 100 })
        resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }))
      }

      recorder.onerror = (e) => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error(`MediaRecorder error: ${(e as ErrorEvent).message ?? 'unknown'}`))
      }

      const duration = video.duration || 0

      const drawFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop()
          return
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        applyWatermarkToPixels(imageData.data, canvas.width, canvas.height, payloadId)
        ctx.putImageData(imageData, 0, 0)

        if (duration > 0) {
          const pct = 15 + Math.round((video.currentTime / duration) * 75)
          onProgress?.({ stage: 'processing', percent: pct })
        }

        requestAnimationFrame(drawFrame)
      }

      recorder.start(500) // collect data every 500ms
      onProgress?.({ stage: 'processing', percent: 15 })

      video.play()
        .then(() => requestAnimationFrame(drawFrame))
        .catch(reject)
    }
  })
}
