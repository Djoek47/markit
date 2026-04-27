import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { extractAppendV1 } from '@/lib/trace/append-v1'
import { buildDetectVerdict, formatVerdictLine } from '@/lib/trace/detect-interpret'
import { TRACE_MAX_SOURCE_BYTES } from '@/lib/trace/storage'

export const runtime = 'nodejs'

/**
 * POST multipart { file }
 *   → { ok, verdict: DetectVerdict, line: string }
 *
 * 1. Verify the user is authenticated.
 * 2. Check Content-Length header (120 MB hard cap).
 * 3. Read multipart file field as Buffer.
 * 4. Call extractAppendV1 to parse the marker.
 * 5. If marker_valid, look up payload_id in markit.trace_exports.
 * 6. Build a verdict and return JSON.
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

  // 2. Check Content-Length header.
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const bytes = parseInt(contentLength, 10)
    if (isNaN(bytes) || bytes > 120 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 120 MB)' }, { status: 413 })
    }
  }

  let fileBuffer: Buffer
  try {
    // 3. Read multipart file field.
    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file field is required and must be a File' }, { status: 400 })
    }
    if (file.size > TRACE_MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'File exceeds size cap (1 GB)' }, { status: 413 })
    }
    fileBuffer = Buffer.from(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'Failed to read file from multipart body' }, { status: 400 })
  }

  // 4. Extract the marker.
  const extract = extractAppendV1(fileBuffer)

  // 5. If marker is valid, look up the payload_id in the registry.
  let registryRow: { recipient_label: string; algorithm: string } | null = null
  if (extract.state === 'marker_valid' && extract.payload) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
    }
    const service = createServiceClient(url, serviceKey)

    const { data, error } = await service
      .schema('markit')
      .from('trace_exports')
      .select('recipient_label, algorithm')
      .eq('payload_id', extract.payload.payloadId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: `Database error: ${error.message}`, code: 'db_error' },
        { status: 500 },
      )
    }

    registryRow = data
  }

  // 6. Build verdict and return.
  const verdict = buildDetectVerdict(extract, registryRow)
  const line = formatVerdictLine(verdict)

  return NextResponse.json({
    ok: true,
    verdict,
    line,
  })
}
