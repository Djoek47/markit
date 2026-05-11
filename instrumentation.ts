/**
 * Server-side instrumentation — called once when a new Next.js server instance starts.
 * Initialises Sentry for the Node.js runtime when SENTRY_DSN is set.
 * No-op when the env var is absent so staging / local runs are unaffected.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  const Sentry = await import('@sentry/nextjs')
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    tracesSampleRate: 0.1,
    // Keep server-side bundles lean — no replays on the server
  })
}
