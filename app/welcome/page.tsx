import { Suspense } from 'react'
import { WelcomeContent } from './welcome-content'

function WelcomeFallback() {
  return <div className="bg-background text-muted-foreground flex min-h-dvh items-center justify-center text-sm">Loading…</div>
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<WelcomeFallback />}>
      <WelcomeContent />
    </Suspense>
  )
}
