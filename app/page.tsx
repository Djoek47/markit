import { Suspense } from 'react'
import { EditorApp } from '@/components/editor-app'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center px-4 text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Loading Markit…
        </div>
      }
    >
      <EditorApp />
    </Suspense>
  )
}
