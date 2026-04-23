import type { MarkitEditPlanV1 } from '@/lib/markit-edit-plan'
import { planNeedsSecondarySource } from '@/lib/markit-edit-plan'
import { concatMp4Blobs, cropVideoToMp4, trimVideoToMp4, type ComposeProgress } from '@/lib/ffmpeg-trim'

/**
 * Execute a v1 plan in the browser: trims + concat. Multi-angle needs both blobs when segments use `secondary`.
 */
export async function runMarkitEditPlan(
  primaryBlob: Blob,
  secondaryBlob: Blob | null,
  plan: MarkitEditPlanV1,
  onProgress?: (p: ComposeProgress) => void,
): Promise<Blob> {
  if (plan.kind === 'side_by_side') {
    throw new Error(
      'Side-by-side layout is not implemented yet. Ask for a compilation or single-angle teaser instead.',
    )
  }

  if (planNeedsSecondarySource(plan) && !secondaryBlob) {
    throw new Error(
      'This plan uses a second camera. Launch Markit with a second vault bridge: add importUrl2, exportUrl2, and exportToken2 to the URL (second vault item), or use only primary segments.',
    )
  }

  const parts: Blob[] = []
  const n = plan.segments.length
  for (let i = 0; i < n; i++) {
    const seg = plan.segments[i]
    const src = seg.source ?? 'primary'
    const blob = src === 'secondary' ? secondaryBlob! : primaryBlob
    onProgress?.({
      stage: 'run',
      pct: Math.round(((i + 0.5) / n) * 85),
      message: `Rendering cut ${i + 1}/${n}…`,
    })
    const trimmed = await trimVideoToMp4(blob, seg.startSec, seg.endSec, onProgress)
    const rendered = plan.crop ? await cropVideoToMp4(trimmed, plan.crop, onProgress) : trimmed
    parts.push(rendered)
  }

  onProgress?.({ stage: 'run', pct: 88, message: 'Joining clips…' })
  return concatMp4Blobs(parts, onProgress)
}
