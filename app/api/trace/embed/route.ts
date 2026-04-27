import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import {
  createTracePayload,
  embedAppendV1,
  sha256Hex,
  type TracePayloadV1,
} from '@/lib/trace/append-v1'
import {
  TRACE_DOWNLOAD_URL_TTL_SEC,
  TRACE_MAX_SOURCE_BYTES,
  TRACE_RENDERS_BUCKET,
  TRACE_UPLOADS_BUCKET,
  buildDownloadFilename,
  renderObjectPath,
  safeExtension,
  uploadObjectPath,
} from '@/lib/trace/storage'

export const runtime = 'nodejs'

/**
 * POST { uploadId, recipientLabel, sourceExt? }
 *   → { ok, payloadId, downloadUrl, downloadFilename, expiresAt, algorithmVersion }
 *
 * 1. Verify the user owns an upload at `<userId>/<uploadId>.<ext>`.
 * 2. Download the source from markit-trace-uploads.
 * 3. Mint a signed payload + embed (append-v1).
 * 4. Upload result to markit-trace-renders.
 * 5. Insert markit.trace_exports row.
 * 6. Return a 7-day signed download URL.
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient(req)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { uploadId?: string; recipientLabel?: string; sourceExt?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const uploadId = (body.uploadId || '').trim()
  const recipientLabel = (body.recipientLabel || '').trim()
  if (!uploadId) return NextResponse.json({ error: 'uploadId is required' }, { status: 400 })
  if (!recipientLabel) return NextResponse.json({ error: 'recipientLabel is required' }, { status: 400 })
  if (recipientLabel.length > 500) {
    return NextResponse.json({ error: 'recipientLabel too long (max 500)' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }
  const service = createServiceClient(url, serviceKey)

  // 1. Locate the source file. We don't know the extension up front — try a couple defaults.
  const ext = safeExtension(body.sourceExt)
  const sourcePath = uploadObjectPath(user.id, uploadId, ext)

  // 2. Download source. Storage HEAD-then-download in one shot.
  const dl = await service.storage.from(TRACE_UPLOADS_BUCKET).download(sourcePath)
  if (dl.error || !dl.data) {
    return NextResponse.json(
      { error: 'Source upload not found or unreadable', code: 'source_missing' },
      { status: 404 },
    )
  }
  const sourceArrayBuffer = await dl.data.arrayBuffer()
  if (sourceArrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: 'Source upload is empty' }, { status: 400 })
  }
  if (sourceArrayBuffer.byteLength > TRACE_MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: 'Source exceeds size cap' }, { status: 413 })
  }
  const sourceBuffer = Buffer.from(sourceArrayBuffer)
  const sourceSha256 = sha256Hex(sourceBuffer)

  // 3. Mint payload + embed (append-v1).
  let payload: TracePayloadV1
  try {
    payload = createTracePayload({ recipientLabel, userId: user.id })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not mint payload' },
      { status: 503 },
    )
  }
  const tracedBuffer = embedAppendV1(sourceBuffer, payload)
  const tracedSha256 = sha256Hex(tracedBuffer)

  // 4. Upload traced output.
  const outputPath = renderObjectPath(user.id, payload.payloadId, ext)
  const upload = await service.storage
    .from(TRACE_RENDERS_BUCKET)
    .upload(outputPath, tracedBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    })
  if (upload.error) {
    return NextResponse.json(
      { error: upload.error.message || 'Upload of traced file failed' },
      { status: 500 },
    )
  }

  // 5. Persist trace registry row. RLS denies cross-user reads.
  const { error: insertError } = await service.schema('markit').from('trace_exports').insert({
    user_id: user.id,
    payload_id: payload.payloadId,
    recipient_label: payload.recipientLabel,
    source_path: sourcePath,
    source_sha256: sourceSha256,
    output_path: outputPath,
    output_sha256: tracedSha256,
    size_bytes: tracedBuffer.length,
    algorithm: 'append-v1',
    expires_at: new Date(payload.exp * 1000).toISOString(),
  })
  if (insertError) {
    return NextResponse.json(
      { error: `Could not register trace: ${insertError.message}`, code: 'registry_failed' },
      { status: 500 },
    )
  }

  // 6. Return signed download URL with the recipient slug + payload prefix in the filename.
  const downloadFilename = buildDownloadFilename(recipientLabel, payload.payloadId, ext)
  const signed = await service.storage
    .from(TRACE_RENDERS_BUCKET)
    .createSignedUrl(outputPath, TRACE_DOWNLOAD_URL_TTL_SEC, { download: downloadFilename })
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: signed.error?.message || 'Could not sign download URL' },
      { status: 500 },
    )
  }

  const expiresAt = new Date(Date.now() + TRACE_DOWNLOAD_URL_TTL_SEC * 1000).toISOString()

  return NextResponse.json({
    ok: true,
    payloadId: payload.payloadId,
    recipientLabel: payload.recipientLabel,
    downloadUrl: signed.data.signedUrl,
    downloadFilename,
    expiresAt,
    algorithmVersion: 'append-v1',
    sourceSha256,
    outputSha256: tracedSha256,
  })
}
