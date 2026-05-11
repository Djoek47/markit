/**
 * Client-side instrumentation — runs before React hydration.
 * Initialises Sentry browser SDK and PostHog analytics when the
 * respective env vars are set. Both are complete no-ops without them.
 */

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

// ── Sentry client ──────────────────────────────────────────────────────────

if (sentryDsn) {
  import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
      tracesSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 0.05,
      integrations: [Sentry.replayIntegration()],
    })
  }).catch(() => {})
}

// ── PostHog analytics ──────────────────────────────────────────────────────

if (posthogKey) {
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: 'identified_only',
      capture_pageview: false, // manual via onRouterTransitionStart
      capture_pageleave: true,
    })
  }).catch(() => {})
}

// ── Router navigation tracking ─────────────────────────────────────────────

export function onRouterTransitionStart(url: string) {
  if (!posthogKey) return
  import('posthog-js').then(({ default: posthog }) => {
    posthog.capture('$pageview', { $current_url: url })
  }).catch(() => {})
}
