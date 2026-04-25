'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

function isSafeRedirectPath(p: string | null): p is string {
  if (!p || !p.startsWith('/') || p.startsWith('//')) return false
  if (p.includes('..')) return false
  return true
}

export function AuthCompleteClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const redirect = isSafeRedirectPath(sp.get('redirect')) ? sp.get('redirect')! : '/editor'

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const raw =
        typeof window !== 'undefined' && window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : typeof window !== 'undefined'
            ? window.location.hash
            : ''
      if (!raw.trim()) {
        setError('Missing session. Sign in from Circe et Venus, or use email below.')
        return
      }
      const params = new URLSearchParams(raw)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) {
        setError('Invalid session handoff. Try signing in again.')
        return
      }
      const supabase = createClient()
      const { error: sErr } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (cancelled) return
      if (sErr) {
        setError(sErr.message)
        return
      }
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/auth/complete')
      }
      router.replace(redirect)
      router.refresh()
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [redirect, router])

  if (error) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: 'var(--background)' }}
      >
        <p className="text-red-400 text-sm">{error}</p>
        <Link
          href="/auth/sign-in"
          className="text-primary text-sm font-medium underline underline-offset-2"
        >
          Markit sign-in
        </Link>
      </div>
    )
  }

  return (
    <div
      className="text-muted-foreground flex min-h-dvh items-center justify-center text-sm"
      style={{ background: 'var(--background)' }}
    >
      Finishing sign-in…
    </div>
  )
}
