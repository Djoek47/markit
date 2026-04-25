/**
 * Structured edit plans emitted by Frame Assist (see ```markit-edit``` blocks).
 * v1: trim segments from one or two sources, concatenate in order (teaser, compilation, rough cut).
 */

export type MarkitEditSource = 'primary' | 'secondary'

export const MARKIT_OUTPUT_FORMATS = ['mp4', 'mov', 'webm', 'gif', 'jpg', 'png', 'webp'] as const
export type MarkitOutputFormat = (typeof MARKIT_OUTPUT_FORMATS)[number]

export type MarkitEditPlanV1 = {
  version: 1
  /** concat_segments = default; side_by_side reserved for future (requires different ffmpeg graph) */
  kind?: 'concat_segments' | 'side_by_side'
  label?: string
  /** Optional global crop rectangle applied to all rendered segments (normalized 0..1). */
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Export / render target — kept small for Creatix embed lineage; avoid huge bespoke payloads in embed. */
  output?: {
    format: MarkitOutputFormat
    aspectPreset?: string
    encoderProfile?: string
  }
  segments: {
    startSec: number
    endSec: number
    /** Default primary when omitted */
    source?: MarkitEditSource
  }[]
}

const BLOCK = /```markit-edit\s*([\s\S]*?)```/i

export function extractMarkitEditPlanFromMessage(text: string): MarkitEditPlanV1 | null {
  const m = text.match(BLOCK)
  if (!m?.[1]) return null
  return parseMarkitEditPlanJson(m[1].trim())
}

/** Latest assistant message with a valid plan (scan newest first). */
export function findLatestEditPlan(
  messages: { role: string; text: string }[],
): MarkitEditPlanV1 | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant') continue
    const plan = extractMarkitEditPlanFromMessage(msg.text)
    if (plan) return plan
  }
  return null
}

export function parseMarkitEditPlanJson(raw: string): MarkitEditPlanV1 | null {
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== 'object') return null
    const o = j as Record<string, unknown>
    if (o.version !== 1) return null
    if (!Array.isArray(o.segments) || o.segments.length === 0) return null

    const segments: MarkitEditPlanV1['segments'] = []
    for (const s of o.segments) {
      if (!s || typeof s !== 'object') return null
      const seg = s as Record<string, unknown>
      const startSec = Number(seg.startSec)
      const endSec = Number(seg.endSec)
      if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) return null
      const src = seg.source
      const source: MarkitEditSource | undefined =
        src === 'secondary' ? 'secondary' : src === 'primary' || src === undefined ? 'primary' : undefined
      if (src !== undefined && source === undefined) return null
      segments.push({
        startSec,
        endSec,
        ...(source === 'secondary' ? { source: 'secondary' as const } : {}),
      })
    }

    const kind = o.kind
    if (kind !== undefined && kind !== 'concat_segments' && kind !== 'side_by_side') return null

    const cropRaw = o.crop as Record<string, unknown> | undefined
    let crop: MarkitEditPlanV1['crop'] | undefined
    if (cropRaw) {
      const x = Number(cropRaw.x)
      const y = Number(cropRaw.y)
      const width = Number(cropRaw.width)
      const height = Number(cropRaw.height)
      const valid =
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        x >= 0 &&
        y >= 0 &&
        width > 0 &&
        height > 0 &&
        x + width <= 1 &&
        y + height <= 1
      if (valid) crop = { x, y, width, height }
    }

    const outRaw = o.output as Record<string, unknown> | undefined
    let output: MarkitEditPlanV1['output']
    if (outRaw && typeof outRaw === 'object') {
      const fmt = outRaw.format
      if (typeof fmt === 'string' && (MARKIT_OUTPUT_FORMATS as readonly string[]).includes(fmt)) {
        output = {
          format: fmt as MarkitOutputFormat,
          aspectPreset: typeof outRaw.aspectPreset === 'string' ? outRaw.aspectPreset : undefined,
          encoderProfile: typeof outRaw.encoderProfile === 'string' ? outRaw.encoderProfile : undefined,
        }
      }
    }

    return {
      version: 1,
      kind: kind as MarkitEditPlanV1['kind'],
      label: typeof o.label === 'string' ? o.label : undefined,
      ...(crop ? { crop } : {}),
      ...(output ? { output } : {}),
      segments,
    }
  } catch {
    return null
  }
}

export function planNeedsSecondarySource(plan: MarkitEditPlanV1): boolean {
  return plan.segments.some((s) => s.source === 'secondary')
}
