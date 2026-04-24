import { Suspense } from 'react'
import { EditorApp } from '@/components/editor-app'

export const metadata = {
  title: 'Markit — Editor (Beta) · Circe et Venus',
  description: 'Editor workspace — trim, export, Ariadne trace.',
}

export default function EditorPage() {
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
