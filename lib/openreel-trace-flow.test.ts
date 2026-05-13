import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runMarkitTraceFlow } from './openreel-trace-flow'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const ok = (body: unknown) =>
  ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as unknown as Response
const err = (status: number, body: unknown) =>
  ({ ok: false, status, json: () => Promise.resolve(body) }) as unknown as Response

// Helper: mock the common upload sequence (sign → PUT → finalize)
function mockUpload(mediaId = 'mid-1') {
  mockFetch
    .mockResolvedValueOnce(ok({ ok: true, mediaId, uploadUrl: 'https://storage/put', uploadHeaders: { 'x-custom': 'val' } }))
    .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
    .mockResolvedValueOnce(ok({ ok: true, mediaId }))
}

const blob = new Blob(['fake-video'], { type: 'video/mp4' })
const recipient = 'alice'

beforeEach(() => vi.clearAllMocks())

// ─── v2 path (default — embed-v2 called first) ────────────────────────────────

describe('runMarkitTraceFlow — v2 path', () => {
  it('calls sign-upload → PUT → finalize → embed-v2 in order', async () => {
    mockUpload()
    mockFetch.mockResolvedValueOnce(ok({ ok: true, payloadId: 'pid-v2', downloadUrl: 'https://cdn/v2.mp4', algorithmVersion: 'frame-v2' }))

    const result = await runMarkitTraceFlow(blob, recipient)

    expect(result.payloadId).toBe('pid-v2')
    expect(result.downloadUrl).toBe('https://cdn/v2.mp4')
    expect(result.algorithmVersion).toBe('frame-v2')

    expect(mockFetch.mock.calls[0][0]).toBe('/api/media/sign-upload')
    expect(mockFetch.mock.calls[1][0]).toBe('https://storage/put')
    expect(mockFetch.mock.calls[2][0]).toBe('/api/media/finalize')
    expect(mockFetch.mock.calls[3][0]).toBe('/api/trace/embed-v2')

    const embedBody = JSON.parse(mockFetch.mock.calls[3][1].body as string) as Record<string, unknown>
    expect(embedBody.uploadId).toBe('mid-1')
    expect(embedBody.recipientLabel).toBe(recipient)
  })

  it('uses the mediaId from sign-upload in embed-v2 body', async () => {
    mockUpload('unique-id-xyz')
    mockFetch.mockResolvedValueOnce(ok({ ok: true, payloadId: 'p1', downloadUrl: 'https://cdn/p1.mp4' }))

    await runMarkitTraceFlow(blob, recipient)

    const embedBody = JSON.parse(mockFetch.mock.calls[3][1].body as string) as Record<string, unknown>
    expect(embedBody.uploadId).toBe('unique-id-xyz')
  })

  it('sends blob size in sign-upload body', async () => {
    const bigBlob = new Blob(['x'.repeat(1024)], { type: 'video/mp4' })
    mockUpload()
    mockFetch.mockResolvedValueOnce(ok({ ok: true, payloadId: 'p1', downloadUrl: 'https://cdn/p1.mp4' }))

    await runMarkitTraceFlow(bigBlob, recipient)

    const signBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>
    expect(signBody.sizeBytes).toBe(1024)
  })

  it('forwards uploadHeaders to the PUT request', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: { 'x-amz-acl': 'private', 'x-custom': 'abc' } }))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce(ok({ ok: true }))
      .mockResolvedValueOnce(ok({ ok: true, payloadId: 'p1', downloadUrl: 'https://cdn/p1.mp4' }))

    await runMarkitTraceFlow(blob, recipient)

    const putHeaders = mockFetch.mock.calls[1][1].headers as Record<string, string>
    expect(putHeaders['x-amz-acl']).toBe('private')
    expect(putHeaders['x-custom']).toBe('abc')
    expect(putHeaders['Content-Type']).toBe('video/mp4')
  })
})

// ─── v2 → v1 fallback ────────────────────────────────────────────────────────

describe('runMarkitTraceFlow — v2 fallback to v1', () => {
  it('falls back to append-v1 when embed-v2 returns 403 (disabled)', async () => {
    mockUpload()
    mockFetch
      .mockResolvedValueOnce(err(403, { error: 'FEATURE_DISABLED' }))
      .mockResolvedValueOnce(ok({ ok: true, payloadId: 'pid-v1', downloadUrl: 'https://cdn/v1.mp4' }))

    const result = await runMarkitTraceFlow(blob, recipient)

    expect(result.payloadId).toBe('pid-v1')
    expect(result.algorithmVersion).toBe('append-v1-fallback')

    const calls = mockFetch.mock.calls.map((c) => c[0] as string)
    expect(calls.some((u) => u.includes('embed-v2'))).toBe(true)
    expect(calls.some((u) => u === '/api/trace/embed')).toBe(true)
  })

  it('falls back to append-v1 when embed-v2 returns 404 (not deployed)', async () => {
    mockUpload()
    mockFetch
      .mockResolvedValueOnce(err(404, { error: 'Not found' }))
      .mockResolvedValueOnce(ok({ ok: true, payloadId: 'pid-v1', downloadUrl: 'https://cdn/v1.mp4' }))

    const result = await runMarkitTraceFlow(blob, recipient)
    expect(result.algorithmVersion).toBe('append-v1-fallback')
  })

  it('falls back when embed-v2 returns 501 (not implemented)', async () => {
    mockUpload()
    mockFetch
      .mockResolvedValueOnce(err(501, { error: 'Not implemented' }))
      .mockResolvedValueOnce(ok({ ok: true, payloadId: 'pid-v1', downloadUrl: 'https://cdn/v1.mp4' }))

    const result = await runMarkitTraceFlow(blob, recipient)
    expect(result.algorithmVersion).toBe('append-v1-fallback')
  })
})

// ─── error paths ──────────────────────────────────────────────────────────────

describe('runMarkitTraceFlow — error paths', () => {
  it('throws if sign-upload fails', async () => {
    mockFetch.mockResolvedValueOnce(err(403, { error: 'Feature disabled' }))
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('Feature disabled')
  })

  it('throws if storage PUT fails', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: {} }))
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('Storage PUT failed (503)')
  })

  it('throws if finalize fails', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: {} }))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce(err(400, { error: 'Bad mediaId' }))
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('Bad mediaId')
  })

  it('throws if embed-v2 returns 502 (no fallback for upstream errors)', async () => {
    mockUpload()
    mockFetch.mockResolvedValueOnce(err(502, { error: 'Creatix unreachable' }))
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow()
  })

  it('falls through with generic message when sign-upload has no body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.reject(new Error('no body')) } as unknown as Response)
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('sign-upload failed (503)')
  })
})
