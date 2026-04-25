import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

const COOLDOWN_MS = 30_000
const lastByUser = new Map<string, number>()

const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(/\/$/, '')

export const dynamic = 'force-dynamic'

/**
 * Rate-limited proxy to Creatix `POST /api/ariadne/detect` (multipart).
 * Enforces at most one request per signed-in user every 30 seconds.
 */
export async function POST(request: NextRequest) {
  const supabase = await createRouteHandlerClient(request)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const prev = lastByUser.get(user.id) ?? 0
  if (now - prev < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (now - prev)) / 1000)
    return NextResponse.json(
      { error: `Rate limited: try again in ${waitSec}s`, code: 'detect_cooldown', retryAfterSec: waitSec },
      { status: 429, headers: { 'Retry-After': String(waitSec) } },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const forwardAuth = request.headers.get('authorization')?.trim()
  if (!forwardAuth) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
  }

  const upstream = await fetch(`${creatix}/api/ariadne/detect`, {
    method: 'POST',
    headers: { Authorization: forwardAuth },
    body: form,
  })

  if (upstream.ok) {
    lastByUser.set(user.id, now)
  }

  const text = await upstream.text()
  const ct = upstream.headers.get('content-type') || 'application/json'
  return new NextResponse(text, { status: upstream.status, headers: { 'Content-Type': ct } })
}
