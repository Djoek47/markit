import { describe, expect, it } from 'vitest'
import { validateSignUploadRequest, validateFinalizeMediaRequest, UPLOAD_SIZE_LIMITS } from '@/lib/media-upload-contract'

describe('UPLOAD_SIZE_LIMITS', () => {
  it('has limits for all three kinds', () => {
    expect(UPLOAD_SIZE_LIMITS.video).toBeGreaterThan(0)
    expect(UPLOAD_SIZE_LIMITS.image).toBeGreaterThan(0)
    expect(UPLOAD_SIZE_LIMITS.audio).toBeGreaterThan(0)
  })

  it('video limit is larger than image limit', () => {
    expect(UPLOAD_SIZE_LIMITS.video).toBeGreaterThan(UPLOAD_SIZE_LIMITS.image)
  })
})

describe('validateSignUploadRequest — valid', () => {
  it('accepts a basic video upload', () => {
    const r = validateSignUploadRequest({ kind: 'video', sizeBytes: 1024 * 1024, contentType: 'video/mp4' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.request.kind).toBe('video')
      expect(r.request.sizeBytes).toBe(1024 * 1024)
    }
  })

  it('accepts all valid kinds', () => {
    for (const kind of ['video', 'image', 'audio'] as const) {
      expect(validateSignUploadRequest({ kind, sizeBytes: 1000, contentType: 'video/mp4' }).ok, `kind ${kind}`).toBe(true)
    }
  })

  it('accepts optional filenameHint', () => {
    const r = validateSignUploadRequest({ kind: 'image', sizeBytes: 500, contentType: 'image/jpeg', filenameHint: 'photo.jpg' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.request.filenameHint).toBe('photo.jpg')
  })
})

describe('validateSignUploadRequest — invalid', () => {
  it('rejects non-object', () => {
    expect(validateSignUploadRequest(null).ok).toBe(false)
    expect(validateSignUploadRequest('upload me').ok).toBe(false)
  })

  it('rejects invalid kind', () => {
    expect(validateSignUploadRequest({ kind: 'document', sizeBytes: 100, contentType: 'application/pdf' }).ok).toBe(false)
  })

  it('rejects zero sizeBytes', () => {
    expect(validateSignUploadRequest({ kind: 'video', sizeBytes: 0, contentType: 'video/mp4' }).ok).toBe(false)
  })

  it('rejects negative sizeBytes', () => {
    expect(validateSignUploadRequest({ kind: 'video', sizeBytes: -1, contentType: 'video/mp4' }).ok).toBe(false)
  })

  it('rejects non-integer sizeBytes', () => {
    expect(validateSignUploadRequest({ kind: 'video', sizeBytes: 100.5, contentType: 'video/mp4' }).ok).toBe(false)
  })

  it('rejects empty contentType', () => {
    expect(validateSignUploadRequest({ kind: 'video', sizeBytes: 100, contentType: '' }).ok).toBe(false)
  })

  it('rejects non-string filenameHint', () => {
    expect(validateSignUploadRequest({ kind: 'video', sizeBytes: 100, contentType: 'video/mp4', filenameHint: 42 }).ok).toBe(false)
  })
})

const validSha256 = 'b'.repeat(64)

describe('validateFinalizeMediaRequest — valid', () => {
  it('accepts minimal finalize request', () => {
    const r = validateFinalizeMediaRequest({ mediaId: 'm1', sha256: validSha256 })
    expect(r.ok).toBe(true)
  })

  it('accepts all optional fields', () => {
    const r = validateFinalizeMediaRequest({
      mediaId: 'm1', sha256: validSha256,
      width: 1920, height: 1080, durationSec: 30.5, codec: 'h264',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.request.width).toBe(1920)
      expect(r.request.durationSec).toBe(30.5)
      expect(r.request.codec).toBe('h264')
    }
  })

  it('accepts uppercase sha256', () => {
    expect(validateFinalizeMediaRequest({ mediaId: 'm1', sha256: 'A'.repeat(64) }).ok).toBe(true)
  })
})

describe('validateFinalizeMediaRequest — invalid', () => {
  it('rejects non-object', () => {
    expect(validateFinalizeMediaRequest(null).ok).toBe(false)
  })

  it('rejects empty mediaId', () => {
    expect(validateFinalizeMediaRequest({ mediaId: '', sha256: validSha256 }).ok).toBe(false)
  })

  it('rejects sha256 that is too short', () => {
    expect(validateFinalizeMediaRequest({ mediaId: 'm1', sha256: 'abc' }).ok).toBe(false)
  })

  it('rejects sha256 with invalid characters', () => {
    expect(validateFinalizeMediaRequest({ mediaId: 'm1', sha256: 'z'.repeat(64) }).ok).toBe(false)
  })

  it('rejects NaN width', () => {
    expect(validateFinalizeMediaRequest({ mediaId: 'm1', sha256: validSha256, width: NaN }).ok).toBe(false)
  })

  it('rejects Infinity durationSec', () => {
    expect(validateFinalizeMediaRequest({ mediaId: 'm1', sha256: validSha256, durationSec: Infinity }).ok).toBe(false)
  })

  it('rejects non-string codec', () => {
    expect(validateFinalizeMediaRequest({ mediaId: 'm1', sha256: validSha256, codec: 265 }).ok).toBe(false)
  })
})
