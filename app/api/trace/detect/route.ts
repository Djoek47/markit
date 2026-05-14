import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { extractAppendV1 } from '@/lib/trace/append-v1'
import { buildDetectVerdict, formatVerdictLine } from '@/lib/trace/detect-interpret'
import { TRACE_MAX_SOURCE_BYTES } from '@/lib/trace/storage'
import { detectV2FromImage } from '@/lib/ariadne-v2/detect-v2'

export const runtime = 'nodejs'

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

function isImageMime(mime: string): boolean {
  return IMAGE_MIMES.has(mime.toLowerCase().split(';')[0].trim())
}

function buildAriadneAuthHeader(body: string): string {
  const secret = process.env.MARKIT_ARIADNE_SHARED_SECRET ?? ''
  const ts = Date.now().toString()
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
  return `Markit ts=${ts},sig=${sig}`
}

/**
 * POST multipart { file }
 *   → { ok, verdict, line }
 *
 * Two paths:
 *
 * IMAGE (PNG/JPEG/WebP — e.g. a screenshot):
 *   Runs local Ariadne v2 frame-level detection (no Creatix dependency).
 *   sharp decodes compressed pixels → LCG+LSB+majority-vote+parity algorithm.
 *   Returns attributed payload_id if v2 watermark was embedded.
 *
 * VIDEO:
 *   Runs local append-v1 extraction (post-EOF bytes). Fast, no Creatix call.
 *   Falls back to Creatix detect-v2 if local extraction finds no marker and
 *   ARIADNE_V2_EMBED_ENABLED=1 (handles v2-traced videos too).
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient(req)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const bytes = parseInt(contentLength, 10)
    if (isNaN(bytes) || bytes > 120 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 120 MB)' }, { status: 413 })
    }
  }

  let file: File
  try {
    const formData = await req.formData()
    const f = formData.get('file')
    if (!f || !(f instanceof File)) {
      return NextResponse.json({ error: 'file field is required and must be a File' }, { status: 400 })
    }
    if (f.size > TRACE_MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: 'File exceeds size cap (1 GB)' }, { status: 413 })
    }
    file = f
  } catch {
    return NextResponse.json({ error: 'Failed to read file from multipart body' }, { status: 400 })
  }

  const creatixUrl = process.env.NEXT_PUBLIC_CREATIX_APP_URL ?? ''

  // ── IMAGE PATH: screenshot → local Ariadne v2 frame-level detect ────────────
  // Uses ported algorithm (LCG + LSB + majority vote + parity decode) — no Creatix dependency.
  // sharp decodes compressed PNG/JPEG/WebP to raw grayscale pixels before detection.
  if (isImageMime(file.type)) {
    try {
      const imageBuffer = Buffer.from(await file.arrayBuffer())
      const result = await detectV2FromImage(imageBuffer)

      if (result.match_state === 'none' || !result.payload_candidates.length) {
        return NextResponse.json({
          ok: true,
          verdict: { kind: 'no_marker' },
          line: 'No Ariadne v2 watermark detected in this image.',
        })
      }

      const best = result.payload_candidates[0]!

      // If we decoded a full UUID, try to resolve it to a recipient in trace_exports
      if (best.source === 'watermark_v2_uuid') {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (url && serviceKey) {
          const service = createServiceClient(url, serviceKey)

          // First: check current user's own records
          const { data: row } = await service
            .schema('markit')
            .from('trace_exports')
            .select('recipient_label, algorithm, created_at')
            .eq('payload_id', best.payload_id)
            .eq('user_id', user.id)
            .maybeSingle()

          if (row) {
            const verdict = {
              kind: 'identified' as const,
              recipientLabel: row.recipient_label as string,
              payloadIdShort: best.payload_id.slice(0, 8),
              algorithmVersion: (row.algorithm as string) ?? 'frame-v2',
            }
            return NextResponse.json({
              ok: true,
              verdict,
              line: `Traced to ${row.recipient_label} (frame watermark, ${(best.confidence * 100).toFixed(1)}% confidence)`,
            })
          }

          // Second: cross-account lookup — payload may belong to a different user's trace
          // Returns recipient_label only (no user identity exposed)
          const { data: crossRow } = await service
            .schema('markit')
            .from('trace_exports')
            .select('recipient_label, algorithm')
            .eq('payload_id', best.payload_id)
            .maybeSingle()

          if (crossRow) {
            const verdict = {
              kind: 'v2_candidate' as const,
              payload_id: best.payload_id,
              confidence: best.confidence,
              source: best.source,
              recipient_hint: crossRow.recipient_label as string,
            }
            return NextResponse.json({
              ok: true,
              verdict,
              line: `Frame watermark matched recipient "${crossRow.recipient_label}" (${(best.confidence * 100).toFixed(1)}% confidence) — traced by a different account.`,
            })
          }
        }
      }

      // Watermark found but not in this user's records (or hash-only payload)
      const verdict = {
        kind: 'v2_candidate' as const,
        payload_id: best.payload_id,
        confidence: best.confidence,
        source: best.source,
      }
      const line = `Ariadne v2 watermark detected (${(best.confidence * 100).toFixed(1)}% confidence) — payload not in your trace records.`
      return NextResponse.json({ ok: true, verdict, line, detect_v2: result })
    } catch (e) {
      console.error('[trace/detect] image path error:', (e as Error).message)
      return NextResponse.json({ error: 'Image detection failed' }, { status: 500 })
    }
  }

  // ── VIDEO PATH: append-v1 local extraction ────────────────────────────────────
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const extract = extractAppendV1(fileBuffer)

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
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 })
    }
    registryRow = data
  }

  // If no v1 marker found, try Creatix v2 detect (handles v2-traced videos)
  if (extract.state !== 'marker_valid' && creatixUrl && process.env.ARIADNE_V2_EMBED_ENABLED === '1') {
    try {
      const fwd = new FormData()
      fwd.append('file', file)
      const creatixRes = await fetch(`${creatixUrl}/api/ariadne/detect-v2`, {
        method: 'POST',
        headers: { Authorization: buildAriadneAuthHeader('') },
        body: fwd,
      })
      if (creatixRes.ok) {
        const result = await creatixRes.json() as { verdict?: unknown; line?: string }
        return NextResponse.json({ ok: true, ...result })
      }
    } catch {
      // Non-fatal — fall through to v1 verdict
    }
  }

  const verdict = buildDetectVerdict(extract, registryRow)
  const line = formatVerdictLine(verdict)
  return NextResponse.json({ ok: true, verdict, line })
}
