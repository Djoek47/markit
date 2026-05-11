import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveLibraryViewEnabled } from '@/lib/flags'
import { LibraryClient } from './library-client'
import type { MediaRow } from '@/db/schema'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Library',
}

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  // Auth gate
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/library')

  // Feature gate: if mediaPipeline is off, redirect to editor with bridge mode
  if (!resolveLibraryViewEnabled()) {
    redirect('/editor?view=library')
  }

  // Fetch the user's media items (latest 60)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  let mediaItems: MediaRow[] = []
  if (url && serviceKey) {
    const service = createServiceClient(url, serviceKey)
    const { data } = await service
      .schema('markit')
      .from('media')
      .select('*')
      .eq('user_id', user.id)
      .order('imported_at', { ascending: false })
      .limit(60)
    if (data) mediaItems = data as MediaRow[]
  }

  return <LibraryClient initialItems={mediaItems} userId={user.id} />
}
