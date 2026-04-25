/** Ported from Creatix `voice-session-context` / `voice-silence-prompts` for Markit Realtime. */

export function isRealtimeUserSpeechEvent(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as { type?: string }
  const t = p.type
  if (t === 'input_audio_buffer.speech_started') return true
  if (t === 'input_audio_buffer.speech_stopped') return true
  return false
}

export function extractRealtimeFunctionCallId(item: { call_id?: string; id?: string }): string | undefined {
  const cid = item.call_id ?? item.id
  return typeof cid === 'string' && cid.length > 0 ? cid : undefined
}

export function injectToolResultFallback(dc: RTCDataChannel, toolName: string, summary: string) {
  const text = `[${toolName} tool result]\n${summary}`.slice(0, 12_000)
  dc.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    }),
  )
  dc.send(
    JSON.stringify({
      type: 'response.create',
      response: { modalities: ['audio'] },
    }),
  )
}

export function triggerRealtimeAssistantResponse(dc: RTCDataChannel) {
  dc.send(
    JSON.stringify({
      type: 'response.create',
      response: { modalities: ['audio'] },
    }),
  )
}

export function summarizeVoiceToolArgs(args: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(args)
    return s.length > 220 ? `${s.slice(0, 220)}…` : s
  } catch {
    return '(args)'
  }
}
