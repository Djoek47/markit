import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server component / Server Action Supabase client.
 * Use createRouteHandlerClient for Route Handlers that may receive Bearer tokens.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components cannot set cookies; fine for read-only auth checks
          }
        },
      },
    },
  )
}
