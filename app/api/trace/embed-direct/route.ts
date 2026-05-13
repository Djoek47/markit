import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import {
  createTracePayload,
  embedAppendV1,
  sha256Hex,
  type TracePayloadV1,
} from '@/lib/trace/append-v1'
import { TRACE_MAX_SOURCE_BYTES, buildDownloadFilename, safeExtension } from '@/lib/trace/storage'

export const runtime = 'nodejs'

/**
 * POST multipart { file, recipientLabel }
 *   → binary traced file as attachment (Content-Disposition: attachment)
 *
 * Simpler than /api/trace/embed — no Supabase Storage involved.
 * Accepts the file directly, embeds v1 marker in memory, streams back.
 * Stores trace_exports row for later detect lookups.
 *
 * Limit: Vercel request body (~50 MB on Pro, ~4.5 MB on Hobby).
 * For larger files use /api/trace/sign-upload → /api/trace/embed.
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient(req)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let file: File
  let recipientLabel: string
  try {
    const form = await req.formData()
    const f = form.get('file')
    const r = form.get('recipientLabel')
    if (!f || !(f instanceof File)) {
      return NextResponse.json({ error: 'file field is required' }, { status: 400 })
    }
    if (!r || typeof r !== 'string' || !r.trim()) {
      return NextResponse.json({ error: 'recipientLabel is required' }, { status: 400 })
    }
    if (f.size > TRACE_MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'File too large (max 1 GB)' }, { status: 413 })
    }
    file = f
    recipientLabel = r.trim().slice(0, 500)
  } catch {
    return NextResponse.json({ error: 'Failed to parse multipart body' }, { status: 400 })
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer())
  if (sourceBuffer.length === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  }

  const sourceSha256 = sha256Hex(sourceBuffer)

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
  const outputSha256 = sha256Hex(tracedBuffer)

  // Store trace record so /detect can resolve recipient later
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    const service = createServiceClient(url, serviceKey)
    await service.schema('markit').from('trace_exports').insert({
      user_id: user.id,
      payload_id: payload.payloadId,
      recipient_label: payload.recipientLabel,
      source_path: `direct/${user.id}/${payload.payloadId}`,
      source_sha256: sourceSha256,
      output_sha256: outputSha256,
      size_bytes: tracedBuffer.length,
      algorithm: 'append-v1',
      expires_at: new Date(payload.exp * 1000).toISOString(),
    })
    // Non-fatal — proceed even if DB write fails
  }

  const ext = safeExtension(file.name)
  const filename = buildDownloadFilename(recipientLabel, payload.payloadId, ext)

  return new NextResponse(tracedBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': file.type || 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(tracedBuffer.length),
      'X-Payload-Id': payload.payloadId,
      'X-Recipient-Label': encodeURIComponent(recipientLabel),
      'X-Algorithm': 'append-v1',
    },
  })
}
