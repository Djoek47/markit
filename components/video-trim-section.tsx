'use client'

import { useCallback, useEffect, useState } from 'react'
import { trimVideoToMp4, type TrimProgress } from '@/lib/ffmpeg-trim'

type Props = {
  importUrl: string
  disabled: boolean
  onTrimmedExport: (file: File) => Promise<void>
}

export function VideoTrimSection({ importUrl, disabled, onTrimmedExport }: Props) {
  const [duration, setDuration] = useState(0)
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(0)
  const [trimBusy, setTrimBusy] = useState(false)
  const [trimMsg, setTrimMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState<TrimProgress | null>(null)

  useEffect(() => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.crossOrigin = 'anonymous'
    v.src = importUrl
    const onMeta = () => {
      const d = v.duration
      if (Number.isFinite(d) && d > 0) {
        setDuration(d)
        setStartSec(0)
        setEndSec(d)
      }
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('error', () => setTrimMsg('Could not read video duration (CORS or format).'))
    return () => {
      v.removeEventListener('loadedmetadata', onMeta)
    }
  }, [importUrl])

  const runTrim = useCallback(async () => {
    if (!importUrl || disabled || trimBusy) return
    if (endSec <= startSec) {
      setTrimMsg('End time must be greater than start time.')
      return
    }
    setTrimBusy(true)
    setTrimMsg(null)
    setProgress({ stage: 'load', pct: 0 })
    try {
      const res = await fetch(importUrl, { method: 'GET', mode: 'cors' })
      if (!res.ok) throw new Error(`Could not fetch source (${res.status})`)
      const blob = await res.blob()
      setProgress({ stage: 'run', pct: 10 })
      const out = await trimVideoToMp4(blob, startSec, endSec, setProgress)
      const file = new File([out], 'markit-trim.mp4', { type: 'video/mp4' })
      await onTrimmedExport(file)
      setTrimMsg('Trimmed file uploaded to your vault.')
    } catch (e) {
      setTrimMsg(e instanceof Error ? e.message : 'Trim failed')
    } finally {
      setTrimBusy(false)
      setProgress(null)
    }
  }, [disabled, endSec, importUrl, onTrimmedExport, startSec, trimBusy])

  if (!importUrl) return null

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <h3 className="font-serif-display mb-2 text-base font-semibold">Trim (in browser)</h3>
      <p className="mb-3 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
        Uses ffmpeg.wasm in your browser. First load downloads the encoder (~25MB). Export runs the same vault upload
        as &quot;Upload edited file&quot;.
      </p>
      {duration > 0 ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs">
            <span className="text-muted-foreground block">Start (s)</span>
            <input
              type="number"
              min={0}
              max={duration}
              step={0.1}
              value={startSec}
              onChange={(e) => setStartSec(Number(e.target.value))}
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'oklch(0.1 0.01 285)' }}
            />
          </label>
          <label className="text-xs">
            <span className="text-muted-foreground block">End (s)</span>
            <input
              type="number"
              min={0}
              max={duration}
              step={0.1}
              value={endSec}
              onChange={(e) => setEndSec(Number(e.target.value))}
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
              style={{ borderColor: 'var(--border)', background: 'oklch(0.1 0.01 285)' }}
            />
          </label>
        </div>
      ) : (
        <p className="text-muted-foreground mb-2 text-xs">Reading duration…</p>
      )}
      {progress ? (
        <p className="mb-2 text-xs" style={{ color: 'var(--circe-light)' }}>
          {progress.stage === 'load' ? 'Loading encoder…' : `Processing… ${progress.pct}%`}
          {progress.message ? ` ${progress.message}` : ''}
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled || trimBusy || duration <= 0}
        onClick={() => void runTrim()}
        className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
      >
        {trimBusy ? 'Trimming…' : 'Trim & upload to vault'}
      </button>
      {trimMsg ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {trimMsg}
        </p>
      ) : null}
    </div>
  )
}
