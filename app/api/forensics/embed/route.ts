import { NextRequest, NextResponse } from 'next/server'
import { runEmbedV2Worker } from '@/lib/jobs/embed-v2-worker'
import { flagAriadneV2Embed } from '@/lib/flags'

export async function POST(request: NextRequest) {
  if (!flagAriadneV2Embed()) {
    return NextResponse.json({ error: 'ARIADNE_V2_EMBED_ENABLED is disabled' }, { status: 403 })
  }
  const body = (await request.json().catch(() => null)) as
    | { inputPath?: string; outputPath?: string; payloadRef?: string; frameCount?: number; fps?: number }
    | null
  if (!body?.inputPath || !body?.outputPath || !body?.payloadRef) {
    return NextResponse.json({ error: 'inputPath, outputPath, payloadRef required' }, { status: 400 })
  }
  const result = await runEmbedV2Worker({
    inputPath: body.inputPath,
    outputPath: body.outputPath,
    payloadRef: body.payloadRef,
    frameCount: Math.max(1, body.frameCount ?? 300),
    fps: Math.max(1, body.fps ?? 30),
  })
  return NextResponse.json({ success: true, result })
}

