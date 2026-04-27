'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type SignUploadResponse = {
  ok: true
  uploadId: string
  uploadUrl: string
  uploadToken: string
  sourcePath: string
  bucket: string
  expiresAt: string
}

type EmbedResponse = {
  ok: true
  payloadId: string
  recipientLabel: string
  downloadUrl: string
  downloadFilename: string
  expiresAt: string
  algorithmVersion: string
  sourceSha256: string
  outputSha256: string
}

type Stage = 'idle' | 'preparing' | 'uploading' | 'embedding' | 'done' | 'error'

const ACCEPTED_MIME = 'video/mp4,video/quicktime,video/webm,video/x-matroska'
const MAX_BYTES = 1024 * 1024 * 1024 // 1 GB — matches server-side cap

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function extFromName(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/)
  return m ? m[1] : 'mp4'
}

export function TracePageClient() {
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [recipient, setRecipient] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<EmbedResponse | null>(null)
  const dropRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSelectFile = (next: File | null) => {
    setErrorMsg(null)
    setResult(null)
    if (!next) {
      setFile(null)
      return
    }
    if (next.size > MAX_BYTES) {
      setErrorMsg(`File too large (${fmtBytes(next.size)} > ${fmtBytes(MAX_BYTES)})`)
      return
    }
    setFile(next)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleSelectFile(dropped)
  }, [])

  const onSign = useCallback(async () => {
    if (!file || !recipient.trim() || !userId) return
    setErrorMsg(null)
    setResult(null)
    setProgress(0)
    setStage('preparing')

    try {
      // 1. Reserve an upload slot.
      const signRes = await fetch('/api/trace/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: file.name,
          sizeBytes: file.size,
          contentType: file.type || 'video/mp4',
        }),
      })
      const signData = (await signRes.json().catch(() => ({}))) as
        | SignUploadResponse
        | { error?: string }
      if (!signRes.ok || !('ok' in signData)) {
        const msg = (signData as { error?: string }).error || `Sign-upload failed (${signRes.status})`
        throw new Error(msg)
      }

      // 2. Direct-upload the file to Supabase Storage via the signed URL.
      setStage('uploading')
      const supabase = createClient()
      const uploadResult = await supabase.storage
        .from(signData.bucket)
        .uploadToSignedUrl(signData.sourcePath, signData.uploadToken, file, {
          contentType: file.type || 'video/mp4',
          upsert: true,
        })
      if (uploadResult.error) {
        throw new Error(`Upload failed: ${uploadResult.error.message}`)
      }
      setProgress(60)

      // 3. Run server-side embed → traced output + signed download URL.
      setStage('embedding')
      const embedRes = await fetch('/api/trace/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          uploadId: signData.uploadId,
          recipientLabel: recipient.trim(),
          sourceExt: extFromName(file.name),
        }),
      })
      const embedData = (await embedRes.json().catch(() => ({}))) as
        | EmbedResponse
        | { error?: string }
      if (!embedRes.ok || !('ok' in embedData)) {
        const msg = (embedData as { error?: string }).error || `Embed failed (${embedRes.status})`
        throw new Error(msg)
      }

      setProgress(100)
      setStage('done')
      setResult(embedData)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Trace failed')
      setStage('error')
    }
  }, [file, recipient, userId])

  const reset = () => {
    setFile(null)
    setRecipient('')
    setStage('idle')
    setErrorMsg(null)
    setResult(null)
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (!authReady) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-6 text-sm text-[var(--muted-foreground)]">
        Loading…
      </main>
    )
  }

  if (!userId) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)] px-6 text-[var(--foreground)]">
        <div className="max-w-md text-center">
          <p className="font-mono-ui mb-4 text-[10px] uppercase tracking-[0.32em] text-[var(--primary)]">
            Markit · Trace
          </p>
          <h1 className="font-serif-display mb-3 text-3xl">Sign in to forensic-trace</h1>
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            Drop a video, type a recipient name, download a uniquely marked copy. Each copy is
            traceable back to the recipient if it leaks.
          </p>
          <Link
            href="/auth/sign-in?next=/trace"
            className="inline-block rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)]"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const busy = stage === 'preparing' || stage === 'uploading' || stage === 'embedding'

  return (
    <main className="min-h-[100dvh] bg-[var(--background)] px-6 py-12 text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="font-mono-ui mb-3 text-[10px] uppercase tracking-[0.32em] text-[var(--primary)]">
            Markit · Trace
          </p>
          <h1 className="font-serif-display text-4xl">Forensic-trace a video</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Drop a video, type a recipient, download a uniquely marked copy. If the file leaks,{' '}
            <Link href="/detect" className="underline">drop it in /detect</Link> to see who.
          </p>
        </div>

        <div
          ref={dropRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="mb-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors"
          style={{
            borderColor: file ? 'var(--primary)' : 'var(--border)',
            background: file ? 'color-mix(in oklch, var(--primary) 6%, transparent)' : 'transparent',
          }}
        >
          {file ? (
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {fmtBytes(file.size)} · {file.type || 'video/mp4'}
              </p>
              <button
                type="button"
                onClick={() => handleSelectFile(null)}
                disabled={busy}
                className="mt-3 rounded-md border px-3 py-1 text-xs disabled:opacity-40"
                style={{ borderColor: 'var(--border)' }}
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm">Drop a video here</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                or click to browse — mp4, mov, webm, mkv (≤ 1 GB)
              </p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_MIME}
                onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
                className="mt-4 cursor-pointer text-xs"
                disabled={busy}
              />
            </div>
          )}
        </div>

        <label className="mb-4 block">
          <span className="text-xs text-[var(--muted-foreground)]">Recipient</span>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={busy}
            placeholder="e.g. alice_test or fan-handle"
            maxLength={500}
            className="mt-1 w-full rounded-lg border bg-black/20 px-3 py-2 text-sm outline-none disabled:opacity-40"
            style={{ borderColor: 'var(--border)' }}
          />
        </label>

        <p className="mb-5 rounded-md border border-[var(--border)] bg-black/20 px-3 py-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
          <span className="font-mono-ui uppercase tracking-[0.18em] text-[var(--circe-light)]">v1 caveat —</span>{' '}
          survives direct file shares and most platform re-uploads. Does <strong>not</strong> survive re-encoding or
          screenshots. v2 (re-encode-survival) is in development.
        </p>

        <button
          type="button"
          onClick={() => void onSign()}
          disabled={!file || !recipient.trim() || busy}
          className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-40"
          style={{ background: 'var(--primary)' }}
        >
          {stage === 'preparing'
            ? 'Preparing…'
            : stage === 'uploading'
              ? 'Uploading…'
              : stage === 'embedding'
                ? 'Embedding marker…'
                : stage === 'done'
                  ? 'Traced — see download below'
                  : 'Sign & Download'}
        </button>

        {busy ? (
          <div className="mt-3 h-1 w-full overflow-hidden rounded bg-[var(--border-soft)]">
            <div
              className="h-full transition-all"
              style={{ width: `${progress}%`, background: 'var(--primary)' }}
            />
          </div>
        ) : null}

        {errorMsg ? (
          <p className="mt-4 rounded-md border border-[var(--destructive)] bg-black/20 px-3 py-2 text-xs text-[var(--destructive)]">
            {errorMsg}
          </p>
        ) : null}

        {result ? (
          <div className="mt-6 rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-3 text-sm">
              <span className="font-mono-ui mr-2 text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
                Traced
              </span>
              for <span className="font-semibold">{result.recipientLabel}</span>
              <span className="ml-2 font-mono-ui text-[10px] text-[var(--muted-foreground)]">
                · payload {result.payloadId.slice(0, 8)}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={result.downloadUrl}
                download={result.downloadFilename}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)]"
                style={{ background: 'var(--primary)' }}
              >
                Download traced copy
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(result.downloadUrl).catch(() => {})}
                className="rounded-md border px-3 py-2 text-xs"
                style={{ borderColor: 'var(--border)' }}
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border px-3 py-2 text-xs"
                style={{ borderColor: 'var(--border)' }}
              >
                Trace another
              </button>
            </div>
            <p className="mt-3 text-[10px] text-[var(--muted-foreground)]">
              Signed link expires {new Date(result.expiresAt).toLocaleString()}. Algorithm:{' '}
              {result.algorithmVersion}.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  )
}
