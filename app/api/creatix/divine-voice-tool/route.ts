import { NextRequest, NextResponse } from 'next/server'

const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(/\/$/, '')

/** Proxies Realtime function-call tool runs to Creatix. */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const contentType = req.headers.get('content-type') || 'application/json'
  const body = await req.text()
  const res = await fetch(`${creatix}/api/divine/voice-tool`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Authorization: auth },
    body,
  })
  const text = await res.text()
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
  })
}
