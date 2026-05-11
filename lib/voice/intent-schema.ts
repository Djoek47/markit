/**
 * Shared types for /api/voice/intent request + response.
 * Kept in lib/ so the route, the voice hook, and tests can all import from one place.
 */
import type { EditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'

export type VoiceIntentContext = {
  /** Total duration of the source video in seconds. */
  durationSec?: number
  /** Current playhead position in seconds. */
  playheadSec?: number
  /** Number of segments currently on the timeline. */
  segmentCount?: number
  /**
   * Lightweight summary of each segment for the model:
   * [{ id, startSec, endSec, label? }]
   * Trimmed to the first 12 segments to stay within token budget.
   */
  segments?: Array<{ id: string; startSec: number; endSec: number; label?: string }>
}

export type VoiceIntentRequest = {
  transcript: string
  context?: VoiceIntentContext
}

export type VoiceIntentResponse = {
  /** One or more actions to enqueue for confirmation (timeline edits) or apply directly (nav). */
  actions: EditorDivineUiAction[]
  /**
   * Human-readable confirmation message the voice model should speak back,
   * e.g. "Got it — I'll split the clip at 5 seconds. Confirm to apply."
   */
  confirmationText: string
  /** Whether all actions are nav-only (no confirmation needed). */
  navOnly: boolean
}
