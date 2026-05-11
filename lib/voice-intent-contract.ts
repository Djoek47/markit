// ─── Voice intent contract — request/response for /api/voice/intent ──────────

import type { EditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceIntentContext = {
  /** Total media duration in seconds. */
  durationSec?: number
  /** Current playhead position in seconds. */
  playheadSec?: number
  /** Total number of segments on the timeline. */
  segmentCount?: number
  /** Ordered list of timeline segments for context (truncated to 12). */
  segments?: Array<{ id: string; startSec: number; endSec: number; label?: string }>
}

export type VoiceIntentRequest = {
  /** Transcribed voice command, ≤500 chars. */
  transcript: string
  context?: VoiceIntentContext
}

export type VoiceIntentSuccess = {
  ok: true
  actions: EditorDivineUiAction[]
  /** Short spoken confirmation text for TTS, ≤200 chars. */
  confirmText: string
  /** Whether ALL actions are navigation-only (no confirmation required). */
  navOnly: boolean
  /** Dev-mode only reasoning trace, omitted in production. */
  reasoning?: string
}

export type VoiceIntentError = {
  ok: false
  error: {
    code:
      | 'BAD_JSON'
      | 'INVALID_REQUEST'
      | 'FEATURE_DISABLED'
      | 'RATE_LIMITED'
      | 'UPSTREAM_FAILED'
    message: string
  }
}

export type VoiceIntentResponse = VoiceIntentSuccess | VoiceIntentError

export type VoiceIntentRequestValid = { ok: true; request: VoiceIntentRequest }
export type VoiceIntentRequestInvalid = { ok: false; details: string[] }
export type VoiceIntentRequestResult = VoiceIntentRequestValid | VoiceIntentRequestInvalid

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateVoiceIntentRequest(value: unknown): VoiceIntentRequestResult {
  const issues: string[] = []

  if (value === null || typeof value !== 'object') {
    return { ok: false, details: ['VoiceIntentRequest must be a non-null object'] }
  }

  const o = value as Record<string, unknown>

  if (typeof o.transcript !== 'string' || o.transcript.trim() === '') {
    issues.push('transcript must be a non-empty string')
  } else if (o.transcript.length > 500) {
    issues.push('transcript must not exceed 500 characters')
  }

  if (o.context !== undefined) {
    if (o.context === null || typeof o.context !== 'object') {
      issues.push('context must be an object when present')
    } else {
      const ctx = o.context as Record<string, unknown>
      if (ctx.durationSec !== undefined && (typeof ctx.durationSec !== 'number' || !Number.isFinite(ctx.durationSec))) {
        issues.push('context.durationSec must be a finite number when present')
      }
      if (ctx.playheadSec !== undefined && (typeof ctx.playheadSec !== 'number' || !Number.isFinite(ctx.playheadSec))) {
        issues.push('context.playheadSec must be a finite number when present')
      }
      if (ctx.segmentCount !== undefined && (typeof ctx.segmentCount !== 'number' || !Number.isInteger(ctx.segmentCount) || ctx.segmentCount < 0)) {
        issues.push('context.segmentCount must be a non-negative integer when present')
      }
    }
  }

  if (issues.length > 0) return { ok: false, details: issues }

  return {
    ok: true,
    request: {
      transcript: (o.transcript as string).trim(),
      ...(o.context !== undefined ? { context: o.context as VoiceIntentContext } : {}),
    },
  }
}
