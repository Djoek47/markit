'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CREATIX = process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next') || '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="bg-gradient-frame pointer-events-none absolute inset-0 -z-10" />
      <div className="border-gold-edge pointer-events-none absolute bottom-0 left-0 right-0" />

      <Link
        href={CREATIX}
        className="absolute left-6 top-6 text-sm hover:opacity-90"
        style={{ color: 'var(--muted-foreground)' }}
      >
        ← Circe et Venus
      </Link>

      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <h1 className="font-serif-display tracking-widest" style={{ color: 'var(--primary)' }}>
          CIRCE ET VENUS
        </h1>
        <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
          Markit — video editor
        </p>
      </div>

      <div
        className="w-full max-w-md rounded-xl border p-8 shadow-xl"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--card)',
        }}
      >
        <h2 className="font-serif-display mb-1 text-lg font-semibold">Sign in</h2>
        <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Use the same account as the main site. A <strong>paid plan</strong> is required to open Markit without a vault
          bridge link.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', background: 'oklch(0.1 0.01 285)' }}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: 'var(--border)', background: 'oklch(0.1 0.01 285)' }}
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground hover:opacity-90 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Need a subscription?{' '}
          <a href={`${CREATIX}/dashboard/settings`} className="underline" style={{ color: 'var(--circe-light)' }}>
            Billing on Circe et Venus
          </a>
        </p>
      </div>
    </div>
  )
}
