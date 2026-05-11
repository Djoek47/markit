import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

const openai = new OpenAI()

const ALLOWED_VOICES = ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer'] as const
type TtsVoice = (typeof ALLOWED_VOICES)[number]

function isAllowedVoice(v: unknown): v is TtsVoice {
  return typeof v === 'string' && (ALLOWED_VOICES as readonly string[]).includes(v)
}

export async function POST(req: NextRequest) {
  // Auth gate
  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { text?: unknown; voice?: unknown }
  try {
    body = (await req.json()) as { text?: unknown; voice?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: 'text exceeds 4096 character limit' }, { status: 400 })
  }

  const voice: TtsVoice = isAllowedVoice(body.voice) ? body.voice : 'nova'

  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3',
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.byteLength),
        // Short cache: same text + voice → same audio for 10 min
        'Cache-Control': 'private, max-age=600',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[voice/tts] OpenAI error:', msg)
    return NextResponse.json({ error: `TTS failed: ${msg}` }, { status: 502 })
  }
}
