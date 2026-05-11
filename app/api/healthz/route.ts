import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONTRACT_VERSION = 'v1.1'

/**
 * GET /api/healthz
 * Used by uptime monitors and staging smoke tests.
 * Returns the contract version and git commit SHA so monitors can verify
 * the correct build is deployed.
 */
export async function GET() {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
    process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 8) ??
    'local'

  return NextResponse.json(
    { ok: true, contractVersion: CONTRACT_VERSION, commit },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Markit-Contract': CONTRACT_VERSION,
      },
    },
  )
}
