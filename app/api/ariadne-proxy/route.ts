import { NextRequest, NextResponse } from 'next/server'
import { sendTraceToCreatix } from '@/lib/ariadne/authority-client'

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

  const upstream = await sendTraceToCreatix(creatix, body as {
    contentId: string
    recipientKey: string
    source: 'vault_standalone' | 'frame_export' | 'message_send' | 'mass_dm'
    lineage?: { jobId?: string; pipelineVersion?: string; encoderProfile?: string }
  }, auth)

  if (!auth && cookie) {
    // Preserve legacy cookie-based compatibility by replaying through direct proxy if needed.
    const fallback = await fetch(`${creatix}/api/ariadne/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    })
    const fallbackText = await fallback.text()
    const fallbackType = fallback.headers.get('content-type') || 'application/json'
    if (fallback.status < 500) {
      return new NextResponse(fallbackText, { status: fallback.status, headers: { 'Content-Type': fallbackType } })
    }
  }

  return new NextResponse(upstream.text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.contentType },
  })
}
