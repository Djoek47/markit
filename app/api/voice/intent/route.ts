import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { parseEditorDivineUiAction, isTimelineEditAction } from '@/lib/markit-v5/divine-editor-actions'
import type { VoiceIntentRequest, VoiceIntentResponse } from '@/lib/voice/intent-schema'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a video-editing assistant embedded in the Markit editor.
Your job: parse a voice transcript into one or more structured editor actions.

You MUST call the \`emit_actions\` tool with your result — do not respond with plain text.

Available action types (emit as JSON objects):

Navigation (applied immediately, no confirmation):
  { "type": "seek_playhead", "sec": <number> }
  { "type": "set_density", "density": "simple"|"pro" }
  { "type": "set_media_context", "context": "video"|"image" }
  { "type": "focus_inspector", "tab": "clip"|"crop"|"trim"|"export"|"trace" }
  { "type": "noop", "reason": <string> }

Timeline editing (queued for user confirmation):
  { "type": "split_segment", "splitAtSec": <number>, "segmentId"?: <string> }
  { "type": "trim_segment", "segmentId": <string>, "startSec"?: <number>, "endSec"?: <number> }
  { "type": "remove_segment", "segmentId": <string> }
  { "type": "reorder_segment", "segmentId": <string>, "toIndex": <number> }
  { "type": "set_crop_profile", "profile": "9:16"|"16:9"|"1:1"|"4:5"|"3:4"|"original" }
  { "type": "set_segment_speed", "segmentId": <string>, "speedPct": <number 25-400> }
  { "type": "set_segment_fade", "segmentId": <string>, "fadeInMs"?: <number 0-5000>, "fadeOutMs"?: <number 0-5000> }

Rules:
- Use the playhead position and segment list from context to resolve "this clip", "the first clip", etc.
- When a time is mentioned without a segment (e.g. "split at 5 seconds"), emit split_segment with splitAtSec only.
- For crop commands: "vertical" / "portrait" / "9:16" → profile "9:16"; "landscape" / "widescreen" → "16:9"; "square" → "1:1".
- If the command is unclear, emit { "type": "noop", "reason": "..." } and set confirmationText accordingly.
- Keep confirmationText short (one sentence), friendly, and in first person ("I'll…").
- navOnly = true when ALL emitted actions are navigation-only types.`

const EMIT_ACTIONS_TOOL: Anthropic.Tool = {
  name: 'emit_actions',
  description: 'Emit the parsed editor actions and confirmation message.',
  input_schema: {
    type: 'object' as const,
    properties: {
      actions: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of EditorDivineUiAction objects.',
      },
      confirmationText: {
        type: 'string',
        description: 'Short spoken confirmation for the user.',
      },
    },
    required: ['actions', 'confirmationText'],
  },
}

export async function POST(req: NextRequest) {
  // Auth gate
  const supabase = await createRouteHandlerClient(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: VoiceIntentRequest
  try {
    body = (await req.json()) as VoiceIntentRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const transcript = body.transcript?.trim()
  if (!transcript) {
    return NextResponse.json({ error: 'transcript is required' }, { status: 400 })
  }

  const ctx = body.context ?? {}
  const contextLines: string[] = []
  if (ctx.durationSec !== undefined) contextLines.push(`Video duration: ${ctx.durationSec.toFixed(1)}s`)
  if (ctx.playheadSec !== undefined) contextLines.push(`Playhead: ${ctx.playheadSec.toFixed(1)}s`)
  if (ctx.segmentCount !== undefined) contextLines.push(`Timeline segments: ${ctx.segmentCount}`)
  if (ctx.segments && ctx.segments.length > 0) {
    const segSummary = ctx.segments.slice(0, 12).map((s, i) =>
      `  [${i}] id=${s.id} ${s.startSec.toFixed(1)}s–${s.endSec.toFixed(1)}s${s.label ? ` (${s.label})` : ''}`
    ).join('\n')
    contextLines.push(`Segments:\n${segSummary}`)
  }

  const userContent = contextLines.length
    ? `Context:\n${contextLines.join('\n')}\n\nTranscript: "${transcript}"`
    : `Transcript: "${transcript}"`

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: [EMIT_ACTIONS_TOOL],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: userContent }],
    })

    // Extract tool use block
    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!toolUse || toolUse.name !== 'emit_actions') {
      return NextResponse.json<VoiceIntentResponse>({
        actions: [{ type: 'noop', reason: 'Model did not return structured actions.' }],
        confirmationText: "I didn't catch that — could you say it again?",
        navOnly: true,
      })
    }

    const input = toolUse.input as { actions?: unknown[]; confirmationText?: string }
    const rawActions = Array.isArray(input.actions) ? input.actions : []
    const actions = rawActions
      .map((a) => parseEditorDivineUiAction(a))
      .filter((a): a is NonNullable<typeof a> => a !== null)

    if (actions.length === 0) {
      actions.push({ type: 'noop', reason: 'No valid actions parsed.' })
    }

    const confirmationText =
      typeof input.confirmationText === 'string' && input.confirmationText.trim()
        ? input.confirmationText.trim()
        : "Got it."

    const navOnly = actions.every((a) => !isTimelineEditAction(a))

    return NextResponse.json<VoiceIntentResponse>({ actions, confirmationText, navOnly })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[voice/intent] Claude error:', msg)
    return NextResponse.json({ error: `Intent parsing failed: ${msg}` }, { status: 502 })
  }
}
