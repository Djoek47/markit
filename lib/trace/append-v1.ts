/**
 * Markit standalone forensic trace — append-v1 algorithm.
 *
 * Wire format: append `MARKIT_TRACE:v1:{...JSON...}` bytes to the end of a video file.
 * Survives: direct file shares, most platform re-uploads (mp4 → mp4 with no re-encode).
 * Does NOT survive: re-encoding, screenshots, format conversion that strips trailing bytes.
 *
 * This is the standalone Markit algorithm. Different prefix than Creatix's `CREATIX_ARID:v1:`
 * because Markit owns its own trace namespace and recipient mapping table.
 */

import { createHash, createHmac, randomUUID } from 'crypto'

const MARKER_PREFIX = Buffer.from('MARKIT_TRACE:v1:', 'utf8')

/** A signed Markit trace payload. Embedded as JSON after MARKER_PREFIX. */
export interface TracePayloadV1 {
  v: 1
  payloadId: string
  recipientLabel: string
  userId: string
  exp: number
  sig: string
}

export type ExtractState =
  | 'no_marker'
  | 'marker_invalid_json'
  | 'marker_invalid_signature'
  | 'marker_expired'
  | 'marker_valid'

export type ExtractResult =
  | { state: 'marker_valid'; payload: TracePayloadV1 }
  | { state: Exclude<ExtractState, 'marker_valid'>; payload: null }

const SECRET_MIN_LENGTH = 16
const DEFAULT_EXPIRY_SEC = 60 * 60 * 24 * 365 // 1 year

/**
 * Read the trace signing secret from env. Prefers `MARKIT_TRACE_SECRET` if set
 * (allows a dedicated trace-only secret); falls back to `MARKIT_ARIADNE_SHARED_SECRET`
 * which is already configured for the M2M Creatix integration. Either works as long
 * as it's >= 16 chars and stays the same across embed and detect.
 */
function getTraceSecret(): string {
  const secret = process.env.MARKIT_TRACE_SECRET || process.env.MARKIT_ARIADNE_SHARED_SECRET
  if (!secret || secret.length < SECRET_MIN_LENGTH) {
    throw new Error(
      `MARKIT_TRACE_SECRET (or MARKIT_ARIADNE_SHARED_SECRET) must be set with min ${SECRET_MIN_LENGTH} chars`,
    )
  }
  return secret
}

/** SHA-256 hex digest of a buffer or string. Used for file-integrity hashing. */
export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Canonical signing message: pipe-delimited tuple of payload fields.
 * Order matters and must stay stable — changing it invalidates every existing trace.
 */
function buildSigningMessage(parts: Pick<TracePayloadV1, 'payloadId' | 'recipientLabel' | 'userId' | 'exp'>): string {
  return [parts.payloadId, parts.recipientLabel, parts.userId, String(parts.exp), 'v1'].join('|')
}

function signMessage(message: string, secret: string): string {
  return createHmac('sha256', secret).update(message, 'utf8').digest('base64url')
}

/**
 * Mint a fresh signed trace payload. Caller is responsible for inserting the
 * (payloadId, userId, recipientLabel, ...) tuple into `markit.trace_exports` so detect can resolve it.
 */
export function createTracePayload(input: {
  recipientLabel: string
  userId: string
  /** Override default expiry (1 year). Pass 0 for no expiry — we still set exp = now + 100y. */
  expSec?: number
}): TracePayloadV1 {
  const recipientLabel = input.recipientLabel.trim().slice(0, 500)
  if (!recipientLabel) throw new Error('recipientLabel must be non-empty')
  if (!input.userId.trim()) throw new Error('userId must be non-empty')
  const payloadId = randomUUID()
  const expiry = input.expSec ?? DEFAULT_EXPIRY_SEC
  const exp = Math.floor(Date.now() / 1000) + (expiry > 0 ? expiry : 60 * 60 * 24 * 365 * 100)
  const sig = signMessage(buildSigningMessage({ payloadId, recipientLabel, userId: input.userId, exp }), getTraceSecret())
  return { v: 1, payloadId, recipientLabel, userId: input.userId, exp, sig }
}

/** Re-verify a payload's HMAC and expiry. Returns a structured result for caller-side branching. */
export function verifyTracePayload(
  payload: Partial<TracePayloadV1> | null | undefined,
): { ok: true; payload: TracePayloadV1 } | { ok: false; state: 'marker_invalid_signature' | 'marker_expired' } {
  if (
    !payload ||
    payload.v !== 1 ||
    typeof payload.payloadId !== 'string' ||
    typeof payload.recipientLabel !== 'string' ||
    typeof payload.userId !== 'string' ||
    typeof payload.exp !== 'number' ||
    typeof payload.sig !== 'string'
  ) {
    return { ok: false, state: 'marker_invalid_signature' }
  }
  const expected = signMessage(
    buildSigningMessage({
      payloadId: payload.payloadId,
      recipientLabel: payload.recipientLabel,
      userId: payload.userId,
      exp: payload.exp,
    }),
    getTraceSecret(),
  )
  if (expected !== payload.sig) return { ok: false, state: 'marker_invalid_signature' }
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, state: 'marker_expired' }
  return { ok: true, payload: payload as TracePayloadV1 }
}

/**
 * Append the signed payload bytes to `video`. Returns a NEW Buffer; does not mutate input.
 * The video plays identically — append-v1 modifies only post-EOF bytes, not pixel data.
 */
export function embedAppendV1(video: Buffer, payload: TracePayloadV1): Buffer {
  const json = Buffer.from(JSON.stringify(payload), 'utf8')
  return Buffer.concat([video, MARKER_PREFIX, json])
}

/**
 * Find the LAST `MARKIT_TRACE:v1:` marker in `buf` and balance-parse the JSON object that follows.
 * Last-wins handles the case where a re-traced file has multiple markers.
 */
function findLastMarkerJson(buf: Buffer): string | null {
  const idx = buf.lastIndexOf(MARKER_PREFIX)
  if (idx < 0) return null
  const start = idx + MARKER_PREFIX.length
  if (start >= buf.length || buf[start] !== 0x7b /* { */) return null
  let depth = 0
  for (let i = start; i < buf.length; i++) {
    const c = buf[i]
    if (c === 0x7b) depth++
    else if (c === 0x7d /* } */) {
      depth--
      if (depth === 0) return buf.subarray(start, i + 1).toString('utf8')
    }
  }
  return null
}

/** Extract and verify the trace marker from a video buffer. Returns a tagged-state result. */
export function extractAppendV1(buf: Buffer): ExtractResult {
  const raw = findLastMarkerJson(buf)
  if (raw === null) {
    return { state: buf.lastIndexOf(MARKER_PREFIX) < 0 ? 'no_marker' : 'marker_invalid_json', payload: null }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { state: 'marker_invalid_json', payload: null }
  }
  const verified = verifyTracePayload(parsed as Partial<TracePayloadV1>)
  if (!verified.ok) return { state: verified.state, payload: null }
  return { state: 'marker_valid', payload: verified.payload }
}

/** Useful for tests + tooling: are these bytes the marker prefix? */
export const MARKIT_TRACE_MARKER_PREFIX = MARKER_PREFIX
