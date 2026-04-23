import { NextRequest, NextResponse } from 'next/server'
import { detectWatermarkFromSignals } from '@/lib/forensics/detectWatermark'
import { flagAriadneConfidenceGate, flagAriadneV2Detect } from '@/lib/flags'

export async function POST(request: NextRequest) {
  if (!flagAriadneV2Detect()) {
    return NextResponse.json({ error: 'ARIADNE_V2_DETECT_ENABLED is disabled' }, { status: 403 })
  }
  const body = (await request.json().catch(() => null)) as
    | { extractedBitstrings?: string[]; knownPayloadRefs?: string[] }
    | null
  if (!body?.extractedBitstrings?.length) {
    return NextResponse.json({ error: 'extractedBitstrings required' }, { status: 400 })
  }
  const result = detectWatermarkFromSignals({
    extractedBitstrings: body.extractedBitstrings,
    knownPayloadRefs: body.knownPayloadRefs ?? [],
  })
  const threshold = 0.85
  const confidenceGatePassed = !flagAriadneConfidenceGate() || result.confidence >= threshold
  return NextResponse.json({
    ...result,
    confidenceGatePassed,
    confidenceThreshold: threshold,
  })
}

