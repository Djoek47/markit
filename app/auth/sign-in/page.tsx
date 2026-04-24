import { Suspense } from 'react'
import { SignInClient } from './sign-in-client'

function Fallback() {
  return (
    <div className="bg-background text-muted-foreground flex min-h-dvh items-center justify-center text-sm">Loading…</div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <SignInClient />
    </Suspense>
  )
}
