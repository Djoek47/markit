import { describe, expect, it } from 'vitest'
import { validateTraceRequest, defaultTraceLayers } from '@/lib/trace-contract'

describe('defaultTraceLayers', () => {
  it('returns only metadataAppend enabled by default', () => {
    const layers = defaultTraceLayers()
    expect(layers.spatialGrid).toBe(false)
    expect(layers.temporalRedundancy).toBe(false)
    expect(layers.metadataAppend).toBe(true)
  })
})

describe('validateTraceRequest — valid', () => {
  const validLayers = { spatialGrid: false, temporalRedundancy: false, metadataAppend: true }

  it('accepts minimal valid request', () => {
    const result = validateTraceRequest({ recipientLabel: 'alice', layers: validLayers })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.request.recipientLabel).toBe('alice')
  })

  it('trims recipientLabel whitespace', () => {
    const result = validateTraceRequest({ recipientLabel: '  bob  ', layers: validLayers })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.request.recipientLabel).toBe('bob')
  })

  it('accepts valid platform', () => {
    const result = validateTraceRequest({ recipientLabel: 'x', platform: 'onlyfans', layers: validLayers })
    expect(result.ok).toBe(true)
  })

  it('accepts all valid platforms', () => {
    for (const platform of ['onlyfans', 'fansly', 'manyvids', 'custom'] as const) {
      const r = validateTraceRequest({ recipientLabel: 'x', platform, layers: validLayers })
      expect(r.ok, `platform ${platform}`).toBe(true)
    }
  })

  it('accepts platformId when present', () => {
    const result = validateTraceRequest({ recipientLabel: 'x', recipientPlatform: 'fansly', recipientPlatformId: 'u123', layers: validLayers })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.request.recipientPlatformId).toBe('u123')
  })

  it('accepts all-true layers', () => {
    const result = validateTraceRequest({ recipientLabel: 'x', layers: { spatialGrid: true, temporalRedundancy: true, metadataAppend: true } })
    expect(result.ok).toBe(true)
  })
})

describe('validateTraceRequest — invalid', () => {
  it('rejects non-object', () => {
    expect(validateTraceRequest(null).ok).toBe(false)
    expect(validateTraceRequest('string').ok).toBe(false)
  })

  it('rejects empty recipientLabel', () => {
    const r = validateTraceRequest({ recipientLabel: '', layers: { spatialGrid: false, temporalRedundancy: false, metadataAppend: true } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.details.some((d) => d.includes('recipientLabel'))).toBe(true)
  })

  it('rejects invalid platform', () => {
    const r = validateTraceRequest({ recipientLabel: 'x', recipientPlatform: 'twitter', layers: { spatialGrid: false, temporalRedundancy: false, metadataAppend: true } })
    expect(r.ok).toBe(false)
  })

  it('rejects missing layers', () => {
    const r = validateTraceRequest({ recipientLabel: 'x' })
    expect(r.ok).toBe(false)
  })

  it('rejects partial layers', () => {
    const r = validateTraceRequest({ recipientLabel: 'x', layers: { spatialGrid: true } })
    expect(r.ok).toBe(false)
  })

  it('rejects non-boolean layer values', () => {
    const r = validateTraceRequest({ recipientLabel: 'x', layers: { spatialGrid: 1, temporalRedundancy: false, metadataAppend: true } })
    expect(r.ok).toBe(false)
  })
})
