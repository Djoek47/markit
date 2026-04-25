import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(/\/$/, '')

/**
 * Proxies to Creatix `POST /api/divine/test-enqueue` with the user session and
 * `DIVINE_TEST_ENQUEUE_SECRET` (must match the value configured on Creatix).
 */
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ error: 'Supabase not configured on Markit' }, { status: 503 })
  }

  const testSecret = process.env.DIVINE_TEST_ENQUEUE_SECRET?.trim()
  if (!testSecret) {
    return NextResponse.json(
      { error: 'DIVINE_TEST_ENQUEUE_SECRET is not set on this Markit deployment' },
      { status: 503 },
    )
  }

  const bodyText = await req.text()

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
    return NextResponse.json({ error: 'Sign in to use the test enqueue' }, { status: 401 })
  }

  const res = await fetch(`${creatix}/api/divine/test-enqueue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      'x-divine-test-secret': testSecret,
    },
    body: bodyText,
  })
  const text = await res.text()
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
  })
}
