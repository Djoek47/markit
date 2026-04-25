const DEFAULT_CREATIX = 'https://www.circeetvenus.com'

/** Primary sign-in: Circe et Venus login, then return to Markit with session. */
export function getCreatixLoginUrlForBrowser(pathOnMarkit: string): string {
  if (typeof window === 'undefined') {
    return `${DEFAULT_CREATIX}/auth/login`
  }
  const creatix =
    process.env.NEXT_PUBLIC_CREATIX_APP_URL?.replace(/\/$/, '') || DEFAULT_CREATIX
  const safePath =
    pathOnMarkit.startsWith('/') && !pathOnMarkit.startsWith('//') && !pathOnMarkit.includes('..')
      ? pathOnMarkit
      : '/editor'
  const back = new URL('/auth/complete', window.location.origin)
  back.searchParams.set('redirect', safePath)
  return `${creatix}/auth/login?next=${encodeURIComponent(back.toString())}`
}
