export type ClipId = string

export type TimelineClip = {
  id: ClipId
  source: 'primary' | 'secondary'
  startSec: number
  endSec: number
  label?: string
}

export type TimelineTrack = {
  id: string
  name: string
  clips: TimelineClip[]
}

export type TimelineState = {
  durationSec: number
  tracks: TimelineTrack[]
  revision: number
}

export type TimelineOperation =
  | { op: 'add_clip'; trackId: string; clip: TimelineClip }
  | { op: 'update_clip'; trackId: string; clipId: string; patch: Partial<TimelineClip> }
  | { op: 'remove_clip'; trackId: string; clipId: string }
  | { op: 'reorder_clip'; trackId: string; clipId: string; toIndex: number }
  | { op: 'split_clip'; trackId: string; clipId: string; splitAtSec: number }

export function createInitialTimeline(durationSec = 0): TimelineState {
  return {
    durationSec: Math.max(0, durationSec),
    revision: 1,
    tracks: [{ id: 'main', name: 'Main Track', clips: [] }],
  }
}

export function clampRange(startSec: number, endSec: number, durationSec: number): { startSec: number; endSec: number } {
  const d = Math.max(0, durationSec)
  const a = Math.max(0, Math.min(startSec, d))
  const b = Math.max(a + 0.05, Math.min(endSec, d))
  return { startSec: a, endSec: b }
}

export function applyTimelineOperation(state: TimelineState, operation: TimelineOperation): TimelineState {
  const next: TimelineState = {
    ...state,
    tracks: state.tracks.map((t) => ({ ...t, clips: [...t.clips] })),
    revision: state.revision + 1,
  }
  const track = next.tracks.find((t) => t.id === operation.trackId)
  if (!track) return next

  if (operation.op === 'add_clip') {
    const clamped = clampRange(operation.clip.startSec, operation.clip.endSec, next.durationSec)
    track.clips.push({ ...operation.clip, ...clamped })
    return next
  }
  const idx = track.clips.findIndex((c) => c.id === operation.clipId)
  if (idx < 0) return next
  const clip = track.clips[idx]

  if (operation.op === 'update_clip') {
    const merged = { ...clip, ...operation.patch }
    const clamped = clampRange(merged.startSec, merged.endSec, next.durationSec)
    track.clips[idx] = { ...merged, ...clamped }
    return next
  }
  if (operation.op === 'remove_clip') {
    track.clips.splice(idx, 1)
    return next
  }
  if (operation.op === 'reorder_clip') {
    const [item] = track.clips.splice(idx, 1)
    const to = Math.max(0, Math.min(operation.toIndex, track.clips.length))
    track.clips.splice(to, 0, item)
    return next
  }
  if (operation.op === 'split_clip') {
    const splitAt = Math.max(clip.startSec + 0.05, Math.min(operation.splitAtSec, clip.endSec - 0.05))
    const left: TimelineClip = { ...clip, endSec: splitAt }
    const right: TimelineClip = { ...clip, id: crypto.randomUUID(), startSec: splitAt, label: `${clip.label || 'Clip'} B` }
    track.clips.splice(idx, 1, left, right)
    return next
  }
  return next
}

