export type VoiceEditIntent =
  | { type: 'trim_window'; seconds: number }
  | { type: 'crop_profile'; profile: 'center_9_16' | 'wide_16_9' | 'square_1_1' }
  | { type: 'make_teasers'; count: number; durationSec: number }
  | { type: 'apply_preset'; preset: string }
  | { type: 'unknown'; raw: string }

function readNumber(text: string, fallback: number): number {
  const m = text.match(/(\d{1,3})/)
  if (!m) return fallback
  const n = Number.parseInt(m[1], 10)
  if (!Number.isFinite(n)) return fallback
  return n
}

export function routeVoiceIntent(transcript: string): VoiceEditIntent {
  const t = transcript.toLowerCase().trim()
  if (!t) return { type: 'unknown', raw: transcript }
  if (t.includes('teaser') || t.includes('clips')) {
    return {
      type: 'make_teasers',
      count: Math.max(1, Math.min(8, readNumber(t, 3))),
      durationSec: Math.max(6, Math.min(60, readNumber(t, 15))),
    }
  }
  if (t.includes('crop') || t.includes('9:16') || t.includes('vertical')) {
    return { type: 'crop_profile', profile: 'center_9_16' }
  }
  if (t.includes('trim') || t.includes('cut')) {
    return { type: 'trim_window', seconds: Math.max(5, Math.min(120, readNumber(t, 15))) }
  }
  if (t.includes('preset')) {
    return { type: 'apply_preset', preset: transcript.replace(/preset/gi, '').trim() || 'teaser' }
  }
  return { type: 'unknown', raw: transcript }
}

