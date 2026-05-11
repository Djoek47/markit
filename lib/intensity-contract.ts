// ─── Intensity contract — media intensity scan result ────────────────────────

export type IntensityPeakKind = 'intense' | 'climax'

export type IntensityPeak = {
  /** Time of the peak in seconds from the start of the media. */
  tSec: number
  /** Normalized intensity score, 0..1. */
  score: number
  kind: IntensityPeakKind
}

export type IntensityScan = {
  /** Per-sample intensity curve, each value 0..1. Parallel to `timestamps`. */
  curve: number[]
  /** Per-sample timestamp in seconds. Parallel to `curve`. */
  timestamps: number[]
  peaks: IntensityPeak[]
  /** Semver of the intensity scanner that produced this result. */
  scannerVersion: string
  /** ISO 8601 timestamp when the scan ran. */
  scannedAt: string
  detectorMode: 'fast' | 'methodical' | 'ml'
}

export type IntensityScanValid = { ok: true; scan: IntensityScan }
export type IntensityScanInvalid = { ok: false; details: string[] }
export type IntensityScanResult = IntensityScanValid | IntensityScanInvalid

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the highest mean-intensity window of `targetSec` duration.
 * Returns the window's start/end in seconds and its mean score, or null if
 * the scan has no data or targetSec exceeds the scan duration.
 */
export function findHighestIntensityWindow(
  scan: IntensityScan,
  targetSec: number,
): { startSec: number; endSec: number; meanScore: number } | null {
  if (scan.curve.length === 0 || scan.timestamps.length === 0 || targetSec <= 0) return null

  const totalDuration = scan.timestamps[scan.timestamps.length - 1]
  if (targetSec > totalDuration) return null

  // Sliding window by index
  const n = scan.curve.length
  let bestStart = 0
  let bestMean = -1
  let windowStart = 0
  let windowSum = 0

  for (let i = 0; i < n; i++) {
    windowSum += scan.curve[i]
    while (windowStart < i && scan.timestamps[i] - scan.timestamps[windowStart] > targetSec) {
      windowSum -= scan.curve[windowStart]
      windowStart++
    }
    const windowLen = i - windowStart + 1
    const mean = windowSum / windowLen
    if (mean > bestMean) {
      bestMean = mean
      bestStart = windowStart
    }
  }

  const startSec = scan.timestamps[bestStart]
  const endSec = Math.min(startSec + targetSec, totalDuration)

  return { startSec, endSec, meanScore: bestMean }
}

/**
 * Pick the latest climax peak, or null if none exist.
 * "Latest" so that trailing content can be trimmed to end on the climax.
 */
export function pickClimax(scan: IntensityScan): IntensityPeak | null {
  const climaxes = scan.peaks.filter((p) => p.kind === 'climax')
  if (climaxes.length === 0) return null
  return climaxes.reduce((latest, p) => (p.tSec > latest.tSec ? p : latest))
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateIntensityScan(value: unknown): IntensityScanResult {
  const issues: string[] = []

  if (value === null || typeof value !== 'object') {
    return { ok: false, details: ['IntensityScan must be a non-null object'] }
  }

  const o = value as Record<string, unknown>
  const DETECTOR_MODES = ['fast', 'methodical', 'ml'] as const

  const isNumArray = (v: unknown): v is number[] =>
    Array.isArray(v) && (v as unknown[]).every((x) => typeof x === 'number' && Number.isFinite(x))

  if (!isNumArray(o.curve)) issues.push('curve must be a finite number[]')
  if (!isNumArray(o.timestamps)) issues.push('timestamps must be a finite number[]')

  if (isNumArray(o.curve) && isNumArray(o.timestamps) && o.curve.length !== o.timestamps.length) {
    issues.push('curve and timestamps must have equal length')
  }

  if (!Array.isArray(o.peaks)) {
    issues.push('peaks must be an array')
  } else {
    for (const [i, p] of (o.peaks as unknown[]).entries()) {
      if (p === null || typeof p !== 'object') { issues.push(`peaks[${i}] must be an object`); continue }
      const pk = p as Record<string, unknown>
      if (typeof pk.tSec !== 'number' || !Number.isFinite(pk.tSec)) issues.push(`peaks[${i}].tSec must be a finite number`)
      if (typeof pk.score !== 'number' || !Number.isFinite(pk.score) || pk.score < 0 || pk.score > 1) {
        issues.push(`peaks[${i}].score must be 0..1`)
      }
      if (pk.kind !== 'intense' && pk.kind !== 'climax') issues.push(`peaks[${i}].kind must be 'intense' | 'climax'`)
    }
  }

  if (typeof o.scannerVersion !== 'string' || !o.scannerVersion) issues.push('scannerVersion must be a non-empty string')
  if (typeof o.scannedAt !== 'string' || !o.scannedAt) issues.push('scannedAt must be a non-empty string')
  if (!DETECTOR_MODES.includes(o.detectorMode as (typeof DETECTOR_MODES)[number])) {
    issues.push(`detectorMode must be one of: ${DETECTOR_MODES.join(', ')}`)
  }

  if (issues.length > 0) return { ok: false, details: issues }

  return {
    ok: true,
    scan: {
      curve: o.curve as number[],
      timestamps: o.timestamps as number[],
      peaks: (o.peaks as IntensityPeak[]),
      scannerVersion: o.scannerVersion as string,
      scannedAt: o.scannedAt as string,
      detectorMode: o.detectorMode as IntensityScan['detectorMode'],
    },
  }
}
