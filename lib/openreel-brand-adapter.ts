import type { BrandSnapshot, BrandPosition } from '@/lib/brand-contract'
import { formatBrandHandle } from '@/lib/brand-contract'
import { useProjectStore } from '@/vendor/openreel/web/stores/project-store'

const BRAND_TRACK_NAME = 'Brand Watermark'

// Normalized position within the frame (0–1). Anchor is at clip centre.
const POSITION_MAP: Record<BrandPosition, { x: number; y: number }> = {
  'top-left':      { x: 0.05, y: 0.05 },
  'top-center':    { x: 0.5,  y: 0.05 },
  'top-right':     { x: 0.85, y: 0.05 },
  'middle-left':   { x: 0.05, y: 0.5  },
  'middle-center': { x: 0.5,  y: 0.5  },
  'middle-right':  { x: 0.85, y: 0.5  },
  'bottom-left':   { x: 0.05, y: 0.9  },
  'bottom-center': { x: 0.5,  y: 0.9  },
  'bottom-right':  { x: 0.85, y: 0.9  },
}

// Module-level state — one brand clip per editor session.
let _brandClipId: string | null = null
let _brandTrackId: string | null = null

/**
 * Apply (or remove) a brand watermark text overlay on the OpenReel project.
 * Safe to call on project load and whenever brand settings change.
 */
export async function applyBrandToOpenReelProject(snapshot: BrandSnapshot): Promise<void> {
  const store = useProjectStore.getState()

  // Remove the previous watermark clip if present
  if (_brandClipId) {
    store.deleteTextClip(_brandClipId)
    _brandClipId = null
  }

  if (!snapshot.enabled) return

  // Resolve brand track — reuse if still present, otherwise create one
  const { project } = useProjectStore.getState()
  const existingTrack = _brandTrackId
    ? project.timeline.tracks.find((t) => t.id === _brandTrackId)
    : null

  if (!existingTrack) {
    const preIds = new Set(project.timeline.tracks.map((t) => t.id))
    const result = await useProjectStore.getState().addTrack('text')
    if (!result?.success) return

    const fresh = useProjectStore.getState()
    const newTrack = fresh.project.timeline.tracks.find(
      (t) => t.type === 'text' && !preIds.has(t.id),
    )
    if (!newTrack) return

    _brandTrackId = newTrack.id
    fresh.renameTrack(newTrack.id, BRAND_TRACK_NAME)
  }

  if (!_brandTrackId) return

  // Span the full timeline; fall back to 1 hour for an empty project
  const freshProject = useProjectStore.getState().project
  const totalMs =
    freshProject.timeline.duration ||
    freshProject.timeline.tracks
      .flatMap((t) => t.clips)
      .reduce((max, c) => Math.max(max, c.startTime + c.duration), 0) ||
    3_600_000

  const handle = formatBrandHandle(snapshot)
  const clip = useProjectStore.getState().createTextClip(_brandTrackId, 0, handle, totalMs, {
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'sans-serif',
    fontWeight: 700,
    fontStyle: 'normal',
    textAlign: 'left',
    lineHeight: 1.2,
    letterSpacing: 0,
    verticalAlign: 'middle',
  })
  if (!clip) return

  _brandClipId = clip.id

  useProjectStore.getState().updateTextTransform(clip.id, {
    position: POSITION_MAP[snapshot.position],
    opacity: snapshot.opacityPct / 100,
  })
}

/** Reset internal state — used in tests and when the editor unmounts. */
export function resetBrandState(): void {
  _brandClipId = null
  _brandTrackId = null
}
