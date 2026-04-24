'use client'

import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const seal = '/brand/cev-seal.svg'
const DEFAULT_NEXT = '/editor'
const MS = 5300

export function WelcomeContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const nextParam = sp.get('next')
  const next = nextParam && nextParam.startsWith('/') ? nextParam : DEFAULT_NEXT
  const [allowSkip, setAllowSkip] = useState(false)

  const go = useCallback(() => {
    router.replace(next)
  }, [next, router])

  useEffect(() => {
    const t = setTimeout(() => setAllowSkip(true), 800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const t = setTimeout(go, MS)
    return () => clearTimeout(t)
  }, [go])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(900px 700px at 50% 50%, color-mix(in oklch, var(--circe) 16%, transparent), transparent 60%),
            radial-gradient(500px 400px at 20% 30%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 60%)
          `,
        }}
      />
      {allowSkip ? (
        <button
          type="button"
          onClick={go}
          className="text-muted-foreground font-mono-ui hover:text-foreground absolute top-5 right-5 z-20 rounded-full border border-[var(--border)] px-3.5 py-2 text-[10px] font-medium tracking-[0.2em] uppercase transition-colors"
        >
          Skip
        </button>
      ) : null}
      <div className="relative z-[1] flex flex-col items-center px-4">
        <div className="relative flex h-72 w-72 max-w-[85vw] items-center justify-center sm:h-80 sm:w-80">
          <div
            className="absolute -inset-6 rounded-full opacity-90"
            style={{
              background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 20%, transparent) 0%, transparent 70%)',
            }}
          />
          <div
            className="border-primary/40 absolute -in-4 rounded-full border border-dashed"
            style={{ animation: 'mkt-slow-spin 40s linear infinite' }}
          />
          <div
            className="border-background relative h-[min(280px,70vw)] w-[min(280px,70vw)] overflow-hidden rounded-full border-2 bg-white shadow-2xl"
            style={{ animation: 'mkt-welcome-seal 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both' }}
          >
            <Image src={seal} alt="" width={280} height={280} className="h-full w-full object-contain p-1" />
          </div>
        </div>
        <div
          className="text-center [animation:mkt-welcome-text_0.8s_ease-out_1.2s_both]"
        >
          <p className="text-primary font-mono-ui mb-3.5 text-[11px] font-medium tracking-[0.32em] uppercase">
            Welcome back
          </p>
          <h1 className="font-serif-display text-foreground text-[clamp(2rem,5vw,3.2rem)] font-medium leading-tight">
            The <em className="not-italic text-[var(--primary)]">editor</em> awaits.
          </h1>
          <p className="text-muted-foreground font-serif-display [animation:mkt-fade-in_0.6s_ease-out_1.6s_both] mt-4 text-lg italic">
            Your Vault is ready. Your voice is live.
          </p>
        </div>
        <div
          className="bg-border relative mt-12 h-1 w-48 overflow-hidden rounded-full [animation:mkt-fade-in_0.5s_ease-out_1.7s_both]"
        >
          <div
            className="h-full w-full origin-left scale-x-0 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-soft)]"
            style={{ animation: 'mkt-welcome-bar 1.6s ease-out 1.7s forwards' }}
          />
        </div>
        <p
          className="text-muted-faint font-mono-ui [animation:mkt-fade-in_0.4s_ease-out_1.7s_both] mt-3.5 text-[9px] tracking-[0.2em] uppercase"
        >
          Summoning the Divine Manager…
        </p>
      </div>
    </div>
  )
}
