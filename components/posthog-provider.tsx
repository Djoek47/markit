'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Identifies the authenticated user to PostHog once the session resolves.
 * Also captures pageviews on client-side navigations (complementing the
 * onRouterTransitionStart hook in instrumentation-client.ts which fires on push/replace).
 *
 * No-op when NEXT_PUBLIC_POSTHOG_KEY is absent — the posthog singleton is
 * never initialised so all calls are dropped silently.
 */
export function PostHogProvider({ userId }: { userId?: string | null }) {
  const pathname = usePathname()

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    import('posthog-js').then(({ default: posthog }) => {
      if (userId) {
        posthog.identify(userId)
      } else {
        posthog.reset()
      }
    }).catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    import('posthog-js').then(({ default: posthog }) => {
      posthog.capture('$pageview', { $current_url: window.location.href })
    }).catch(() => {})
  }, [pathname])

  return null
}
