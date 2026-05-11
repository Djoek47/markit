import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { flagMediaPipeline } from '@/lib/flags'

export const runtime = 'nodejs'

const UPLOAD_BUCKET = 'markit-uploads'

/**
 * DELETE /api/media/[id]
 * Removes a media row and its storage object. User must own the row.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!flagMediaPipeline()) {
    return NextResponse.json({ error: 'Feature disabled' }, { status: 403 })
  }

  const { id } = await params

  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  const service = createServiceClient(url, serviceKey)

  const { data: row, error: fetchErr } = await service
    .schema('markit')
    .from('media')
    .select('id, user_id, source_path, source_bucket')
    .eq('id', id)
    .single()

  if (fetchErr || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type MediaMeta = { id: string; user_id: string; source_path: string; source_bucket: string }
  const media = row as MediaMeta

  if (media.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Remove storage object (best-effort — don't block if it's already gone)
  await service.storage.from(UPLOAD_BUCKET).remove([media.source_path]).catch(() => {})

  const { error: deleteErr } = await service
    .schema('markit')
    .from('media')
    .delete()
    .eq('id', id)

  if (deleteErr) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
