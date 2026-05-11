// ─── Media upload contract — sign-upload and finalize request/response types ──

export type MediaKind = 'video' | 'image' | 'audio'

export type SignUploadRequest = {
  kind: MediaKind
  /** File size in bytes. */
  sizeBytes: number
  /** MIME type, e.g. "video/mp4". */
  contentType: string
  /** Original filename hint (not trusted for type detection). */
  filenameHint?: string
}

export type SignUploadSuccess = {
  ok: true
  mediaId: string
  uploadUrl: string
  uploadHeaders: Record<string, string>
  /** ISO 8601 timestamp after which uploadUrl is no longer valid. */
  expiresAt: string
}

export type SignUploadError = {
  ok: false
  error: {
    code: 'TIER_LIMIT' | 'UNSUPPORTED_TYPE' | 'BAD_REQUEST'
    message: string
  }
}

export type SignUploadResponse = SignUploadSuccess | SignUploadError

export type FinalizeMediaRequest = {
  mediaId: string
  /** SHA-256 hex of the uploaded file. Optional — column is nullable; large files skip client-side hashing. */
  sha256?: string
  width?: number
  height?: number
  durationSec?: number
  codec?: string
}

export type SignUploadRequestValid = { ok: true; request: SignUploadRequest }
export type SignUploadRequestInvalid = { ok: false; details: string[] }
export type SignUploadRequestResult = SignUploadRequestValid | SignUploadRequestInvalid

export type FinalizeMediaRequestValid = { ok: true; request: FinalizeMediaRequest }
export type FinalizeMediaRequestInvalid = { ok: false; details: string[] }
export type FinalizeMediaRequestResult = FinalizeMediaRequestValid | FinalizeMediaRequestInvalid

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_KINDS: ReadonlySet<MediaKind> = new Set(['video', 'image', 'audio'])

/** Max upload size per kind (bytes). Enforced server-side; provided here for client-side UX. */
export const UPLOAD_SIZE_LIMITS: Record<MediaKind, number> = {
  video: 5 * 1024 * 1024 * 1024,  // 5 GB
  image: 50 * 1024 * 1024,         // 50 MB
  audio: 500 * 1024 * 1024,        // 500 MB
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateSignUploadRequest(value: unknown): SignUploadRequestResult {
  const issues: string[] = []

  if (value === null || typeof value !== 'object') {
    return { ok: false, details: ['SignUploadRequest must be a non-null object'] }
  }

  const o = value as Record<string, unknown>

  if (!VALID_KINDS.has(o.kind as MediaKind)) {
    issues.push(`kind must be one of: ${[...VALID_KINDS].join(', ')}`)
  }

  if (typeof o.sizeBytes !== 'number' || !Number.isFinite(o.sizeBytes) || o.sizeBytes <= 0 || !Number.isInteger(o.sizeBytes)) {
    issues.push('sizeBytes must be a positive integer')
  }

  if (typeof o.contentType !== 'string' || !o.contentType) {
    issues.push('contentType must be a non-empty string')
  }

  if (o.filenameHint !== undefined && typeof o.filenameHint !== 'string') {
    issues.push('filenameHint must be a string when present')
  }

  if (issues.length > 0) return { ok: false, details: issues }

  return {
    ok: true,
    request: {
      kind: o.kind as MediaKind,
      sizeBytes: o.sizeBytes as number,
      contentType: o.contentType as string,
      ...(typeof o.filenameHint === 'string' ? { filenameHint: o.filenameHint } : {}),
    },
  }
}

export function validateFinalizeMediaRequest(value: unknown): FinalizeMediaRequestResult {
  const issues: string[] = []

  if (value === null || typeof value !== 'object') {
    return { ok: false, details: ['FinalizeMediaRequest must be a non-null object'] }
  }

  const o = value as Record<string, unknown>

  if (typeof o.mediaId !== 'string' || !o.mediaId) {
    issues.push('mediaId must be a non-empty string')
  }

  if (o.sha256 !== undefined && (typeof o.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(o.sha256))) {
    issues.push('sha256 must be a 64-char hex string when present')
  }

  const optNumbers: (keyof FinalizeMediaRequest)[] = ['width', 'height', 'durationSec']
  for (const field of optNumbers) {
    if (o[field] !== undefined && (typeof o[field] !== 'number' || !Number.isFinite(o[field]))) {
      issues.push(`${field} must be a finite number when present`)
    }
  }

  if (o.codec !== undefined && typeof o.codec !== 'string') {
    issues.push('codec must be a string when present')
  }

  if (issues.length > 0) return { ok: false, details: issues }

  return {
    ok: true,
    request: {
      mediaId: o.mediaId as string,
      ...(typeof o.sha256 === 'string' ? { sha256: o.sha256 } : {}),
      ...(typeof o.width === 'number' ? { width: o.width } : {}),
      ...(typeof o.height === 'number' ? { height: o.height } : {}),
      ...(typeof o.durationSec === 'number' ? { durationSec: o.durationSec } : {}),
      ...(typeof o.codec === 'string' ? { codec: o.codec } : {}),
    },
  }
}
