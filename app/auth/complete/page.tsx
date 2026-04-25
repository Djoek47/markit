import { Suspense } from 'react'
import { AuthCompleteClient } from './auth-complete-client'

function Fallback() {
  return (
    <div
      className="text-muted-foreground flex min-h-dvh items-center justify-center text-sm"
      style={{ background: 'var(--background)' }}
    >
      Finishing sign-in…
    </div>
  )
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <AuthCompleteClient />
    </Suspense>
  )
}
