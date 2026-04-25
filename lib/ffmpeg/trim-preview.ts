/**
 * Single browser entry for trim preview: dynamic-imports the heavy `ffmpeg-trim` module
 * so the main editor chunk does not pull ffmpeg.wasm until preview runs.
 */
export type TrimPreviewParams = {
  inputBlob: Blob
  inSec: number
  outSec: number
}

export async function trimPreview(params: TrimPreviewParams): Promise<Blob | null> {
  const { inputBlob, inSec, outSec } = params
  if (!Number.isFinite(inSec) || !Number.isFinite(outSec) || outSec <= inSec) return null
  const { trimVideoToMp4 } = await import('@/lib/ffmpeg-trim')
  return trimVideoToMp4(inputBlob, inSec, outSec)
}
