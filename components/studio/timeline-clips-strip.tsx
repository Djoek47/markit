'use client'

import type { TimelineSegment } from '@/lib/timeline-project'
import type { RefObject } from 'react'

type Props = {
  duration: number
  currentTime: number
  segments: TimelineSegment[]
  onSegmentsChange: (next: TimelineSegment[]) => void
  videoRef: RefObject<HTMLVideoElement | null>
  hasSecondaryImport: boolean
  disabled: boolean
  onSeek: (sec: number) => void
}

function fmt(sec: number) {
  if (!Number.isFinite(sec)) return '0'
  return sec < 60 ? sec.toFixed(1) : `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`
}

export function TimelineClipsStrip({
  duration,
  currentTime,
  segments,
  onSegmentsChange,
  videoRef,
  hasSecondaryImport,
  disabled,
  onSeek,
}: Props) {
  const d = duration > 0 ? duration : 1

  const addAtPlayhead = () => {
    const v = videoRef.current
    const t = v ? v.currentTime : currentTime
    const start = Math.max(0, Math.min(t, d - 0.1))
    const end = Math.min(d, start + Math.min(5, d - start))
    if (end <= start + 0.05) return
    const next: TimelineSegment = {
      id: crypto.randomUUID(),
      startSec: start,
      endSec: Math.max(start + 0.1, end),
      source: 'primary',
    }
    if (segments.length >= 24) return
    onSegmentsChange([...segments, next])
  }

  const barClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width)
    const t = (x / rect.width) * d
    onSeek(t)
  }

  return (
    <div className="mb-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
          Clip list
        </span>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={disabled || duration <= 0}
            onClick={addAtPlayhead}
            className="rounded border border-[var(--border)] px-2 py-0.5 text-[10px] hover:bg-white/5 disabled:opacity-40"
          >
            Add clip @ playhead
          </button>
        </div>
      </div>

      <div
        role="presentation"
        className="relative h-8 cursor-pointer rounded border border-[var(--border)] bg-black/30"
        onClick={barClick}
      >
        {duration > 0
          ? segments.map((s) => {
              const left = (s.startSec / d) * 100
              const w = ((s.endSec - s.startSec) / d) * 100
              return (
                <div
                  key={s.id}
                  title={`${fmt(s.startSec)}–${fmt(s.endSec)}${s.source === 'secondary' ? ' · B' : ''}`}
                  className="absolute bottom-0.5 top-0.5 rounded-sm border border-[var(--studio-accent)]/50"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(w, 0.5)}%`,
                    background: s.source === 'secondary' ? 'oklch(0.45 0.12 290 / 0.5)' : 'var(--studio-accent-muted)',
                  }}
                />
              )
            })
          : null}
        {duration > 0 ? (
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-[var(--studio-accent)]"
            style={{ left: `${(currentTime / d) * 100}%`, boxShadow: '0 0 6px var(--studio-accent)' }}
          />
        ) : null}
      </div>

      {segments.length > 0 ? (
        <ul className="max-h-32 space-y-1 overflow-y-auto text-[10px]">
          {segments.map((s, i) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-1 rounded border border-[var(--border)] bg-black/20 px-1 py-1"
            >
              <span style={{ color: 'var(--muted-foreground)' }}>#{i + 1}</span>
              <label className="flex items-center gap-0.5">
                <span className="w-6">In</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  disabled={disabled}
                  className="w-14 rounded border border-[var(--border)] bg-black/40 px-1 font-mono"
                  value={Number(s.startSec.toFixed(2))}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    onSegmentsChange(
                      segments.map((x) =>
                        x.id === s.id ? { ...x, startSec: v, endSec: Math.max(v + 0.05, x.endSec) } : x,
                      ),
                    )
                  }}
                />
              </label>
              <label className="flex items-center gap-0.5">
                <span className="w-8">Out</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  disabled={disabled}
                  className="w-14 rounded border border-[var(--border)] bg-black/40 px-1 font-mono"
                  value={Number(s.endSec.toFixed(2))}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    onSegmentsChange(
                      segments.map((x) => (x.id === s.id ? { ...x, endSec: Math.max(x.startSec + 0.05, v) } : x)),
                    )
                  }}
                />
              </label>
              {hasSecondaryImport ? (
                <select
                  disabled={disabled}
                  className="rounded border border-[var(--border)] bg-black/40 px-1 py-0.5 text-[10px]"
                  value={s.source === 'secondary' ? 'secondary' : 'primary'}
                  onChange={(e) => {
                    const src = e.target.value === 'secondary' ? 'secondary' : 'primary'
                    onSegmentsChange(
                      segments.map((x) => (x.id === s.id ? { ...x, source: src } : x)),
                    )
                  }}
                >
                  <option value="primary">A cam</option>
                  <option value="secondary">B cam</option>
                </select>
              ) : null}
              <button
                type="button"
                disabled={disabled || i === 0}
                className="rounded px-1 hover:bg-white/10 disabled:opacity-30"
                onClick={() => {
                  const next = [...segments]
                  ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                  onSegmentsChange(next)
                }}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={disabled || i === segments.length - 1}
                className="rounded px-1 hover:bg-white/10 disabled:opacity-30"
                onClick={() => {
                  const next = [...segments]
                  ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
                  onSegmentsChange(next)
                }}
              >
                ↓
              </button>
              <button
                type="button"
                disabled={disabled}
                className="ml-auto text-red-400/90 hover:underline"
                onClick={() => onSegmentsChange(segments.filter((x) => x.id !== s.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
          Add clips to build a compilation order. Export joins them in list order.
        </p>
      )}
    </div>
  )
}
