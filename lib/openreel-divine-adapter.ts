import type { EditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'
import { useProjectStore } from '@/vendor/openreel/web/stores/project-store'
import type { Project } from '@/vendor/openreel/core/types'

// Markit sec → OpenReel ms: multiply by 1000
// OpenReel fade values are in seconds, divine uses ms: divide by 1000

const ASPECT_DIMENSIONS: Partial<Record<string, { width: number; height: number }>> = {
  '9:16':        { width: 1080, height: 1920 },
  '9:16-of':     { width: 1080, height: 1920 },
  '9:16-fansly': { width: 1080, height: 1920 },
  '16:9':        { width: 1920, height: 1080 },
  '1:1':         { width: 1080, height: 1080 },
  '4:5':         { width: 1080, height: 1350 },
  '3:4':         { width: 1080, height: 1440 },
  // 'original' intentionally absent — caller returns false
}

function findClipById(project: Project, clipId: string) {
  for (const track of project.timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId)
    if (clip) return clip
  }
  return null
}

function findClipAtMs(project: Project, timeMs: number) {
  for (const track of project.timeline.tracks) {
    const clip = track.clips.find(
      (c) => timeMs > c.startTime && timeMs < c.startTime + c.duration,
    )
    if (clip) return clip
  }
  return null
}

/**
 * Translates a Markit divine action into an OpenReel project-store call.
 * Returns true if the action was handled, false to fall through to MarkitEditorV2 applier.
 * Async side effects are fired-and-forgotten; the boolean return is synchronous.
 */
export function applyDivineActionToOpenReel(action: EditorDivineUiAction): boolean {
  const store = useProjectStore.getState()
  const { project } = store
  if (!project) return false

  switch (action.type) {
    case 'split_segment': {
      const splitAtMs = action.splitAtSec * 1000
      const clipId = action.segmentId ?? findClipAtMs(project, splitAtMs)?.id
      if (!clipId) return false
      void store.splitClip(clipId, splitAtMs)
      return true
    }

    case 'trim_segment': {
      if (!findClipById(project, action.segmentId)) return false
      const inPoint = action.startSec !== undefined ? action.startSec * 1000 : undefined
      const outPoint = action.endSec !== undefined ? action.endSec * 1000 : undefined
      void store.trimClip(action.segmentId, inPoint, outPoint)
      return true
    }

    case 'remove_segment': {
      void store.rippleDeleteClip(action.segmentId)
      return true
    }

    case 'set_segment_fade': {
      void store.executeAction({
        type: 'audio/setFade',
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        params: {
          clipId: action.segmentId,
          ...(action.fadeInMs !== undefined && { fadeIn: action.fadeInMs / 1000 }),
          ...(action.fadeOutMs !== undefined && { fadeOut: action.fadeOutMs / 1000 }),
        },
      })
      return true
    }

    case 'set_crop_profile': {
      const dims = ASPECT_DIMENSIONS[action.profile]
      if (!dims) return false
      void store.updateSettings(dims)
      return true
    }

    case 'crop_to_aspect': {
      const dims = ASPECT_DIMENSIONS[action.aspect]
      if (!dims) return false
      void store.updateSettings(dims)
      return true
    }

    // set_segment_speed / set_clip_speed — no speed action in OpenReel executor
    // reorder_segment — clip timing reorder is handled by MarkitEditorV2
    // All nav, trace, brand, library, vault actions — not OpenReel domain
    default:
      return false
  }
}
