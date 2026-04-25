import { type NextRequest, NextResponse } from 'next/server'

/**
 * Alias for `/auth/sign-in` (plan URLs). Preserves `next` and other search params.
 */
export function GET(request: NextRequest) {
  const src = new URL(request.url)
  const q = src.searchParams.toString()
  const path = q ? `/auth/sign-in?${q}` : '/auth/sign-in'
  return NextResponse.redirect(new URL(path, src.origin))
}
