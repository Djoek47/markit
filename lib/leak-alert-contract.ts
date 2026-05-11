// ─── Leak alert contract — vault-side leak detection and DMCA state ──────────

export type LeakAlertSource = 'crawler' | 'reported' | 'manual'
export type DmcaState = 'none' | 'drafted' | 'sent' | 'acknowledged'
export type LeakSeverity = 'high' | 'medium' | 'low'

export type LeakAlertView = {
  id: string
  url: string
  source: LeakAlertSource
  /** ISO 8601 timestamp. */
  detectedAt: string
  /** Recipient label from Ariadne attribution, if identified. */
  attributedToRecipientLabel?: string
  /** 0..1 confidence from Ariadne detector. */
  attributionConfidence?: number
  /** Ariadne marker/payload ID used for attribution. */
  attributionMarkerId?: string
  /** ISO 8601 timestamp of last attribution fetch. */
  attributionFetchedAt?: string
  /** ISO 8601 timestamp when the creator viewed this alert. */
  viewedAt?: string
  /** ISO 8601 timestamp when the creator dismissed this alert. */
  dismissedAt?: string
  dmcaState: DmcaState
  /** DMCA draft ID if one was generated. */
  dmcaDraftId?: string
}

export type LeakAlertViewValid = { ok: true; view: LeakAlertView }
export type LeakAlertViewInvalid = { ok: false; details: string[] }
export type LeakAlertViewResult = LeakAlertViewValid | LeakAlertViewInvalid

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_SOURCES: ReadonlySet<LeakAlertSource> = new Set(['crawler', 'reported', 'manual'])
const VALID_DMCA_STATES: ReadonlySet<DmcaState> = new Set(['none', 'drafted', 'sent', 'acknowledged'])

/**
 * Classify a leak alert's severity based on Ariadne attribution confidence.
 *
 * - high: confidence ≥ 0.85 AND attributed to a recipient
 * - medium: confidence ≥ 0.55 AND attributed to a recipient
 * - low: anything else
 */
export function classifyLeakAlertSeverity(view: LeakAlertView): LeakSeverity {
  const conf = view.attributionConfidence ?? 0
  const hasRecipient = typeof view.attributedToRecipientLabel === 'string'
  if (hasRecipient && conf >= 0.85) return 'high'
  if (hasRecipient && conf >= 0.55) return 'medium'
  return 'low'
}

/**
 * Returns true when the alert is active and needs creator attention:
 * not dismissed, DMCA not yet initiated, and never viewed.
 */
export function leakAlertNeedsAttention(view: LeakAlertView): boolean {
  return (
    view.dismissedAt == null &&
    view.dmcaState === 'none' &&
    view.viewedAt == null
  )
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateLeakAlertView(value: unknown): LeakAlertViewResult {
  const issues: string[] = []

  if (value === null || typeof value !== 'object') {
    return { ok: false, details: ['LeakAlertView must be a non-null object'] }
  }

  const o = value as Record<string, unknown>

  if (typeof o.id !== 'string' || !o.id) issues.push('id must be a non-empty string')
  if (typeof o.url !== 'string' || !o.url) issues.push('url must be a non-empty string')
  if (!VALID_SOURCES.has(o.source as LeakAlertSource)) {
    issues.push(`source must be one of: ${[...VALID_SOURCES].join(', ')}`)
  }
  if (typeof o.detectedAt !== 'string' || !o.detectedAt) issues.push('detectedAt must be a non-empty string')
  if (!VALID_DMCA_STATES.has(o.dmcaState as DmcaState)) {
    issues.push(`dmcaState must be one of: ${[...VALID_DMCA_STATES].join(', ')}`)
  }

  // Optional string fields
  const optStrings: (keyof LeakAlertView)[] = [
    'attributedToRecipientLabel', 'attributionMarkerId', 'attributionFetchedAt',
    'viewedAt', 'dismissedAt', 'dmcaDraftId',
  ]
  for (const field of optStrings) {
    if (o[field] !== undefined && typeof o[field] !== 'string') {
      issues.push(`${field} must be a string when present`)
    }
  }

  // attributionConfidence (optional number 0..1)
  if (o.attributionConfidence !== undefined) {
    if (typeof o.attributionConfidence !== 'number' || !Number.isFinite(o.attributionConfidence) ||
        o.attributionConfidence < 0 || o.attributionConfidence > 1) {
      issues.push('attributionConfidence must be a finite number between 0 and 1')
    }
  }

  if (issues.length > 0) return { ok: false, details: issues }

  return {
    ok: true,
    view: {
      id: o.id as string,
      url: o.url as string,
      source: o.source as LeakAlertSource,
      detectedAt: o.detectedAt as string,
      dmcaState: o.dmcaState as DmcaState,
      ...(typeof o.attributedToRecipientLabel === 'string' ? { attributedToRecipientLabel: o.attributedToRecipientLabel } : {}),
      ...(typeof o.attributionConfidence === 'number' ? { attributionConfidence: o.attributionConfidence } : {}),
      ...(typeof o.attributionMarkerId === 'string' ? { attributionMarkerId: o.attributionMarkerId } : {}),
      ...(typeof o.attributionFetchedAt === 'string' ? { attributionFetchedAt: o.attributionFetchedAt } : {}),
      ...(typeof o.viewedAt === 'string' ? { viewedAt: o.viewedAt } : {}),
      ...(typeof o.dismissedAt === 'string' ? { dismissedAt: o.dismissedAt } : {}),
      ...(typeof o.dmcaDraftId === 'string' ? { dmcaDraftId: o.dmcaDraftId } : {}),
    },
  }
}
