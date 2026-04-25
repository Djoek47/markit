import { NextRequest, NextResponse } from 'next/server'
import type { MarkitEditPlanV1 } from '@/lib/markit-edit-plan'

export const dynamic = 'force-dynamic'

type RenderBody = {
  plan?: MarkitEditPlanV1
  /** Optional blob URL or server-side ref — spike does not pull remote video yet */
  sourceRef?: string
}

/**
 * Server render spike: validates an EditPlan-shaped body. Full ffmpeg + Blob upload requires
 * long-running / fluid compute and is not enabled in default serverless builds.
 */
export async function POST(request: NextRequest) {
  let body: RenderBody
  try {
    body = (await request.json()) as RenderBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.plan || body.plan.version !== 1 || !Array.isArray(body.plan.segments)) {
    return NextResponse.json({ error: 'plan.version 1 with segments is required' }, { status: 400 })
  }

  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  if (!hasBlob) {
    return NextResponse.json(
      {
        ok: true,
        status: 'spike',
        message:
          'EditPlan accepted. Configure BLOB_READ_WRITE_TOKEN and a long-running transcode environment to materialize output.',
        received: { segmentCount: body.plan.segments.length, output: body.plan.output },
      },
      { status: 200 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      status: 'queued',
      message: 'Blob is configured; wire server ffmpeg in a long-running function to complete this spike.',
    },
    { status: 202 },
  )
}
