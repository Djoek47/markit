import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createHmac } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { flagAriadneV2Embed } from '@/lib/flags'
import {
  TRACE_UPLOADS_BUCKET,
  TRACE_DOWNLOAD_URL_TTL_SEC,
  renderObjectPath,
  buildDownloadFilename,
  safeExtension,
  uploadObjectPath,
} from '@/lib/trace/storage'

export const runtime = 'nodejs'

const CREATIX_URL = process.env.NEXT_PUBLIC_CREATIX_APP_URL ?? ''
const SHARED_SECRET = process.env.MARKIT_ARIADNE_SHARED_SECRET ?? ''

/**
 * Build the M2M Authorization header for Creatix Ariadne calls.
 * Mirrors the pattern used by /api/ariadne-proxy and /api/ariadne/detect-proxy.
 */
function buildAriadneAuthHeader(body: string): string {
  const ts = Date.now().toString()
  const sig = createHmac('sha256', SHARED_SECRET)
    .update(`${ts}.${body}`)
    .digest('hex')
  return `Markit ts=${ts},sig=${sig}`
}

/**
 * POST /api/trace/embed-v2
 * Body: { uploadId, recipientLabel, sourceExt? }
 *
 * Calls Creatix POST /api/ariadne/embed-v2 to embed a frame-level v2
 * watermark that survives re-encoding and screenshots.
 *
 * Feature-gated: ARIADNE_V2_EMBED_ENABLED=1 required.
 * Falls back: if Creatix v2 returns 404/501, client should retry with /api/trace/embed (v1).
 */
export async function POST(req: NextRequest) {
  if (!flagAriadneV2Embed()) {
    return NextResponse.json(
      { error: 'Ariadne v2 embed is not enabled on this instance', code: 'FEATURE_DISABLED' },
      { status: 403 },
    )
  }

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { uploadId?: string; sourcePath?: string; recipientLabel?: string; sourceExt?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const uploadId = (body.uploadId || '').trim()
  const recipientLabel = (body.recipientLabel || '').trim()
  if (!uploadId) return NextResponse.json({ error: 'uploadId is required' }, { status: 400 })
  if (!recipientLabel) return NextResponse.json({ error: 'recipientLabel is required' }, { status: 400 })
  if (recipientLabel.length > 500) return NextResponse.json({ error: 'recipientLabel too long' }, { status: 400 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }
  const service = createServiceClient(supabaseUrl, serviceKey)

  const ext = safeExtension(body.sourceExt)
  let sourcePath: string
  if (body.sourcePath && typeof body.sourcePath === 'string') {
    if (!body.sourcePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Forbidden', code: 'path_mismatch' }, { status: 403 })
    }
    sourcePath = body.sourcePath
  } else {
    sourcePath = uploadObjectPath(user.id, uploadId, ext)
  }

  // Create a presigned download URL so Creatix can fetch the source file
  const { data: srcUrl, error: srcUrlErr } = await service.storage
    .from(TRACE_UPLOADS_BUCKET)
    .createSignedUrl(sourcePath, 60 * 60) // 1 hour for Creatix to fetch

  if (srcUrlErr || !srcUrl?.signedUrl) {
    return NextResponse.json(
      { error: 'Source upload not found or unreadable', code: 'source_missing' },
      { status: 404 },
    )
  }

  // Mint a Markit-side payload ID — Creatix will record this in ariadne_v2_jobs
  const payloadId = randomUUID()
  const outputPath = renderObjectPath(user.id, payloadId, ext)
  const callbackUrl = `${process.env.NEXT_PUBLIC_MARKIT_APP_URL ?? ''}/api/internal/trace-v2-complete`

  // Call Creatix embed-v2 endpoint
  const creatixBody = JSON.stringify({
    mediaUrl: srcUrl.signedUrl,
    recipientLabel,
    payloadId,
    callbackUrl,
  })

  if (!CREATIX_URL || !SHARED_SECRET) {
    return NextResponse.json({ error: 'Creatix integration not configured' }, { status: 503 })
  }

  let creatixRes: Response
  try {
    creatixRes = await fetch(`${CREATIX_URL}/api/ariadne/embed-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: buildAriadneAuthHeader(creatixBody),
      },
      body: creatixBody,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    console.error('[trace/embed-v2] Creatix fetch error:', msg)
    return NextResponse.json({ error: `Creatix unreachable: ${msg}` }, { status: 502 })
  }

  if (!creatixRes.ok) {
    const errBody = await creatixRes.json().catch(() => ({})) as { error?: string }
    console.error('[trace/embed-v2] Creatix error:', creatixRes.status, errBody)
    return NextResponse.json(
      { error: errBody.error ?? `Creatix embed-v2 failed (${creatixRes.status})`, code: 'upstream_failed' },
      { status: 502 },
    )
  }

  const creatixData = await creatixRes.json() as {
    ok: boolean
    exportId: string
    payloadId: string
    embeddedFileUrl: string
    expiresAt: string
    algorithm: string
  }

  // Insert trace_exports row (algorithm = 'frame-v2')
  const { error: insertError } = await service
    .schema('markit')
    .from('trace_exports')
    .insert({
      user_id: user.id,
      payload_id: creatixData.payloadId ?? payloadId,
      recipient_label: recipientLabel,
      source_path: sourcePath,
      output_path: outputPath,
      algorithm: 'frame-v2',
    })

  if (insertError) {
    console.error('[trace/embed-v2] DB insert error:', insertError.message)
    // Non-fatal: return the download URL even if the registry write fails;
    // the Creatix side already recorded the export.
  }

  const downloadFilename = buildDownloadFilename(recipientLabel, creatixData.payloadId ?? payloadId, ext)

  return NextResponse.json({
    ok: true,
    payloadId: creatixData.payloadId ?? payloadId,
    downloadUrl: creatixData.embeddedFileUrl,
    downloadFilename,
    expiresAt: creatixData.expiresAt,
    algorithmVersion: 'frame-v2',
  })
}
