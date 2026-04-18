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

/**
 * Concatenate MP4 blobs (already trimmed segments) in order. Uses concat demuxer + stream copy, then re-encode if needed.
 */
export async function concatMp4Blobs(
  parts: Blob[],
  onProgress?: (p: TrimProgress & { message?: string }) => void,
): Promise<Blob> {
  if (parts.length === 0) throw new Error('No video segments')
  if (parts.length === 1) return parts[0]

  onProgress?.({ stage: 'run', pct: 2, message: 'Concatenating segments…' })
  const { ffmpeg, fetchFile } = await getFfmpeg()

  const names: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const n = `seg${i}.mp4`
    await ffmpeg.deleteFile(n).catch(() => {})
    await ffmpeg.writeFile(n, await fetchFile(parts[i]))
    names.push(n)
  }

  const listBody = names.map((n) => `file '${n}'`).join('\n') + '\n'
  await ffmpeg.writeFile('concat.txt', listBody)
  await ffmpeg.deleteFile('joined.mp4').catch(() => {})

  const run = async (args: string[]) => {
    await ffmpeg.exec(args)
  }

  try {
    await run(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'joined.mp4'])
  } catch {
    await run([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      'concat.txt',
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
      'joined.mp4',
    ])
  }

  onProgress?.({ stage: 'run', pct: 95, message: 'Finalizing…' })
  const raw = await ffmpeg.readFile('joined.mp4')
  if (!(raw instanceof Uint8Array)) {
    throw new Error('Unexpected ffmpeg concat output')
  }
  return new Blob([Uint8Array.from(raw)], { type: 'video/mp4' })
}

export type ComposeProgress = TrimProgress & { message?: string }

