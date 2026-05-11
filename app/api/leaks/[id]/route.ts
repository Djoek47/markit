import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { flagLeakMonitor } from '@/lib/flags'

export const runtime = 'nodejs'

/**
 * PATCH /api/leaks/[id]
 * Body: { action: 'view' | 'dismiss' }
 * Marks the alert as viewed or dismissed. Ownership-checked.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!flagLeakMonitor()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  const { id } = await params

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.action !== 'view' && body.action !== 'dismiss') {
    return NextResponse.json({ error: 'action must be "view" or "dismiss"' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  const service = createServiceClient(url, serviceKey)

  // Ownership check
  const { data: row, error: fetchErr } = await service
    .schema('markit')
    .from('leak_alert_views')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((row as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const patch =
    body.action === 'view'
      ? { viewed_at: now, updated_at: now }
      : { dismissed_at: now, updated_at: now }

  const { error: patchErr } = await service
    .schema('markit')
    .from('leak_alert_views')
    .update(patch)
    .eq('id', id)

  if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
