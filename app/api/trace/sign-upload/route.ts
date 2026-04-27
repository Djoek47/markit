import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import {
  TRACE_MAX_SOURCE_BYTES,
  TRACE_UPLOADS_BUCKET,
  TRACE_UPLOAD_URL_TTL_SEC,
  isAllowedMime,
  safeExtension,
  uploadObjectPath,
} from '@/lib/trace/storage'

export const runtime = 'nodejs'

/**
 * POST { filename?, sizeBytes, contentType }
 *   → { uploadId, uploadUrl, sourcePath, expiresAt }
 *
 * Reserves an upload slot. Browser PUTs the file directly to `uploadUrl`,
 * then calls /api/trace/embed with `uploadId` and the recipient label.
 *
 * Auth: Supabase JWT (cookie or Bearer). RLS keeps users in their own folder
 * (path is `<userId>/<uploadId>.<ext>` — see uploadObjectPath).
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

  let body: { filename?: string; sizeBytes?: number; contentType?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sizeBytes = Number(body.sizeBytes)
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: 'sizeBytes must be a positive number' }, { status: 400 })
  }
  if (sizeBytes > TRACE_MAX_SOURCE_BYTES) {
    return NextResponse.json(
      {
        error: `File too large (${sizeBytes} > ${TRACE_MAX_SOURCE_BYTES} bytes)`,
        code: 'tier_limit',
      },
      { status: 413 },
    )
  }

  const contentType = (body.contentType || '').toString()
  if (!isAllowedMime(contentType)) {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType}`, code: 'unsupported_type' },
      { status: 415 },
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }
  const service = createServiceClient(url, serviceKey)

  const uploadId = randomUUID()
  const ext = safeExtension(body.filename)
  const sourcePath = uploadObjectPath(user.id, uploadId, ext)

  const { data, error } = await service.storage
    .from(TRACE_UPLOADS_BUCKET)
    .createSignedUploadUrl(sourcePath)
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Could not create signed upload URL' },
      { status: 500 },
    )
  }

  const expiresAt = new Date(Date.now() + TRACE_UPLOAD_URL_TTL_SEC * 1000).toISOString()

  return NextResponse.json({
    ok: true,
    uploadId,
    uploadUrl: data.signedUrl,
    /** Token for direct uploads via the Supabase JS client; either uploadUrl or this works. */
    uploadToken: data.token,
    sourcePath,
    bucket: TRACE_UPLOADS_BUCKET,
    expiresAt,
  })
}
