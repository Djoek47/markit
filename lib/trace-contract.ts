// ─── Trace contract — Ariadne watermark layer configuration ──────────────────

export type TracePlatform = 'onlyfans' | 'fansly' | 'manyvids' | 'custom'

export type TraceLayers = {
  /** Embed a spatial grid marker in the video frames. */
  spatialGrid: boolean
  /** Embed redundant markers across multiple time windows. */
  temporalRedundancy: boolean
  /** Append a metadata marker in the container's post-EOF region (append-v1). */
  metadataAppend: boolean
}

export type TraceRequest = {
  recipientLabel: string
  recipientPlatform?: TracePlatform
  recipientPlatformId?: string
  layers: TraceLayers
}

export type TraceRequestValid = { ok: true; request: TraceRequest }
export type TraceRequestInvalid = { ok: false; details: string[] }
export type TraceRequestResult = TraceRequestValid | TraceRequestInvalid

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Default layers: only metadataAppend (append-v1) is on at launch. */
export function defaultTraceLayers(): TraceLayers {
  return { spatialGrid: false, temporalRedundancy: false, metadataAppend: true }
}

const VALID_PLATFORMS: ReadonlySet<TracePlatform> = new Set([
  'onlyfans',
  'fansly',
  'manyvids',
  'custom',
])

function isTracePlatform(v: unknown): v is TracePlatform {
  return typeof v === 'string' && VALID_PLATFORMS.has(v as TracePlatform)
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateTraceRequest(value: unknown): TraceRequestResult {
  const issues: string[] = []

  if (value === null || typeof value !== 'object') {
    return { ok: false, details: ['TraceRequest must be a non-null object'] }
  }

  const o = value as Record<string, unknown>

  // recipientLabel
  if (typeof o.recipientLabel !== 'string' || o.recipientLabel.trim() === '') {
    issues.push('recipientLabel must be a non-empty string')
  }

  // recipientPlatform (optional)
  if (o.recipientPlatform !== undefined && !isTracePlatform(o.recipientPlatform)) {
    issues.push(`recipientPlatform must be one of: ${[...VALID_PLATFORMS].join(', ')}`)
  }

  // recipientPlatformId (optional)
  if (o.recipientPlatformId !== undefined && typeof o.recipientPlatformId !== 'string') {
    issues.push('recipientPlatformId must be a string when present')
  }

  // layers
  if (o.layers === null || typeof o.layers !== 'object') {
    issues.push('layers must be a non-null object')
  } else {
    const l = o.layers as Record<string, unknown>
    if (typeof l.spatialGrid !== 'boolean') issues.push('layers.spatialGrid must be boolean')
    if (typeof l.temporalRedundancy !== 'boolean') issues.push('layers.temporalRedundancy must be boolean')
    if (typeof l.metadataAppend !== 'boolean') issues.push('layers.metadataAppend must be boolean')
  }

  if (issues.length > 0) return { ok: false, details: issues }

  const layers = o.layers as Record<string, boolean>
  return {
    ok: true,
    request: {
      recipientLabel: (o.recipientLabel as string).trim(),
      ...(isTracePlatform(o.recipientPlatform) ? { recipientPlatform: o.recipientPlatform } : {}),
      ...(typeof o.recipientPlatformId === 'string' ? { recipientPlatformId: o.recipientPlatformId } : {}),
      layers: {
        spatialGrid: layers.spatialGrid,
        temporalRedundancy: layers.temporalRedundancy,
        metadataAppend: layers.metadataAppend,
      },
    },
  }
}
