import { describe, expect, it } from 'vitest'
import { validateIntensityScan, findHighestIntensityWindow, pickClimax } from '@/lib/intensity-contract'
import type { IntensityScan } from '@/lib/intensity-contract'

const validScan: IntensityScan = {
  curve: [0.1, 0.3, 0.8, 0.9, 0.4, 0.2],
  timestamps: [0, 2, 4, 6, 8, 10],
  peaks: [
    { tSec: 6, score: 0.9, kind: 'climax' },
    { tSec: 4, score: 0.8, kind: 'intense' },
  ],
  scannerVersion: '1.0.0',
  scannedAt: '2026-01-01T00:00:00Z',
  detectorMode: 'fast',
}

describe('validateIntensityScan — valid', () => {
  it('accepts a complete valid scan', () => {
    expect(validateIntensityScan(validScan).ok).toBe(true)
  })

  it('accepts empty curve + timestamps + peaks', () => {
    const r = validateIntensityScan({ ...validScan, curve: [], timestamps: [], peaks: [] })
    expect(r.ok).toBe(true)
  })

  it('accepts all detector modes', () => {
    for (const mode of ['fast', 'methodical', 'ml'] as const) {
      expect(validateIntensityScan({ ...validScan, detectorMode: mode }).ok, `mode ${mode}`).toBe(true)
    }
  })
})

describe('validateIntensityScan — invalid', () => {
  it('rejects non-object', () => {
    expect(validateIntensityScan(null).ok).toBe(false)
  })

  it('rejects non-number[] curve', () => {
    expect(validateIntensityScan({ ...validScan, curve: ['a', 'b'] }).ok).toBe(false)
  })

  it('rejects curve/timestamps length mismatch', () => {
    expect(validateIntensityScan({ ...validScan, curve: [0.1, 0.2], timestamps: [0] }).ok).toBe(false)
  })

  it('rejects peak with score > 1', () => {
    const r = validateIntensityScan({ ...validScan, peaks: [{ tSec: 1, score: 1.5, kind: 'climax' }] })
    expect(r.ok).toBe(false)
  })

  it('rejects peak with invalid kind', () => {
    const r = validateIntensityScan({ ...validScan, peaks: [{ tSec: 1, score: 0.5, kind: 'peak' }] })
    expect(r.ok).toBe(false)
  })

  it('rejects invalid detectorMode', () => {
    expect(validateIntensityScan({ ...validScan, detectorMode: 'ai' }).ok).toBe(false)
  })

  it('rejects NaN in curve', () => {
    expect(validateIntensityScan({ ...validScan, curve: [0.1, NaN, 0.3], timestamps: [0, 2, 4] }).ok).toBe(false)
  })
})

describe('findHighestIntensityWindow', () => {
  it('finds the peak window', () => {
    const result = findHighestIntensityWindow(validScan, 4)
    expect(result).not.toBeNull()
    expect(result!.startSec).toBeGreaterThanOrEqual(0)
    expect(result!.endSec).toBeLessThanOrEqual(14)
    expect(result!.meanScore).toBeGreaterThan(0)
  })

  it('returns null for empty scan', () => {
    const empty = { ...validScan, curve: [], timestamps: [] }
    expect(findHighestIntensityWindow(empty, 5)).toBeNull()
  })

  it('returns null when targetSec exceeds total duration', () => {
    expect(findHighestIntensityWindow(validScan, 999)).toBeNull()
  })

  it('returns null for targetSec = 0', () => {
    expect(findHighestIntensityWindow(validScan, 0)).toBeNull()
  })

  it('endSec does not exceed total duration', () => {
    const result = findHighestIntensityWindow(validScan, 3)
    expect(result!.endSec).toBeLessThanOrEqual(10)
  })
})

describe('pickClimax', () => {
  it('returns the latest climax peak', () => {
    const climax = pickClimax(validScan)
    expect(climax).not.toBeNull()
    expect(climax!.kind).toBe('climax')
    expect(climax!.tSec).toBe(6)
  })

  it('returns null when no climax peaks', () => {
    const noClimax = { ...validScan, peaks: [{ tSec: 4, score: 0.8, kind: 'intense' as const }] }
    expect(pickClimax(noClimax)).toBeNull()
  })

  it('returns null for empty peaks', () => {
    expect(pickClimax({ ...validScan, peaks: [] })).toBeNull()
  })

  it('picks the latest climax among multiple', () => {
    const multiClimax: IntensityScan = {
      ...validScan,
      peaks: [
        { tSec: 3, score: 0.8, kind: 'climax' },
        { tSec: 7, score: 0.6, kind: 'climax' },
        { tSec: 5, score: 0.9, kind: 'climax' },
      ],
    }
    const result = pickClimax(multiClimax)
    expect(result!.tSec).toBe(7)
  })
})
