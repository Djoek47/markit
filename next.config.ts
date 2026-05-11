import type { NextConfig } from 'next'
import path from 'path'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
}

// withSentryConfig is a no-op when SENTRY_ORG / SENTRY_PROJECT are not set,
// so local and staging builds without Sentry credentials work without change.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress the Sentry CLI output in CI unless explicitly opted in
  silent: !process.env.CI,
  // Disable source map upload when Sentry isn't fully configured
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Don't add the Sentry SDK to the bundle when the DSN is absent —
  // this keeps the client bundle lean for deploys without Sentry.
  autoInstrumentServerFunctions: false,
  disableLogger: true,
})
