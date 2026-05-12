'use client'

import { useEffect, useState } from 'react'

type OpenReelEditorComponent = typeof import('@/components/openreel/openreel-editor-client').OpenReelEditorClient

export function OpenReelEditorLoader() {
  const [EditorClient, setEditorClient] = useState<OpenReelEditorComponent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    void import('@/components/openreel/openreel-editor-client')
      .then((mod) => {
        if (mounted) {
          setEditorClient(() => mod.OpenReelEditorClient)
        }
      })
      .catch((reason: unknown) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <h1 className="text-lg font-semibold text-text-primary">Markit editor failed to load</h1>
        <p className="max-w-2xl text-sm text-text-secondary">{error}</p>
      </div>
    )
  }

  if (!EditorClient) {
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
