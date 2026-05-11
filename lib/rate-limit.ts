/**
 * In-memory sliding-window rate limiter.
 *
 * Limitation: state is per-process. On Vercel serverless each cold-start
 * gets a fresh counter, so this prevents runaway bursts from a single buggy
 * client within an instance's lifetime rather than globally. A Redis/Upstash
 * backed limiter would be needed for cross-instance enforcement.
 */

type WindowEntry = { timestamps: number[] }

const store = new Map<string, WindowEntry>()

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number }

/**
 * Check whether `key` is within the allowed rate.
 *
 * @param key     Identifier to rate-limit (e.g. bearer token, user ID, IP).
 * @param limit   Max requests allowed in the window.
 * @param windowMs Window size in milliseconds.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Evict timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]
    const retryAfterMs = oldest + windowMs - now
    return { ok: false, retryAfterMs: Math.max(0, retryAfterMs) }
  }

  entry.timestamps.push(now)
  return { ok: true, remaining: limit - entry.timestamps.length }
}

/** Derive a rate-limit key from a request: bearer token → user IP → 'anonymous'. */
export function rateLimitKeyFromRequest(req: { headers: { get: (k: string) => string | null } }): string {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return `bearer:${auth.slice(7, 40)}`
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (ip) return `ip:${ip}`
  return 'anonymous'
}
