'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CREATIX = process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com'
const seal = '/brand/cev-seal.svg'

export function SignInClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next') && sp.get('next')!.startsWith('/') ? sp.get('next')! : '/editor'
  const welcomeUrl = `/welcome?next=${encodeURIComponent(next)}`

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
    router.push(welcomeUrl)
    router.refresh()
  }

  async function signInWithGoogle() {
    setOauthLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          typeof window !== 'undefined' ? `${window.location.origin}/welcome?next=${encodeURIComponent(next)}` : undefined,
      },
    })
    if (err) {
      setError(err.message)
      setOauthLoading(false)
    }
  }

  return (
    <div className="grid min-h-dvh text-[var(--foreground)] md:grid-cols-[1.1fr_0.9fr]">
      <div
        className="border-border relative flex flex-col items-center justify-center overflow-hidden border-b p-6 md:border-r md:border-b-0"
        style={{
          background: `
            radial-gradient(ellipse at center, color-mix(in oklch, var(--circe) 6%, transparent), transparent 70%),
            var(--background)
          `,
        }}
      >
        <Link
          href="/"
          className="absolute top-6 left-6 z-10 flex items-center gap-2.5 opacity-80 transition-opacity hover:opacity-100"
        >
          <div className="h-7 w-7 overflow-hidden rounded-full border border-[var(--border)] bg-white">
            <Image src={seal} alt="" width={28} height={28} className="h-full w-full object-contain" />
          </div>
          <span className="font-serif-display text-[13px] font-medium tracking-[0.2em]">
            CIRCE <em className="not-italic text-[var(--primary)]">et</em> VENUS
          </span>
        </Link>
        <div className="relative mt-16 flex w-full max-w-md flex-col items-center px-2 md:mt-0">
          <div
            className="absolute -z-0 aspect-square w-[min(360px,70vw)] rounded-full opacity-60 blur-2xl"
            style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 15%, transparent), transparent 70%)' }}
          />
          <div
            className="relative z-[1] w-[min(300px,55vw)] aspect-square max-w-full overflow-hidden rounded-full border border-[var(--border)] bg-white shadow-2xl"
            style={{ animation: 'mkt-float 6s ease-in-out infinite' }}
          >
            <Image src={seal} alt="Circe et Venus" width={320} height={320} className="h-full w-full object-contain p-1" />
          </div>
          <div className="text-muted-foreground font-serif-display relative z-[1] mt-10 max-w-md text-center">
            <p className="text-primary font-mono-ui mb-4 text-[10px] font-medium uppercase tracking-[0.3em]">Markit · The Divine Editor</p>
            <h1 className="text-foreground text-2xl font-medium tracking-tight md:text-3xl">
              Speak it into <em className="not-italic text-[var(--primary)]">existence.</em>
            </h1>
            <p className="mt-3 text-sm italic">Voice-first editor. Traced at every export. Welcome back.</p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--card-2)] flex flex-col justify-center overflow-y-auto px-6 py-10 md:px-14" style={{ minHeight: '100dvh' }}>
        <div className="mx-auto w-full max-w-[24rem]">
          <p className="text-primary font-mono-ui text-[10px] font-medium uppercase tracking-[0.2em]">Sign in</p>
          <h2 className="font-serif-display text-foreground mt-3 text-3xl font-medium tracking-tight">
            Return to the <em className="not-italic text-[var(--primary)]">editor</em>
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Use the same account as Circe et Venus. A paid plan may be required without a vault bridge link.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={oauthLoading || loading}
              className="bg-card text-foreground border-border hover:border-primary/60 flex w-full items-center justify-center gap-2.5 rounded-lg border py-3 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <span className="text-[13px]">Continue with Google</span>
            </button>
          </div>

          <div className="text-muted-faint font-mono-ui my-5 flex items-center gap-3 text-[9px] uppercase tracking-[0.2em]">
            <span className="bg-border h-px flex-1" />
            or with email
            <span className="bg-border h-px flex-1" />
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            <div>
              <label htmlFor="email" className="text-muted-foreground font-mono-ui mb-1.5 block text-[9px] uppercase tracking-[0.2em]">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-border bg-background w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                placeholder="you@domain.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-muted-foreground font-mono-ui mb-1.5 block text-[9px] uppercase tracking-[0.2em]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-border bg-background w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                placeholder="••••••••"
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="text-primary-foreground flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-transform hover:-translate-y-px disabled:opacity-50"
              style={{ background: 'var(--primary)', boxShadow: '0 4px 20px -4px color-mix(in oklch, var(--primary) 40%, transparent)' }}
            >
              {loading ? 'Signing in…' : 'Enter Markit →'}
            </button>
          </form>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            New to the workspace?{' '}
            <a href={`${CREATIX}/auth/sign-in`} className="text-[var(--primary)] font-medium hover:underline">
              Create an account
            </a>
          </p>
          <p className="text-muted-faint font-mono-ui mt-7 text-center text-[9px] leading-relaxed tracking-[0.1em] uppercase">
            By continuing you agree to the main app&apos;s terms.
            <br />
            18+ only · Adult creators
          </p>
          <p className="mt-4 text-center">
            <Link href="/" className="text-muted-foreground text-sm hover:text-foreground">
              ← Back to Markit home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
