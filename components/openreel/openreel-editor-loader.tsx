'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type OpenReelEditorComponent = typeof import('@/components/openreel/openreel-editor-client').OpenReelEditorClient

export function OpenReelEditorLoader() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [EditorClient, setEditorClient] = useState<OpenReelEditorComponent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      if (!data.user) {
        router.replace('/sign-in?next=/editor')
        return
      }
      setReady(true)
      void import('@/components/openreel/openreel-editor-client')
        .then((mod) => {
          if (mounted) setEditorClient(() => mod.OpenReelEditorClient)
        })
        .catch((reason: unknown) => {
          if (mounted) setError(reason instanceof Error ? reason.message : String(reason))
        })
    })

    return () => {
      mounted = false
    }
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <h1 className="text-lg font-semibold text-text-primary">Markit editor failed to load</h1>
        <p className="max-w-2xl text-sm text-text-secondary">{error}</p>
      </div>
    )
  }

  if (!ready || !EditorClient) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-text-secondary"
      >
        Loading Markit editor...
      </div>
    )
  }

  return <EditorClient />
}
