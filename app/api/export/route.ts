import { NextRequest, NextResponse } from 'next/server'

/**
 * Optional proxy: forwards multipart to Creatix with `X-Frame-Export-Secret`.
 * The Markit editor POSTs **directly** to Creatix `exportUrl` instead (avoids Vercel ~4.5MB body limits).
 * Keep this route for scripts or older clients.
 */
const DEFAULT_HOSTS = ['www.circeetvenus.com', 'circeetvenus.com']

function isAllowedExportUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const extra = (process.env.CREATIX_EXPORT_HOST_ALLOWLIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const allow = new Set([...DEFAULT_HOSTS, ...extra])
    if (!allow.has(u.hostname)) return false
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return /\/api\/content\/vault\/[^/]+\/frame-export$/.test(path)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.FRAME_EXPORT_SECRET
  if (!secret || secret.length < 8) {
    return NextResponse.json(
      { error: 'FRAME_EXPORT_SECRET is not configured on this Markit deployment' },
      { status: 503 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const exportUrlRaw = formData.get('exportUrl')
  const exportUrl = typeof exportUrlRaw === 'string' ? exportUrlRaw.trim() : ''
  if (!exportUrl || !isAllowedExportUrl(exportUrl)) {
    return NextResponse.json({ error: 'Invalid or disallowed exportUrl' }, { status: 400 })
  }

  const exportTokenRaw = formData.get('exportToken')
  const exportToken = typeof exportTokenRaw === 'string' ? exportTokenRaw : null
  if (!exportToken) {
    return NextResponse.json({ error: 'Missing exportToken' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const out = new FormData()
  out.append('file', file)
  out.append('exportToken', exportToken)

  const upstream = await fetch(exportUrl, {
    method: 'POST',
    headers: { 'X-Frame-Export-Secret': secret },
    body: out,
  })

  const text = await upstream.text()
  const contentType = upstream.headers.get('content-type') || 'application/json'

  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': contentType },
  })
}
