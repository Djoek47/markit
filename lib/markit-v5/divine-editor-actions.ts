import type { MediaContext } from '@/lib/stores/editor-shell-store'

/**
 * Suggested UI actions for the Markit editor (ghost navigation / Divine).
 * Parity checklist when merging with Creatix:
 * - `seek_playhead` → preview `currentTime`
 * - `set_density` → `data-density` / Simple|Pro
 * - `set_media_context` → `data-media-context` / Video|Image
 * - `focus_inspector` → inspector tab id
 * - SSE envelope: `event: divine_action` + `data: {"action":{...}}`
 */
export type EditorDivineUiAction =
  | { type: 'seek_playhead'; sec: number }
  | { type: 'set_density'; density: 'simple' | 'pro' }
  | { type: 'set_media_context'; context: MediaContext }
  | { type: 'focus_inspector'; tab: 'clip' | 'crop' | 'trim' | 'export' | 'trace' }
  | { type: 'noop'; reason?: string }

export function parseEditorDivineUiAction(raw: unknown): EditorDivineUiAction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const t = o.type
  if (t === 'seek_playhead' && typeof o.sec === 'number' && Number.isFinite(o.sec)) {
    return { type: 'seek_playhead', sec: Math.max(0, o.sec) }
  }
  if (t === 'set_density' && (o.density === 'simple' || o.density === 'pro')) {
    return { type: 'set_density', density: o.density }
  }
  if (t === 'set_media_context' && (o.context === 'video' || o.context === 'image')) {
    return { type: 'set_media_context', context: o.context }
  }
  if (t === 'focus_inspector') {
    const tab = o.tab
    if (tab === 'clip' || tab === 'crop' || tab === 'trim' || tab === 'export' || tab === 'trace') {
      return { type: 'focus_inspector', tab }
    }
  }
  if (t === 'noop') {
    return { type: 'noop', reason: typeof o.reason === 'string' ? o.reason : undefined }
  }
  return null
}
