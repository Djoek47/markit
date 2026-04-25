/**
 * Canonical media / timeline model for Markit V5 UI (library + multi-track).
 * Editor runtime still syncs `TimelineSegment[]` to storage; this types the richer model.
 */

export type MediaKind = 'video' | 'audio' | 'image'

export type MediaItem = {
  id: string
  name: string
  kind: MediaKind
  src: string
  importedAt: string
}

export type TrackKind = 'video' | 'audio' | 'overlay'

export type TrackId = 'v2' | 'v1' | 'a1' | 'ov'

export type Track = {
  id: TrackId
  kind: TrackKind
  label: string
  height: number
  visible: boolean
  locked: boolean
  muted: boolean
  proOnly?: boolean
}

export type Clip = {
  id: string
  trackId: TrackId
  mediaId: string
  start: number
  in: number
  out: number
  volume: number
  opacity: number
  speed: number
  fadeInMs: number
  fadeOutMs: number
  source: 'primary' | 'secondary'
  label?: string
}

export type MarkitProject = {
  id: string
  duration: number
  tracks: Track[]
  clips: Clip[]
  pxPerSecond: number
}
