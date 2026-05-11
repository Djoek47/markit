import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { validateBrandSnapshot, defaultBrandSnapshot } from '@/lib/brand-contract'
import { flagBrandPersistence } from '@/lib/flags'
import type { BrandSnapshot } from '@/lib/brand-contract'
import type { BrandSettingsRow } from '@/db/schema'

export const runtime = 'nodejs'

function rowToSnapshot(row: BrandSettingsRow): BrandSnapshot {
  return {
    enabled: row.auto_apply,
    platform: row.platform,
    handle: row.handle,
    position: row.position,
    opacityPct: row.opacity_pct,
    ...(row.custom_logo_path ? { customLogoUrl: row.custom_logo_path } : {}),
  }
}

/**
 * GET /api/brand
 * Returns the user's brand settings as a BrandSnapshot.
 * Returns the default snapshot if no row exists yet.
 */
export async function GET(req: NextRequest) {
  if (!flagBrandPersistence()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  const service = createServiceClient(url, serviceKey)

  const { data: row } = await service
    .schema('markit')
    .from('brand_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const snapshot = row ? rowToSnapshot(row as BrandSettingsRow) : defaultBrandSnapshot()
  return NextResponse.json({ snapshot })
}

/**
 * PUT /api/brand
 * Body: BrandSnapshot
 * Upserts brand_settings for the authenticated user.
 */
export async function PUT(req: NextRequest) {
  if (!flagBrandPersistence()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = validateBrandSnapshot(body)
  if (!result.ok) {
    return NextResponse.json({ error: 'Invalid brand snapshot', details: result.details }, { status: 400 })
  }

  const snap = result.snapshot
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  const service = createServiceClient(url, serviceKey)

  const { error } = await service
    .schema('markit')
    .from('brand_settings')
    .upsert(
      {
        user_id: user.id,
        platform: snap.platform,
        handle: snap.handle,
        position: snap.position,
        opacity_pct: snap.opacityPct,
        custom_logo_path: snap.customLogoUrl ?? null,
        auto_apply: snap.enabled,
        markit_only: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
