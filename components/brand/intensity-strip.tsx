'use client'

import { useMemo } from 'react'

export type IntensityPoint = {
  tSec: number
  score: number
}

type IntensityStripProps = {
  /** Array of { tSec, score 0..1 } samples — may be empty while scanning */
  points: IntensityPoint[]
  /** Total duration of the media in seconds */
  durationSec: number
  /** Current playhead position — renders a thin marker line */
  playheadSec?: number
  /** Height of the strip in px (default 28) */
  height?: number
  className?: string
}

/**
 * Horizontal intensity heat-map strip. Uses CSS variables only; works in both themes.
 * Renders as a series of vertical bars whose height encodes intensity (0..1).
 * A thin playhead line overlays the current position.
 */
export function IntensityStrip({
  points,
  durationSec,
  playheadSec,
  height = 28,
  className,
}: IntensityStripProps) {
  const bars = useMemo(() => {
    if (points.length === 0 || durationSec <= 0) return []
    return points.map((p) => ({
      pct: durationSec > 0 ? Math.min(1, Math.max(0, p.tSec / durationSec)) : 0,
      score: Math.min(1, Math.max(0, p.score)),
    }))
  }, [points, durationSec])

  const playheadPct =
    playheadSec != null && durationSec > 0
      ? Math.min(1, Math.max(0, playheadSec / durationSec))
      : null

  return (
    <div
      role="img"
      aria-label="Intensity timeline"
      className={`relative w-full overflow-hidden rounded-sm ${className ?? ''}`}
      style={{
        height,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-soft)',
      }}
    >
      {/* Intensity bars */}
      {bars.map((b, i) => (
        <div
          key={i}
          className="absolute bottom-0"
          style={{
            left: `${b.pct * 100}%`,
            width: `${Math.max(1, 100 / Math.max(bars.length, 1))}%`,
            height: `${Math.round(b.score * 100)}%`,
            background:
              b.score > 0.75
                ? 'color-mix(in oklch, var(--destructive) 85%, var(--accent))'
                : b.score > 0.45
                  ? 'color-mix(in oklch, var(--accent) 70%, var(--circe))'
                  : 'color-mix(in oklch, var(--accent) 40%, transparent)',
            opacity: 0.82,
            borderRadius: '1px 1px 0 0',
          }}
        />
      ))}

      {/* Empty state shimmer */}
      {bars.length === 0 && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--accent-soft) 60%, transparent) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'mk-shimmer 1.6s linear infinite',
          }}
        />
      )}

      {/* Playhead marker */}
      {playheadPct !== null && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: `${playheadPct * 100}%`,
            width: 1,
            background: 'var(--foreground)',
            opacity: 0.7,
          }}
        />
      )}
    </div>
  )
}
