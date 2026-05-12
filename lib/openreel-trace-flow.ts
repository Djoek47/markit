/**
 * Sign-upload → PUT → finalize → trace/embed pipeline for OpenReel exports.
 * Called after exportProjectToBlob() resolves, before the vault send.
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
}

export async function runMarkitTraceFlow(
  renderedBlob: Blob,
  recipientLabel: string,
): Promise<{ downloadUrl: string; payloadId: string }> {
  // 1. Sign upload — get a pre-signed PUT URL
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

  // 2. PUT the blob directly to storage
  const putRes = await fetch(sign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', ...sign.uploadHeaders },
    body: renderedBlob,
  })
  if (!putRes.ok) {
    throw new Error(`Storage PUT failed (${putRes.status})`)
  }

  // 3. Finalize — mark upload complete in the DB
  const finalizeRes = await fetch('/api/media/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaId: sign.mediaId }),
  })
  if (!finalizeRes.ok) {
    const err = (await finalizeRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `finalize failed (${finalizeRes.status})`)
  }

  // 4. Embed Ariadne trace
  const embedRes = await fetch('/api/trace/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId: sign.mediaId, recipientLabel }),
  })
  if (!embedRes.ok) {
    const err = (await embedRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `trace/embed failed (${embedRes.status})`)
  }
  const embed = (await embedRes.json()) as EmbedResponse

  return { downloadUrl: embed.downloadUrl, payloadId: embed.payloadId }
}
