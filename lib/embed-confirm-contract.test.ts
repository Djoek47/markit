import { describe, expect, it } from 'vitest'
import { validateEmbedConfirmRequest } from '@/lib/embed-confirm-contract'

const validLineage = {
  jobId: 'job-1',
  pipelineVersion: '1.0.0',
  encoderProfile: 'markit.v1.h264',
  sourceMediaIds: ['m1'],
  renderedSha256: 'a'.repeat(64),
  renderedSizeBytes: 1024 * 1024,
}

const validRecipient = { label: 'alice_test' }

const validLayers = { spatialGrid: false, temporalRedundancy: false, metadataAppend: true }

const validRequest = {
  lineage: validLineage,
  recipient: validRecipient,
  watermarkLayers: validLayers,
  renderedFileUrl: 'https://storage.example.com/renders/job-1.mp4',
  renderedFileExpiresAt: '2026-01-01T00:00:00Z',
}

describe('validateEmbedConfirmRequest — valid', () => {
  it('accepts a complete valid request', () => {
    expect(validateEmbedConfirmRequest(validRequest).ok).toBe(true)
  })

  it('accepts optional brand field', () => {
    const r = validateEmbedConfirmRequest({
      ...validRequest,
      brand: { enabled: true, platform: 'onlyfans', handle: 'cisse', position: 'bottom-right', opacityPct: 80 },
    })
    expect(r.ok).toBe(true)
  })

  it('accepts recipient with platform and platformId', () => {
    const r = validateEmbedConfirmRequest({
      ...validRequest,
      recipient: { label: 'bob', platform: 'fansly', platformId: 'b123' },
    })
    expect(r.ok).toBe(true)
  })

  it('accepts sourceMediaIds with multiple entries', () => {
    const r = validateEmbedConfirmRequest({
      ...validRequest,
      lineage: { ...validLineage, sourceMediaIds: ['m1', 'm2', 'm3'] },
    })
    expect(r.ok).toBe(true)
  })
})

describe('validateEmbedConfirmRequest — invalid lineage', () => {
  it('rejects non-object lineage', () => {
    expect(validateEmbedConfirmRequest({ ...validRequest, lineage: null }).ok).toBe(false)
  })

  it('rejects short sha256', () => {
    const r = validateEmbedConfirmRequest({ ...validRequest, lineage: { ...validLineage, renderedSha256: 'abc' } })
    expect(r.ok).toBe(false)
  })

  it('rejects zero renderedSizeBytes', () => {
    const r = validateEmbedConfirmRequest({ ...validRequest, lineage: { ...validLineage, renderedSizeBytes: 0 } })
    expect(r.ok).toBe(false)
  })

  it('rejects non-string[] sourceMediaIds', () => {
    const r = validateEmbedConfirmRequest({ ...validRequest, lineage: { ...validLineage, sourceMediaIds: [42] } })
    expect(r.ok).toBe(false)
  })
})

describe('validateEmbedConfirmRequest — invalid recipient', () => {
  it('rejects empty label', () => {
    const r = validateEmbedConfirmRequest({ ...validRequest, recipient: { label: '' } })
    expect(r.ok).toBe(false)
  })

  it('rejects invalid platform', () => {
    const r = validateEmbedConfirmRequest({ ...validRequest, recipient: { label: 'x', platform: 'youtube' } })
    expect(r.ok).toBe(false)
  })
})

describe('validateEmbedConfirmRequest — invalid layers', () => {
  it('rejects missing layer fields', () => {
    const r = validateEmbedConfirmRequest({ ...validRequest, watermarkLayers: { spatialGrid: true } })
    expect(r.ok).toBe(false)
  })
})

describe('validateEmbedConfirmRequest — invalid top-level', () => {
  it('rejects non-object', () => {
    expect(validateEmbedConfirmRequest(null).ok).toBe(false)
  })

  it('rejects missing renderedFileUrl', () => {
    const { renderedFileUrl: _, ...rest } = validRequest
    expect(validateEmbedConfirmRequest(rest).ok).toBe(false)
  })

  it('rejects non-object brand', () => {
    expect(validateEmbedConfirmRequest({ ...validRequest, brand: 'logo.png' }).ok).toBe(false)
  })
})
