import { NextRequest, NextResponse } from 'next/server'
import { routeVoiceIntent } from '@/lib/divine/voice-intent-router'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { transcript?: string } | null
  const transcript = body?.transcript?.trim() || ''
  if (!transcript) return NextResponse.json({ error: 'transcript is required' }, { status: 400 })

  const intent = routeVoiceIntent(transcript)
  const confirmation =
    intent.type === 'unknown'
      ? 'I did not fully understand that voice command. Please confirm manually.'
      : 'Voice intent parsed. Review and confirm before applying.'

  return NextResponse.json({
    success: true,
    transcript,
    intent,
    confirmation,
    undoAvailable: true,
  })
}

