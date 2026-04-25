import type { NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Route handler client: supports browser cookies or `Authorization: Bearer` (same as Creatix).
 */
export async function createRouteHandlerClient(request: NextRequest): Promise<SupabaseClient> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (token) {
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const originalGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = async (jwt?: string) => {
      if (jwt !== undefined) return originalGetUser(jwt)
      return originalGetUser(token)
    }
    return client
  }
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          /* route handlers are read-only for cookies in many cases */
        },
      },
    },
  ) as unknown as SupabaseClient
}
