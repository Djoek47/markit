import type { NextRequest } from 'next/server'

const DEFAULT_CREATIX = 'https://www.circeetvenus.com'

/**
 * Send the user to Creatix login; after success they return to Markit `/auth/complete`
 * with a session in the URL hash, then redirect to `pathOnMarkit`.
 */
export function getCreatixLoginRedirectUrl(
  request: NextRequest,
  pathOnMarkit: string,
): string {
  const creatix =
    process.env.NEXT_PUBLIC_CREATIX_APP_URL?.replace(/\/$/, '') || DEFAULT_CREATIX
  const safePath =
    pathOnMarkit.startsWith('/') && !pathOnMarkit.startsWith('//') && !pathOnMarkit.includes('..')
      ? pathOnMarkit
      : '/editor'
  const back = new URL('/auth/complete', request.nextUrl.origin)
  back.searchParams.set('redirect', safePath)
  return `${creatix}/auth/login?next=${encodeURIComponent(back.toString())}`
}
