import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { validateSignUploadRequest, UPLOAD_SIZE_LIMITS } from '@/lib/media-upload-contract'
import { flagMediaPipeline } from '@/lib/flags'

export const runtime = 'nodejs'

const UPLOAD_BUCKET = 'markit-uploads'
const UPLOAD_TTL_SEC = 3600 // 1 hour

const MIME_TO_KIND: Record<string, string> = {
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/webm': 'video',
  'video/x-matroska': 'video',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
}

const MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-msvideo': 'avi',
  'video/webm': 'webm', 'video/x-matroska': 'mkv',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav',
  'audio/ogg': 'ogg', 'audio/flac': 'flac', 'audio/aac': 'aac',
}

/**
 * POST /api/media/sign-upload
 * Body: { kind, sizeBytes, contentType, filenameHint? }
 * Response: { ok, mediaId, uploadUrl, uploadHeaders, expiresAt }
 *
 * Returns a pre-signed Supabase Storage upload URL. Browser PUTs directly to
 * uploadUrl, then calls /api/media/finalize with the mediaId.
 *
 * Feature-gated: MARKIT_FEATURE_MEDIA_PIPELINE=1 required.
 */
export async function POST(req: NextRequest) {
  if (!flagMediaPipeline()) {
    return NextResponse.json({ error: 'Feature disabled', code: 'FEATURE_DISABLED' }, { status: 403 })
  }

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateSignUploadRequest(rawBody)
  if (!result.ok) {
    return NextResponse.json({ error: 'Invalid request', details: result.details }, { status: 400 })
  }

  const { kind, sizeBytes, contentType, filenameHint } = result.request

  // Verify MIME type maps to the declared kind
  const mimeKind = MIME_TO_KIND[contentType]
  if (!mimeKind) {
    return NextResponse.json(
      { error: `Unsupported content type: ${contentType}`, code: 'UNSUPPORTED_TYPE' },
      { status: 415 },
    )
  }
  if (mimeKind !== kind) {
    return NextResponse.json(
      { error: `Content type "${contentType}" does not match kind "${kind}"`, code: 'BAD_REQUEST' },
      { status: 400 },
    )
  }

  // Enforce tier size limits
  const limit = UPLOAD_SIZE_LIMITS[kind]
  if (sizeBytes > limit) {
    return NextResponse.json(
      { error: `File too large (${sizeBytes} > ${limit} bytes)`, code: 'TIER_LIMIT' },
      { status: 413 },
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }
  const service = createServiceClient(url, serviceKey)

  const mediaId = randomUUID()
  const ext = MIME_EXTENSIONS[contentType] ?? (filenameHint?.split('.').pop() ?? 'bin')
  const objectPath = `${user.id}/${mediaId}.${ext}`

  const { data, error } = await service.storage
    .from(UPLOAD_BUCKET)
    .createSignedUploadUrl(objectPath)

  if (error || !data) {
    console.error('[media/sign-upload] Storage error:', error?.message)
    return NextResponse.json(
      { error: error?.message ?? 'Could not create signed upload URL' },
      { status: 500 },
    )
  }

  // Insert a pending media row so we can associate it before finalize
  const { error: dbError } = await service
    .schema('markit')
    .from('media')
    .insert({
      id: mediaId,
      user_id: user.id,
      kind,
      source_path: objectPath,
      source_bucket: UPLOAD_BUCKET,
      source_size_bytes: sizeBytes,
    })

  if (dbError) {
    console.error('[media/sign-upload] DB insert error:', dbError.message)
    return NextResponse.json({ error: 'Failed to reserve media slot' }, { status: 500 })
  }

  const expiresAt = new Date(Date.now() + UPLOAD_TTL_SEC * 1000).toISOString()

  return NextResponse.json({
    ok: true,
    mediaId,
    uploadUrl: data.signedUrl,
    uploadHeaders: { 'x-upsert': 'true' },
    expiresAt,
  })
}
