/**
 * Interpret Creatix /api/ariadne/detect response into a user-facing verdict.
 */

export type DetectVerdict =
  | { kind: 'identified'; recipientLabel: string; confidencePct: number; payloadIdShort: string; algorithmVersion?: string }
  | { kind: 'candidate'; confidencePct: number; reason: string }
  | { kind: 'no_marker' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'error'; message: string }

/**
 * Parse a Creatix detect response into a DetectVerdict.
 *
 * Response shape (from Creatix docs):
 * - match_state: 'marker_valid_registered' | 'marker_valid_unregistered' | 'no_marker' | 'marker_invalid_signature' | 'marker_expired'
 * - confidence: 0–1 (float)
 * - recipient_username, recipient_display_name, recipient_key: strings (at least one present for registered)
 * - payload_id: UUID (optional)
 * - algorithm_version: string (optional)
 * - match_reason: string (optional, for unregistered matches)
 */
export function interpretDetectResponse(resp: unknown): DetectVerdict {
  // Type check
  if (resp === null || resp === undefined || typeof resp !== 'object') {
    return { kind: 'error', message: 'No response' }
  }

  const obj = resp as Record<string, unknown>

  // Check for explicit error field
  if (typeof obj.error === 'string') {
    return { kind: 'error', message: obj.error }
  }

  const matchState = obj.match_state as string | undefined
  const confidence = typeof obj.confidence === 'number' ? obj.confidence : 0
  const confidencePct = Math.max(0, Math.min(100, confidence * 100))

  // Route by match_state
  if (matchState === 'marker_valid_registered') {
    const username = obj.recipient_username as string | undefined
    const displayName = obj.recipient_display_name as string | undefined
    const recipientKey = obj.recipient_key as string | undefined
    const recipientLabel = username || displayName || recipientKey || ''

    if (recipientLabel.length === 0) {
      // Defensive: Creatix said registered but didn't tell us who. Fall through to
      // candidate rather than show "Sent to unknown" — that's a worse UX than a muted
      // "marker found but unattributed" message.
      return {
        kind: 'candidate',
        confidencePct,
        reason: 'registered marker but recipient unresolved',
      }
    }

    const payloadId = obj.payload_id as string | undefined
    const payloadIdShort = payloadId ? payloadId.slice(0, 8) : ''

    const algorithmVersion = obj.algorithm_version as string | undefined

    return {
      kind: 'identified',
      recipientLabel,
      confidencePct,
      payloadIdShort,
      ...(algorithmVersion && { algorithmVersion }),
    }
  }

  if (matchState === 'marker_valid_unregistered') {
    const reason = (obj.match_reason as string | undefined) || 'valid marker, no canonical record'
    return { kind: 'candidate', confidencePct, reason }
  }

  if (matchState === 'no_marker') {
    return { kind: 'no_marker' }
  }

  if (matchState === 'marker_invalid_signature') {
    return { kind: 'invalid', reason: 'marker signature did not verify' }
  }

  if (matchState === 'marker_expired') {
    return { kind: 'invalid', reason: 'marker payload expired' }
  }

  if (matchState === undefined) {
    return { kind: 'error', message: 'No response' }
  }

  return { kind: 'error', message: `unexpected match_state: ${matchState}` }
}

/**
 * Format a DetectVerdict into a single-line user-facing string.
 */
export function formatVerdictLine(verdict: DetectVerdict): string {
  switch (verdict.kind) {
    case 'identified':
      return `Sent to ${verdict.recipientLabel} (${Math.round(verdict.confidencePct)}% confidence)`
    case 'candidate':
      return `Marker found but unregistered (${Math.round(verdict.confidencePct)}%)`
    case 'no_marker':
      return 'No Ariadne marker found in this file.'
    case 'invalid':
      return `Marker invalid: ${verdict.reason}`
    case 'error':
      return `Verification failed: ${verdict.message}`
  }
}
