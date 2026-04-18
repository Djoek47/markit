/**
 * Browser-only ffmpeg.wasm trim → MP4. Dynamic import so SSR bundles stay clean.
 */
let loadPromise: Promise<Awaited<ReturnType<typeof loadFfmpegOnce>>> | null = null

async function loadFfmpegOnce() {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { fetchFile, toBlobURL } = await import('@ffmpeg/util')
  const ffmpeg = new FFmpeg()
  const coreVersion = '0.12.10'
  const baseURL = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  return { ffmpeg, fetchFile }
}

async function getFfmpeg() {
  if (!loadPromise) {
    loadPromise = loadFfmpegOnce()
  }
  return loadPromise
}

export type TrimProgress = { stage: 'load' | 'run'; pct: number; message?: string }

/**
 * Trim [startSec, endSec] and return an MP4 blob. Uses stream copy first; falls back to H.264/AAC re-encode.
 */
export async function trimVideoToMp4(
  inputBlob: Blob,
  startSec: number,
  endSec: number,
  onProgress?: (p: TrimProgress) => void,
): Promise<Blob> {
  const duration = Math.max(0.1, endSec - startSec)
  onProgress?.({ stage: 'load', pct: 0, message: 'Loading ffmpeg…' })
  const { ffmpeg, fetchFile } = await getFfmpeg()
  onProgress?.({ stage: 'load', pct: 100 })

  const inputName = 'input.bin'
  const outName = 'out.mp4'
  await ffmpeg.deleteFile(outName).catch(() => {})
  await ffmpeg.writeFile(inputName, await fetchFile(inputBlob))

  const run = async (args: string[]) => {
    await ffmpeg.exec(args)
  }

  onProgress?.({ stage: 'run', pct: 5 })
  try {
    await run([
      '-ss',
      String(startSec),
      '-i',
      inputName,
      '-t',
      String(duration),
      '-c',
      'copy',
      outName,
    ])
  } catch {
    try {
      await run([
        '-ss',
        String(startSec),
        '-i',
        inputName,
        '-t',
        String(duration),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outName,
      ])
    } catch {
      await run([
        '-ss',
        String(startSec),
        '-i',
        inputName,
        '-t',
        String(duration),
        '-c:v',
        'mpeg4',
        '-q:v',
        '8',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        outName,
      ])
    }
  }
  onProgress?.({ stage: 'run', pct: 95 })

  const raw = await ffmpeg.readFile(outName)
  if (!(raw instanceof Uint8Array)) {
    throw new Error('Unexpected ffmpeg output')
  }
  const copy = Uint8Array.from(raw)
  return new Blob([copy], { type: 'video/mp4' })
}
