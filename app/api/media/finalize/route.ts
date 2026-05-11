import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { validateFinalizeMediaRequest } from '@/lib/media-upload-contract'
import { flagMediaPipeline, flagIntensityScan } from '@/lib/flags'

export const runtime = 'nodejs'

const UPLOAD_BUCKET = 'markit-uploads'

/**
 * POST /api/media/finalize
 * Body: { mediaId, sha256, width?, height?, durationSec?, codec? }
 * Response: { ok, mediaId }
 *
 * Called after the browser completes the direct PUT upload.
 * Updates the media row with verified metadata.
 * Optionally enqueues an intensity scan via QStash if the flag is on.
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

  const result = validateFinalizeMediaRequest(rawBody)
  if (!result.ok) {
    return NextResponse.json({ error: 'Invalid request', details: result.details }, { status: 400 })
  }

  const { mediaId, sha256, width, height, durationSec, codec } = result.request

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }
  const service = createServiceClient(url, serviceKey)

  // Verify the media row belongs to this user before patching
  const { data: existing, error: fetchError } = await service
    .schema('markit')
    .from('media')
    .select('id, user_id, source_path, kind')
    .eq('id', mediaId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  type MediaRecord = { id: string; user_id: string; source_path: string; kind: string }
  const mediaRow = existing as MediaRecord

  if (mediaRow.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Verify the object actually exists in storage (confirms upload completed)
  const pathParts = mediaRow.source_path.split('/')
  const folder = pathParts.slice(0, -1).join('/')
  const filename = pathParts.at(-1) ?? ''
  const { data: storageObj } = await service.storage
    .from(UPLOAD_BUCKET)
    .list(folder, { search: filename, limit: 1 })

  if (!storageObj || storageObj.length === 0) {
    return NextResponse.json({ error: 'Upload not found in storage — upload may not have completed' }, { status: 409 })
  }

  // Patch the media row with verified metadata
  const patch: Record<string, unknown> = {}
  if (typeof sha256 === 'string' && sha256) patch.output_sha256 = sha256
  if (width !== undefined) patch.width = width
  if (height !== undefined) patch.height = height
  if (durationSec !== undefined) patch.duration_sec = durationSec
  if (codec !== undefined) patch.codec = codec

  const { error: patchError } = await service
    .schema('markit')
    .from('media')
    .update(patch)
    .eq('id', mediaId)

  if (patchError) {
    console.error('[media/finalize] DB update error:', patchError.message)
    return NextResponse.json({ error: 'Failed to finalize media record' }, { status: 500 })
  }

  // Enqueue intensity scan if the flag is on and the media is a video
  const isVideo = mediaRow.kind === 'video'
  if (flagIntensityScan() && isVideo) {
    const qstashUrl = process.env.QSTASH_URL
    const qstashToken = process.env.QSTASH_TOKEN
    const callbackBase = process.env.NEXT_PUBLIC_MARKIT_APP_URL

    if (qstashUrl && qstashToken && callbackBase) {
      try {
        const scanUrl = `${callbackBase}/api/internal/intensity-scan`
        await fetch(`${qstashUrl}/v2/publish/${encodeURIComponent(scanUrl)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${qstashToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mediaId, userId: user.id }),
        })
      } catch (e) {
        // Non-fatal: scan is best-effort; media is still finalized
        console.warn('[media/finalize] QStash enqueue failed:', (e as Error).message)
      }
    }
  }

  return NextResponse.json({ ok: true, mediaId })
}
