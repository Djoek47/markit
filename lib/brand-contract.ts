// ─── Brand contract — brand watermark overlay configuration ──────────────────

export type BrandPlatform = 'onlyfans' | 'fansly' | 'manyvids' | 'custom'

export type BrandPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type BrandSnapshot = {
  enabled: boolean
  platform: BrandPlatform
  handle: string
  position: BrandPosition
  /** Overlay opacity, 20–100 (inclusive). */
  opacityPct: number
  /** Absolute URL of a creator-uploaded logo, if any. */
  customLogoUrl?: string
}

export type BrandSnapshotValid = { ok: true; snapshot: BrandSnapshot }
export type BrandSnapshotInvalid = { ok: false; details: string[] }
export type BrandSnapshotResult = BrandSnapshotValid | BrandSnapshotInvalid

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PLATFORMS: ReadonlySet<BrandPlatform> = new Set([
  'onlyfans', 'fansly', 'manyvids', 'custom',
])

const VALID_POSITIONS: ReadonlySet<BrandPosition> = new Set([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format the brand handle into a displayable profile URL / handle string.
 *
 * @example
 * formatBrandHandle({ platform: 'onlyfans', handle: 'cisse', ... })
 * // → "onlyfans.com/cisse"
 */
export function formatBrandHandle(snapshot: BrandSnapshot): string {
  const h = snapshot.handle.replace(/^@/, '')
  switch (snapshot.platform) {
    case 'onlyfans': return `onlyfans.com/${h}`
    case 'fansly': return `fansly.com/${h}`
    case 'manyvids': return `manyvids.com/Profile/${h}`
    case 'custom': return `@${h}`
  }
}

/** Default brand snapshot for new creators. */
export function defaultBrandSnapshot(): BrandSnapshot {
  return {
    enabled: false,
    platform: 'onlyfans',
    handle: '',
    position: 'bottom-right',
    opacityPct: 80,
  }
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateBrandSnapshot(value: unknown): BrandSnapshotResult {
  const issues: string[] = []

  if (value === null || typeof value !== 'object') {
    return { ok: false, details: ['BrandSnapshot must be a non-null object'] }
  }

  const o = value as Record<string, unknown>

  if (typeof o.enabled !== 'boolean') issues.push('enabled must be boolean')

  if (!VALID_PLATFORMS.has(o.platform as BrandPlatform)) {
    issues.push(`platform must be one of: ${[...VALID_PLATFORMS].join(', ')}`)
  }

  if (typeof o.handle !== 'string' || o.handle.trim() === '') {
    issues.push('handle must be a non-empty string')
  }

  if (!VALID_POSITIONS.has(o.position as BrandPosition)) {
    issues.push(`position must be one of: ${[...VALID_POSITIONS].join(', ')}`)
  }

  if (typeof o.opacityPct !== 'number' || !Number.isFinite(o.opacityPct) || o.opacityPct < 20 || o.opacityPct > 100) {
    issues.push('opacityPct must be a number between 20 and 100 (inclusive)')
  }

  if (o.customLogoUrl !== undefined && typeof o.customLogoUrl !== 'string') {
    issues.push('customLogoUrl must be a string when present')
  }

  if (issues.length > 0) return { ok: false, details: issues }

  return {
    ok: true,
    snapshot: {
      enabled: o.enabled as boolean,
      platform: o.platform as BrandPlatform,
      handle: (o.handle as string).trim(),
      position: o.position as BrandPosition,
      opacityPct: o.opacityPct as number,
      ...(typeof o.customLogoUrl === 'string' ? { customLogoUrl: o.customLogoUrl } : {}),
    },
  }
}
