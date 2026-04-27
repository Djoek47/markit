/**
 * Shared storage helpers for the standalone trace tool.
 * No I/O — pure functions used by both API routes and (eventually) tests.
 */

export const TRACE_UPLOADS_BUCKET = 'markit-trace-uploads'
export const TRACE_RENDERS_BUCKET = 'markit-trace-renders'

/** 1 GB hard cap — enough for ~10 minutes of 1080p H.264 mp4. */
export const TRACE_MAX_SOURCE_BYTES = 1024 * 1024 * 1024

/** 60 minutes for upload-side signed URLs; tighten if abuse appears. */
export const TRACE_UPLOAD_URL_TTL_SEC = 60 * 60

/** 7 days for download-side signed URLs; matches typical creator-fan handoff windows. */
export const TRACE_DOWNLOAD_URL_TTL_SEC = 60 * 60 * 24 * 7

const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
])

const ALLOWED_EXT = new Set(['mp4', 'mov', 'webm', 'mkv'])

export function isAllowedMime(contentType: string): boolean {
  return ALLOWED_MIME.has(contentType.toLowerCase().trim())
}

export function isAllowedExtension(ext: string): boolean {
  return ALLOWED_EXT.has(ext.toLowerCase().replace(/^\./, ''))
}

/**
 * Resolve a safe extension from `filename`. Returns 'mp4' as a default — every other
 * value passes through `isAllowedExtension` first so we never write arbitrary suffixes
 * into our storage paths.
 */
export function safeExtension(filename: string | undefined | null): string {
  if (!filename) return 'mp4'
  const m = filename.toLowerCase().match(/\.([a-z0-9]{2,5})$/)
  if (!m) return 'mp4'
  const ext = m[1]
  return isAllowedExtension(ext) ? ext : 'mp4'
}

/** Source-side object path. First segment is the userId so RLS storage policies bind. */
export function uploadObjectPath(userId: string, uploadId: string, ext: string): string {
  return `${userId}/${uploadId}.${safeExtension(ext)}`
}

/** Renders-side object path. Same first-segment-is-userId rule. */
export function renderObjectPath(userId: string, payloadId: string, ext: string): string {
  return `${userId}/${payloadId}.${safeExtension(ext)}`
}

/** Sanitize the recipient label that lands in download filenames. Strips path separators and unicode tricks. */
export function safeRecipientSlug(label: string): string {
  return label
    .normalize('NFKC')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'recipient'
}

/** Final filename a creator sees when they download. e.g. "alice_test_a1b2c3d4.mp4". */
export function buildDownloadFilename(recipientLabel: string, payloadId: string, ext: string): string {
  const slug = safeRecipientSlug(recipientLabel)
  const short = payloadId.replace(/-/g, '').slice(0, 8) || 'trace'
  return `${slug}_${short}.${safeExtension(ext)}`
}
