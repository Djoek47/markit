import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { flagLeakMonitor } from '@/lib/flags'

export const runtime = 'nodejs'

// Shape Creatix returns for each leak alert entry.
type CreatixLeakEntry = {
  id: string
  user_id: string
  url: string
  source: 'crawler' | 'reported' | 'manual'
  detected_at: string
  attributed_to_recipient_label?: string | null
  attribution_confidence?: number | null
  attribution_marker_id?: string | null
  attribution_fetched_at?: string | null
  dmca_state?: 'none' | 'drafted' | 'sent' | 'acknowledged'
  dmca_draft_id?: string | null
}

function isInternalAuthorized(req: NextRequest): boolean {
  const secret = process.env.MARKIT_INTERNAL_SECRET
  if (!secret) return false
  return req.headers.get('x-markit-internal-secret') === secret
}

/**
 * POST /api/internal/sync-leaks
 * Called by QStash (or any internal scheduler) to pull new leak alerts from
 * Creatix and upsert them into markit.leak_alert_views.
 *
 * Auth: x-markit-internal-secret header (matches MARKIT_INTERNAL_SECRET env var).
 * Outbound: calls Creatix GET /api/leaks/alerts with CREATIX_LEAKS_API_TOKEN Bearer.
 */
export async function POST(req: NextRequest) {
  if (!flagLeakMonitor()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const creatix = process.env.NEXT_PUBLIC_CREATIX_APP_URL?.replace(/\/+$/, '')
  const leaksToken = process.env.CREATIX_LEAKS_API_TOKEN
  const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!creatix || !leaksToken || !dbUrl || !serviceKey) {
    return NextResponse.json({ error: 'Missing env: NEXT_PUBLIC_CREATIX_APP_URL, CREATIX_LEAKS_API_TOKEN, or Supabase keys' }, { status: 503 })
  }

  // Fetch from Creatix
  let entries: CreatixLeakEntry[]
  try {
    const res = await fetch(`${creatix}/api/leaks/alerts`, {
      headers: { Authorization: `Bearer ${leaksToken}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Creatix responded ${res.status}`, detail: text }, { status: 502 })
    }
    const body = (await res.json()) as { alerts?: CreatixLeakEntry[] }
    entries = body.alerts ?? []
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reach Creatix', detail: (e as Error).message }, { status: 502 })
  }

  if (entries.length === 0) return NextResponse.json({ ok: true, synced: 0 })

  const service = createServiceClient(dbUrl, serviceKey)
  const now = new Date().toISOString()

  const rows = entries.map((e) => ({
    id: e.id,
    user_id: e.user_id,
    url: e.url,
    source: e.source,
    detected_at: e.detected_at,
    attributed_to_recipient_label: e.attributed_to_recipient_label ?? null,
    attribution_confidence: e.attribution_confidence ?? null,
    attribution_marker_id: e.attribution_marker_id ?? null,
    attribution_fetched_at: e.attribution_fetched_at ?? null,
    viewed_at: null,
    dismissed_at: null,
    dmca_state: e.dmca_state ?? 'none',
    dmca_draft_id: e.dmca_draft_id ?? null,
    updated_at: now,
  }))

  const { error } = await service
    .schema('markit')
    .from('leak_alert_views')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, synced: rows.length })
}
