import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

export const runtime = 'nodejs'

/**
 * POST { recipientLabel }
 *   → { payloadId }
 *
 * Mints a UUID payload and stores a trace_exports row so /detect
 * can resolve it to a recipient later.
 * Used by browser-side v2 video watermarking (Canvas + MediaRecorder)
 * where the embed happens client-side.
 */
export async function POST(req: NextRequest) {
  const supabase = await createRouteHandlerClient(req)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let recipientLabel: string
  try {
    const body = (await req.json()) as { recipientLabel?: string }
    recipientLabel = (body.recipientLabel ?? '').trim().slice(0, 500)
    if (!recipientLabel) throw new Error('recipientLabel is required')
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Bad request' }, { status: 400 })
  }

  const payloadId = randomUUID()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && serviceKey) {
    const service = createServiceClient(url, serviceKey)
    await service.schema('markit').from('trace_exports').insert({
      user_id: user.id,
      payload_id: payloadId,
      recipient_label: recipientLabel,
      source_path: `browser-v2/${user.id}/${payloadId}`,
      algorithm: 'frame-v2',
    })
  }

  return NextResponse.json({ ok: true, payloadId })
}
