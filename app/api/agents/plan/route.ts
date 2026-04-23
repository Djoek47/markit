import { NextRequest, NextResponse } from 'next/server'
import { orchestrateBrief } from '@/lib/agents/orchestrator'
import { agentPlanToOperations } from '@/lib/agents/plans-to-timeline'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { objective?: string; tone?: string; targetDurationSec?: number; style?: string; platform?: 'of' | 'fansly' | 'generic'; durationSec?: number }
    | null
  if (!body?.objective) return NextResponse.json({ error: 'objective is required' }, { status: 400 })

  const plan = orchestrateBrief(
    {
      objective: body.objective,
      tone: body.tone,
      targetDurationSec: body.targetDurationSec,
      style: body.style,
      platform: body.platform,
    },
    Math.max(8, body.durationSec ?? body.targetDurationSec ?? 30),
  )

  return NextResponse.json({
    success: true,
    plan,
    deterministicOperations: agentPlanToOperations(plan),
  })
}

