import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runMarkitTraceFlow } from './openreel-trace-flow'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const makeOkResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as unknown as Response

const makeErrResponse = (status: number, body: unknown) =>
  ({ ok: false, status, json: () => Promise.resolve(body) }) as unknown as Response

describe('runMarkitTraceFlow', () => {
  const blob = new Blob(['fake-video'], { type: 'video/mp4' })
  const recipient = 'alice'

  beforeEach(() => vi.clearAllMocks())

  it('calls sign-upload → PUT → finalize → embed in order', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: { 'x-custom': 'val' } }))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)                  // PUT
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1' }))          // finalize
      .mockResolvedValueOnce(makeOkResponse({ ok: true, payloadId: 'pid-1', downloadUrl: 'https://cdn/traced.mp4', downloadFilename: 'traced.mp4' }))

    const result = await runMarkitTraceFlow(blob, recipient)

    expect(result).toEqual({ downloadUrl: 'https://cdn/traced.mp4', payloadId: 'pid-1' })

    // sign-upload
    expect(mockFetch.mock.calls[0][0]).toBe('/api/media/sign-upload')
    const signBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>
    expect(signBody.kind).toBe('video')
    expect(signBody.contentType).toBe('video/mp4')
    expect(signBody.sizeBytes).toBe(blob.size)

    // PUT to storage
    expect(mockFetch.mock.calls[1][0]).toBe('https://storage/put')
    expect(mockFetch.mock.calls[1][1].method).toBe('PUT')
    expect((mockFetch.mock.calls[1][1].headers as Record<string, string>)['x-custom']).toBe('val')

    // finalize
    expect(mockFetch.mock.calls[2][0]).toBe('/api/media/finalize')
    const finalizeBody = JSON.parse(mockFetch.mock.calls[2][1].body as string) as Record<string, unknown>
    expect(finalizeBody.mediaId).toBe('mid-1')

    // trace/embed
    expect(mockFetch.mock.calls[3][0]).toBe('/api/trace/embed')
    const embedBody = JSON.parse(mockFetch.mock.calls[3][1].body as string) as Record<string, unknown>
    expect(embedBody.uploadId).toBe('mid-1')
    expect(embedBody.recipientLabel).toBe(recipient)
  })

  it('throws if sign-upload fails', async () => {
    mockFetch.mockResolvedValueOnce(makeErrResponse(403, { error: 'Feature disabled' }))
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('Feature disabled')
  })

  it('throws if storage PUT fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: {} }))
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('Storage PUT failed (503)')
  })

  it('throws if finalize fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: {} }))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce(makeErrResponse(400, { error: 'Bad mediaId' }))
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('Bad mediaId')
  })

  it('throws if trace/embed fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: {} }))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1' }))
      .mockResolvedValueOnce(makeErrResponse(500, { error: 'Embed error' }))
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('Embed error')
  })

  it('forwards uploadHeaders to the PUT request', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: { 'x-amz-acl': 'private', 'x-custom': 'abc' } }))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1' }))
      .mockResolvedValueOnce(makeOkResponse({ ok: true, payloadId: 'pid-1', downloadUrl: 'https://cdn/traced.mp4', downloadFilename: 'traced.mp4' }))

    await runMarkitTraceFlow(blob, recipient)

    const putHeaders = mockFetch.mock.calls[1][1].headers as Record<string, string>
    expect(putHeaders['x-amz-acl']).toBe('private')
    expect(putHeaders['x-custom']).toBe('abc')
    expect(putHeaders['Content-Type']).toBe('video/mp4')
  })

  it('sends blob size in sign-upload body', async () => {
    const bigBlob = new Blob(['x'.repeat(1024)], { type: 'video/mp4' })
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1', uploadUrl: 'https://storage/put', uploadHeaders: {} }))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'mid-1' }))
      .mockResolvedValueOnce(makeOkResponse({ ok: true, payloadId: 'pid-1', downloadUrl: 'https://cdn/traced.mp4', downloadFilename: 'traced.mp4' }))

    await runMarkitTraceFlow(bigBlob, recipient)

    const signBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>
    expect(signBody.sizeBytes).toBe(1024)
  })

  it('uses the mediaId from sign-upload in the finalize body', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'unique-id-xyz', uploadUrl: 'https://storage/put', uploadHeaders: {} }))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce(makeOkResponse({ ok: true, mediaId: 'unique-id-xyz' }))
      .mockResolvedValueOnce(makeOkResponse({ ok: true, payloadId: 'pid-1', downloadUrl: 'https://cdn/traced.mp4', downloadFilename: 'traced.mp4' }))

    await runMarkitTraceFlow(blob, recipient)

    const finalizeBody = JSON.parse(mockFetch.mock.calls[2][1].body as string) as Record<string, unknown>
    expect(finalizeBody.mediaId).toBe('unique-id-xyz')

    const embedBody = JSON.parse(mockFetch.mock.calls[3][1].body as string) as Record<string, unknown>
    expect(embedBody.uploadId).toBe('unique-id-xyz')
  })

  it('falls through with generic message when sign-upload error has no body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.reject(new Error('no body')) } as unknown as Response)
    await expect(runMarkitTraceFlow(blob, recipient)).rejects.toThrow('sign-upload failed (503)')
  })
})
