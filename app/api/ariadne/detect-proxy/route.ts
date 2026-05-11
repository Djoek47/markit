import { NextRequest, NextResponse } from 'next/server'
import { buildAriadneM2MRequestHeaders } from '@/lib/ariadne/creatix-ariadne-client'
import { checkRateLimit, rateLimitKeyFromRequest } from '@/lib/rate-limit'

const DETECT_MAX_BYTES = 120 * 1024 * 1024 // 120 MB, matches Creatix
const DETECT_LIMIT = 60
const DETECT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/**
 * Multipart proxy: forwards /api/ariadne/detect requests to Creatix.
 *
 * Auth chain:
 * 1. If browser sent `Authorization: Bearer <token>`, forward as-is (vault export token).
 * 2. Otherwise, sign with M2M headers.
 *
 * Size limit: rejects 413 if Content-Length > 120 MB.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(rateLimitKeyFromRequest(req), DETECT_LIMIT, DETECT_WINDOW_MS)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    )
  }

  const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(/\/$/, '')

  // Check Content-Length before reading body
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const bytes = parseInt(contentLength, 10)
    if (bytes > DETECT_MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (${bytes} > ${DETECT_MAX_BYTES} bytes)` },
        { status: 413 },
      )
    }
  }

  let body: FormData
  try {
    body = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
  }

  // Auth: try Bearer token first, then M2M
  const auth = req.headers.get('authorization')
  const headers: Record<string, string> = {}

  if (auth?.startsWith('Bearer ')) {
    // Forward browser's vault export token as-is
    headers.Authorization = auth
  } else {
    // Sign with M2M
    const m2mHeaders = buildAriadneM2MRequestHeaders({
      serviceName: 'markit',
      actorUserId: process.env.CREATIX_ACTOR_USER_ID?.trim() || undefined,
      pathname: '/api/ariadne/detect',
      method: 'POST',
      bodySha256: '',
      json: false,
    })
    Object.assign(headers, m2mHeaders)
  }

  // Forward buffered multipart form data to Creatix (body already read via formData() above)
  const res = await fetch(`${creatix}/api/ariadne/detect`, {
    method: 'POST',
    headers,
    body,
  })

  const responseText = await res.text()
  const contentType = res.headers.get('content-type') || 'application/json'

  return new NextResponse(responseText, {
    status: res.status,
    headers: { 'Content-Type': contentType },
  })
}
