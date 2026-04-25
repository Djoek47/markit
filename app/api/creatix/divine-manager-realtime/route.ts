import { NextRequest, NextResponse } from 'next/server'

const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(/\/$/, '')

/**
 * Forwards the WebRTC Realtime session POST to Creatix with the caller's Supabase access token
 * (same user pool as Markit) so the browser does not need cross-origin cookies.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const contentType = req.headers.get('content-type') || 'application/json'
  const body = await req.text()
  const res = await fetch(`${creatix}/api/ai/divine-manager-realtime`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Authorization: auth },
    body,
  })
  const text = await res.text()
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'text/plain' },
  })
}
