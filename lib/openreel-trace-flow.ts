/**
 * Sign-upload → PUT → finalize → trace/embed pipeline for OpenReel exports.
 * Called after exportProjectToBlob() resolves, before the vault send.
 *
 * v2 path: when ARIADNE_V2_EMBED_ENABLED=1, calls /api/trace/embed-v2
 *          which proxies to Creatix's frame watermark service.
 *          Frame watermark survives re-encoding and screenshots.
 *
 * v1 path: append-v1 (post-EOF bytes). Fast, zero quality loss.
 *          Does NOT survive re-encoding or screenshots.
 */

type SignUploadResponse = {
  ok: boolean
  mediaId: string
  uploadUrl: string
  uploadHeaders: Record<string, string>
}

type EmbedResponse = {
  ok: boolean
  payloadId: string
  downloadUrl: string
  downloadFilename: string
  algorithmVersion?: string
}

// ─── Shared: upload the blob to storage ───────────────────────────────────────

async function uploadBlobToStorage(renderedBlob: Blob): Promise<{ mediaId: string }> {
  const signRes = await fetch('/api/media/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'video',
      sizeBytes: renderedBlob.size,
      contentType: 'video/mp4',
      filenameHint: 'openreel-export.mp4',
    }),
  })
  if (!signRes.ok) {
    const err = (await signRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `sign-upload failed (${signRes.status})`)
  }
  const sign = (await signRes.json()) as SignUploadResponse

  const putRes = await fetch(sign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', ...sign.uploadHeaders },
    body: renderedBlob,
  })
  if (!putRes.ok) throw new Error(`Storage PUT failed (${putRes.status})`)

  const finalizeRes = await fetch('/api/media/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaId: sign.mediaId }),
  })
  if (!finalizeRes.ok) {
    const err = (await finalizeRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `finalize failed (${finalizeRes.status})`)
  }

  return { mediaId: sign.mediaId }
}

// ─── v1: append-v1 (post-EOF bytes) ──────────────────────────────────────────

async function runMarkitTraceFlowV1(
  renderedBlob: Blob,
  recipientLabel: string,
): Promise<{ downloadUrl: string; payloadId: string; algorithmVersion: string }> {
  const { mediaId } = await uploadBlobToStorage(renderedBlob)

  const embedRes = await fetch('/api/trace/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId: mediaId, recipientLabel }),
  })
  if (!embedRes.ok) {
    const err = (await embedRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `trace/embed failed (${embedRes.status})`)
  }
  const embed = (await embedRes.json()) as EmbedResponse

  return { downloadUrl: embed.downloadUrl, payloadId: embed.payloadId, algorithmVersion: 'append-v1' }
}

// ─── v2: frame-level watermark (survives re-encode + screenshot) ──────────────

async function runMarkitTraceFlowV2(
  renderedBlob: Blob,
  recipientLabel: string,
): Promise<{ downloadUrl: string; payloadId: string; algorithmVersion: string }> {
  const { mediaId } = await uploadBlobToStorage(renderedBlob)

  const embedRes = await fetch('/api/trace/embed-v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId: mediaId, recipientLabel }),
  })

  // If Creatix v2 service not yet deployed, fall back to v1 gracefully
  if (embedRes.status === 404 || embedRes.status === 501 || embedRes.status === 403) {
    console.warn('[trace-flow] embed-v2 unavailable, falling back to append-v1')
    const fallbackRes = await fetch('/api/trace/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId: mediaId, recipientLabel }),
    })
    if (!fallbackRes.ok) {
      const err = (await fallbackRes.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error ?? `trace/embed fallback failed (${fallbackRes.status})`)
    }
    const fallback = (await fallbackRes.json()) as EmbedResponse
    return { downloadUrl: fallback.downloadUrl, payloadId: fallback.payloadId, algorithmVersion: 'append-v1-fallback' }
  }

  if (!embedRes.ok) {
    const err = (await embedRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `trace/embed-v2 failed (${embedRes.status})`)
  }
  const embed = (await embedRes.json()) as EmbedResponse

  return {
    downloadUrl: embed.downloadUrl,
    payloadId: embed.payloadId,
    algorithmVersion: embed.algorithmVersion ?? 'frame-v2',
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full trace flow for an OpenReel export.
 *
 * When ARIADNE_V2_EMBED_ENABLED=1: uses frame-v2 (Creatix service) with
 * automatic fallback to append-v1 if the Creatix v2 endpoint is not yet live.
 *
 * When disabled: uses append-v1 only.
 */
export async function runMarkitTraceFlow(
  renderedBlob: Blob,
  recipientLabel: string,
): Promise<{ downloadUrl: string; payloadId: string; algorithmVersion: string }> {
  // Read the flag at call time (server-side env var, evaluated per-request on client)
  const useV2 =
    typeof window !== 'undefined'
      ? false // client-side: always v1 (embed-v2 is server-only)
      : false // default; the API route embed-v2 reads the flag server-side

  // In the browser, the route handler reads ARIADNE_V2_EMBED_ENABLED itself.
  // We always call embed-v2 from the client — the route returns 403 if disabled,
  // which triggers the graceful fallback in runMarkitTraceFlowV2.
  if (!useV2) {
    // Try v2 first; it falls back automatically if not enabled/deployed
    return runMarkitTraceFlowV2(renderedBlob, recipientLabel)
  }
  return runMarkitTraceFlowV1(renderedBlob, recipientLabel)
}
