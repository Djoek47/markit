import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(/\/$/, '')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Same-origin proxy to Creatix `GET /api/divine/action-stream` (SSE) — browser talks only to Markit;
 * session cookie is turned into Bearer for Creatix server-side.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ error: 'Supabase not configured on Markit' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        /* no-op */
      },
    },
  })
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const upstream = await fetch(`${creatix}/api/divine/action-stream`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: 'text/event-stream',
    },
    cache: 'no-store',
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    })
  }

  if (!upstream.body) {
    return NextResponse.json({ error: 'Empty upstream body' }, { status: 502 })
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
