import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { flagMediaPipeline } from '@/lib/flags'
import type { MediaRow } from '@/db/schema'

export const runtime = 'nodejs'

const UPLOAD_BUCKET = 'markit-uploads'
const SIGNED_URL_TTL_SEC = 3600

export type BatchMediaItem = {
  id: string
  kind: MediaRow['kind']
  name: string
  signedUrl: string
  source_size_bytes: number
  width: number | null
  height: number | null
  duration_sec: string | null
  codec: string | null
  imported_at: string
}

/**
 * GET /api/media/batch?ids=id1,id2,...
 * Returns up to 60 owned media rows with 1-hour signed storage URLs.
 * Used by the editor to pre-populate the library sidebar from ?from=library&ids=...
 */
export async function GET(req: NextRequest) {
  if (!flagMediaPipeline()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = req.nextUrl.searchParams.get('ids') ?? ''
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)

  if (ids.length === 0) return NextResponse.json({ items: [] })
  if (ids.length > 60) return NextResponse.json({ error: 'Max 60 ids per request' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  const service = createServiceClient(url, serviceKey)

  const { data: rows, error } = await service
    .schema('markit')
    .from('media')
    .select('id, user_id, kind, source_path, source_size_bytes, width, height, duration_sec, codec, imported_at')
    .in('id', ids)
    .eq('user_id', user.id)
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows || rows.length === 0) return NextResponse.json({ items: [] })

  type PartialRow = Pick<MediaRow, 'id' | 'user_id' | 'kind' | 'source_path' | 'source_size_bytes' | 'width' | 'height' | 'duration_sec' | 'codec' | 'imported_at'>
  const mediaRows = rows as PartialRow[]

  // Generate signed URLs in parallel
  const items: BatchMediaItem[] = await Promise.all(
    mediaRows.map(async (row) => {
      const { data: signed } = await service.storage
        .from(UPLOAD_BUCKET)
        .createSignedUrl(row.source_path, SIGNED_URL_TTL_SEC)

      const ext = row.source_path.split('.').pop() ?? row.kind
      const shortId = row.id.slice(0, 8)
      const name = `${shortId}.${ext}`

      return {
        id: row.id,
        kind: row.kind,
        name,
        signedUrl: signed?.signedUrl ?? '',
        source_size_bytes: row.source_size_bytes,
        width: row.width,
        height: row.height,
        duration_sec: row.duration_sec,
        codec: row.codec,
        imported_at: row.imported_at,
      }
    }),
  )

  // Filter out any that failed to generate a URL (e.g. file deleted from storage)
  return NextResponse.json({ items: items.filter((i) => i.signedUrl) })
}
