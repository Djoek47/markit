'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCreatixLoginUrlForBrowser } from '@/lib/creatix-login-browser'

const CREATIX = process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com'
const brandLogo = '/icon.png'

export function SignInClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next') && sp.get('next')!.startsWith('/') ? sp.get('next')! : '/editor'
  const welcomeUrl = `/welcome?next=${encodeURIComponent(next)}`
  const creatixSignIn = getCreatixLoginUrlForBrowser(next)

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
        <a
          href={CREATIX}
          className="absolute top-6 left-6 z-10 flex items-center gap-2.5 opacity-80 transition-opacity hover:opacity-100"
        >
          <div className="h-7 w-7 overflow-hidden rounded-full border border-[var(--border)] bg-white shadow-[0_0_20px_rgba(128,90,213,0.35)]">
            <Image src={brandLogo} alt="Circe et Venus" width={28} height={28} className="h-full w-full object-cover" />
          </div>
          <span className="font-serif-display text-[13px] font-medium tracking-[0.2em]">
            CIRCE <em className="not-italic text-[var(--primary)]">et</em> VENUS
          </span>
        </a>
        <div className="relative mt-16 flex w-full max-w-md flex-col items-center px-2 md:mt-0">
          <div
            className="absolute -z-0 aspect-square w-[min(360px,70vw)] rounded-full opacity-60 blur-2xl"
            style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 15%, transparent), transparent 70%)' }}
          />
          <div
            className="relative z-[1] w-[min(300px,55vw)] aspect-square max-w-full overflow-hidden rounded-full border border-[var(--border)] bg-white shadow-2xl"
            style={{ animation: 'mkt-float 6s ease-in-out infinite' }}
          >
            <Image
              src={brandLogo}
              alt="Circe et Venus"
              width={320}
              height={320}
              className="h-full w-full object-cover p-0.5"
              priority
            />
          </div>
          <div className="text-muted-foreground font-serif-display relative z-[1] mt-10 max-w-md text-center">
            <p className="text-primary font-mono-ui mb-4 text-[10px] font-medium uppercase tracking-[0.3em]">Markit · Creatix Studio</p>
            <h1 className="text-foreground text-2xl font-medium tracking-tight md:text-3xl">
              Voice, trim, and <em className="not-italic text-[var(--primary)]">trace</em> every frame.
            </h1>
            <p className="mt-3 text-sm leading-relaxed">
              The Markit editor uses your same Circe et Venus account. Sign in on the main app, or use email
              here if you are already in this browser.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--card-2)] flex flex-col justify-center overflow-y-auto px-6 py-10 md:px-14" style={{ minHeight: '100dvh' }}>
        <div className="mx-auto w-full max-w-[24rem]">
          <p className="text-primary font-mono-ui text-[10px] font-medium uppercase tracking-[0.2em]">Sign in</p>
          <h2 className="font-serif-display text-foreground mt-3 text-3xl font-medium tracking-tight">
            Continue to <em className="not-italic text-[var(--primary)]">Markit</em>
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Recommended: one tap through Circe et Venus — you will land back in Markit signed in. Or sign in
            with email if your session is already in this browser.
          </p>

          <div className="mt-6">
            <a
              href={creatixSignIn}
              className="text-primary-foreground flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-transform hover:-translate-y-px"
              style={{ background: 'var(--primary)', boxShadow: '0 4px 20px -4px color-mix(in oklch, var(--primary) 40%, transparent)' }}
            >
              Sign in on Circe et Venus
            </a>
          </div>

          <div className="text-muted-faint font-mono-ui my-5 flex items-center gap-3 text-[9px] uppercase tracking-[0.2em]">
            <span className="bg-border h-px flex-1" />
            or email on this device
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
                placeholder="you@example.com"
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
              disabled={loading}
              className="bg-card text-foreground border-border hover:border-primary/60 flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in with email'}
            </button>
          </form>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            New to the workspace?{' '}
            <a href={`${CREATIX}/auth/sign-up`} className="text-[var(--primary)] font-medium hover:underline">
              Create an account
            </a>
          </p>
          <p className="text-muted-faint font-mono-ui mt-7 text-center text-[9px] leading-relaxed tracking-[0.1em]">
            18+ adult creators · same terms and privacy as{' '}
            <a href={CREATIX} className="text-muted-foreground hover:underline">
              circeetvenus.com
            </a>
          </p>
          <p className="mt-4 text-center">
            <Link href="/" className="text-muted-foreground text-sm hover:text-foreground">
              ← Markit home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
