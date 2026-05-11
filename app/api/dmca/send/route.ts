import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { flagDmcaForwarder } from '@/lib/flags'
import type { LeakAlertViewRow } from '@/db/schema'

export const runtime = 'nodejs'

/**
 * POST /api/dmca/send
 * Body: { leakViewId: string }
 *
 * Forwards to Creatix POST /api/dmca/send to dispatch the drafted DMCA notice.
 * Requires dmca_state = 'drafted' and a dmca_draft_id on the row.
 * Updates local leak_alert_views: dmca_state → 'sent'.
 * Feature-gated: MARKIT_FEATURE_DMCA_FORWARDER=1
 */
export async function POST(req: NextRequest) {
  if (!flagDmcaForwarder()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { leakViewId?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.leakViewId !== 'string' || !body.leakViewId) {
    return NextResponse.json({ error: 'leakViewId required' }, { status: 400 })
  }

  const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const creatix = process.env.NEXT_PUBLIC_CREATIX_APP_URL?.replace(/\/+$/, '')
  const leaksToken = process.env.CREATIX_LEAKS_API_TOKEN

  if (!dbUrl || !serviceKey || !creatix || !leaksToken) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }

  const service = createServiceClient(dbUrl, serviceKey)

  // Ownership + state check
  const { data: row, error: fetchErr } = await service
    .schema('markit')
    .from('leak_alert_views')
    .select('id, user_id, dmca_state, dmca_draft_id')
    .eq('id', body.leakViewId)
    .single()

  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const alertRow = row as Pick<LeakAlertViewRow, 'id' | 'user_id' | 'dmca_state' | 'dmca_draft_id'>
  if (alertRow.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (alertRow.dmca_state !== 'drafted') {
    return NextResponse.json({ error: `Expected dmca_state 'drafted', got '${alertRow.dmca_state}'` }, { status: 409 })
  }
  if (!alertRow.dmca_draft_id) {
    return NextResponse.json({ error: 'No draft ID on record — generate a draft first' }, { status: 409 })
  }

  // Forward to Creatix
  try {
    const res = await fetch(`${creatix}/api/dmca/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${leaksToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ leakAlertId: alertRow.id, draftId: alertRow.dmca_draft_id }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Creatix responded ${res.status}`, detail: text }, { status: 502 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reach Creatix', detail: (e as Error).message }, { status: 502 })
  }

  // Patch local row
  const now = new Date().toISOString()
  const { error: patchErr } = await service
    .schema('markit')
    .from('leak_alert_views')
    .update({ dmca_state: 'sent', updated_at: now })
    .eq('id', body.leakViewId)

  if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
