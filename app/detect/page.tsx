'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const COOLDOWN_HINT = 'Wait up to 30s between runs (per account).'

export default function DetectPage() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const run = useCallback(async () => {
    if (!file) {
      setError('Choose a file first.')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const supabase = createClient()
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) {
        setError('Sign in to run leak check against your exports.')
        setBusy(false)
        return
      }
      const form = new FormData()
      form.set('file', file)
      const res = await fetch('/api/ariadne/detect-cooldown', {
        method: 'POST',
        body: form,
        headers: { Authorization: `Bearer ${token}` },
      })
      const text = await res.text()
      if (!res.ok) {
        setError(text)
        return
      }
      setResult(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }, [file])

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 py-12 text-[var(--foreground)]">
      <p className="text-muted-foreground font-mono-ui text-[10px] uppercase tracking-[0.2em]">Ariadne</p>
      <h1 className="font-serif-display mt-2 text-2xl">Leak check (detect)</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Upload a suspect file. Markit forwards to Creatix Ariadne detect with a <strong>30s per-user</strong> cooldown.{' '}
        {COOLDOWN_HINT}
      </p>
      <div className="mt-6 space-y-3">
        <input
          type="file"
          className="block w-full text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-40"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? 'Running…' : 'Run detect'}
        </button>
      </div>
      {error ? <pre className="mt-4 overflow-x-auto text-xs text-[var(--destructive)]">{error}</pre> : null}
      {result ? <pre className="mt-4 overflow-x-auto text-xs text-[var(--muted-foreground)]">{result}</pre> : null}
      <p className="text-muted-foreground mt-8 text-sm">
        <Link href="/editor" className="text-[var(--primary)] underline">
          Back to editor
        </Link>
      </p>
    </div>
  )
}
