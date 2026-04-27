import type { ExtractResult } from '@/lib/trace/append-v1'

export type DetectVerdict =
  | { kind: 'identified'; recipientLabel: string; payloadIdShort: string; algorithmVersion: string }
  | { kind: 'orphaned'; payloadIdShort: string; reason: string } // marker valid but no markit.trace_exports row
  | { kind: 'no_marker' }
  | { kind: 'invalid'; reason: string } // marker_invalid_signature | marker_invalid_json
  | { kind: 'expired' }

export function buildDetectVerdict(
  extract: ExtractResult,
  registryRow: { recipient_label: string; algorithm: string } | null,
): DetectVerdict {
  // No marker found
  if (extract.state === 'no_marker') {
    return { kind: 'no_marker' }
  }

  // Marker JSON malformed or truncated
  if (extract.state === 'marker_invalid_json') {
    return { kind: 'invalid', reason: 'marker JSON malformed or truncated' }
  }

  // Marker signature did not verify
  if (extract.state === 'marker_invalid_signature') {
    return { kind: 'invalid', reason: 'marker signature did not verify' }
  }

  // Marker has expired
  if (extract.state === 'marker_expired') {
    return { kind: 'expired' }
  }

  // Marker is valid
  if (extract.state === 'marker_valid' && extract.payload) {
    const payloadIdShort = extract.payload.payloadId.slice(0, 8)

    // Record found in registry
    if (registryRow !== null) {
      return {
        kind: 'identified',
        recipientLabel: registryRow.recipient_label,
        payloadIdShort,
        algorithmVersion: registryRow.algorithm,
      }
    }

    // Marker is valid but no record on this account
    return {
      kind: 'orphaned',
      payloadIdShort,
      reason: 'marker is valid but no record exists for this user',
    }
  }

  // Fallback (should not reach)
  return { kind: 'no_marker' }
}

export function formatVerdictLine(verdict: DetectVerdict): string {
  switch (verdict.kind) {
    case 'identified':
      return `Sent to ${verdict.recipientLabel}`
    case 'orphaned':
      return `Marker valid but no record on this account (${verdict.reason}) (payload ${verdict.payloadIdShort})`
    case 'no_marker':
      return 'No Markit trace marker found in this file.'
    case 'invalid':
      return `Marker invalid: ${verdict.reason}`
    case 'expired':
      return 'Marker has expired and can no longer be verified.'
  }
}
