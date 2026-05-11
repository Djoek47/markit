import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { flagLeakMonitor } from '@/lib/flags'
import type { LeakAlertView } from '@/lib/leak-alert-contract'
import type { LeakAlertViewRow } from '@/db/schema'

export const runtime = 'nodejs'

function rowToView(row: LeakAlertViewRow): LeakAlertView {
  return {
    id: row.id,
    url: row.url,
    source: row.source,
    detectedAt: row.detected_at,
    dmcaState: row.dmca_state,
    ...(row.attributed_to_recipient_label ? { attributedToRecipientLabel: row.attributed_to_recipient_label } : {}),
    ...(row.attribution_confidence ? { attributionConfidence: parseFloat(row.attribution_confidence) } : {}),
    ...(row.attribution_marker_id ? { attributionMarkerId: row.attribution_marker_id } : {}),
    ...(row.attribution_fetched_at ? { attributionFetchedAt: row.attribution_fetched_at } : {}),
    ...(row.viewed_at ? { viewedAt: row.viewed_at } : {}),
    ...(row.dismissed_at ? { dismissedAt: row.dismissed_at } : {}),
    ...(row.dmca_draft_id ? { dmcaDraftId: row.dmca_draft_id } : {}),
  }
}

/**
 * GET /api/leaks?limit=20&offset=0
 * Returns the user's leak alert views ordered by detected_at desc.
 * Active (non-dismissed) alerts first.
 */
export async function GET(req: NextRequest) {
  if (!flagLeakMonitor()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  const service = createServiceClient(url, serviceKey)

  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 40)))
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? 0))

  const { data: rows, error, count } = await service
    .schema('markit')
    .from('leak_alert_views')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('dismissed_at', { ascending: true, nullsFirst: true })
    .order('detected_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const alerts = (rows ?? []).map((r) => rowToView(r as LeakAlertViewRow))
  return NextResponse.json({ alerts, total: count ?? 0 })
}
