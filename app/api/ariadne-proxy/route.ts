import { NextRequest, NextResponse } from 'next/server'

/**
 * Forwards Ariadne embed to Creatix with the same auth the browser would send,
 * so Markit stays same-origin and cookies / Bearer tokens work reliably.
 */
export async function POST(req: NextRequest) {
  const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(
    /\/$/,
    '',
  )

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const auth = req.headers.get('authorization')
  const cookie = req.headers.get('cookie')

  const upstream = await fetch(`${creatix}/api/ariadne/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })

  const text = await upstream.text()
  const ct = upstream.headers.get('content-type') || 'application/json'
  return new NextResponse(text, { status: upstream.status, headers: { 'Content-Type': ct } })
}
