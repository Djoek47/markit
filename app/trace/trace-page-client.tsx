'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stage = 'idle' | 'tracing' | 'done' | 'error'

const ACCEPTED_MIME = 'video/mp4,video/quicktime,video/webm,video/x-matroska,image/jpeg,image/png,image/webp'
const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_BYTES = 1024 * 1024 * 1024

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function TracePageClient() {
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [recipient, setRecipient] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [activeMethod, setActiveMethod] = useState<'v1' | 'v2' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState<string>('traced.mp4')
  const [payloadId, setPayloadId] = useState<string | null>(null)
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

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (downloadUrl?.startsWith('blob:')) URL.revokeObjectURL(downloadUrl)
    }
  }, [downloadUrl])

  const isImage = file ? IMAGE_MIMES.has(file.type) : false

  const handleSelectFile = (next: File | null) => {
    setErrorMsg(null)
    setDownloadUrl(null)
    setPayloadId(null)
    setStage('idle')
    setActiveMethod(null)
    if (!next) { setFile(null); return }
    if (next.size > MAX_BYTES) {
      setErrorMsg(`File too large (${fmtBytes(next.size)} > 1 GB)`)
      return
    }
    setFile(next)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleSelectFile(dropped)
  }, [])

  const runTrace = useCallback(async (endpoint: string, method: 'v1' | 'v2') => {
    if (!file || !recipient.trim()) return
    setErrorMsg(null)
    setDownloadUrl(null)
    setPayloadId(null)
    setActiveMethod(method)
    setStage('tracing')

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('recipientLabel', recipient.trim())

      const res = await fetch(endpoint, { method: 'POST', credentials: 'include', body: form })

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `Trace failed (${res.status})`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const pid = res.headers.get('X-Payload-Id') ?? ''
      const fname =
        res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        ?? `traced_${Date.now()}.${method === 'v2' ? 'png' : 'mp4'}`

      setDownloadUrl(url)
      setDownloadName(fname)
      setPayloadId(pid)
      setStage('done')

      const a = document.createElement('a')
      a.href = url
      a.download = fname
      a.click()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Trace failed')
      setStage('error')
      setActiveMethod(null)
    }
  }, [file, recipient])

  const reset = () => {
    if (downloadUrl?.startsWith('blob:')) URL.revokeObjectURL(downloadUrl)
    setFile(null)
    setRecipient('')
    setStage('idle')
    setActiveMethod(null)
    setErrorMsg(null)
    setDownloadUrl(null)
    setPayloadId(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (!authReady) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Loading…
      </main>
    )
  }

  if (!userId) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-6" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="max-w-md text-center">
          <p className="font-mono-ui mb-4 text-[10px] uppercase tracking-[0.32em]" style={{ color: 'var(--primary)' }}>
            Markit · Trace
          </p>
          <h1 className="font-serif-display mb-3 text-3xl">Sign in to forensic-trace</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Drop a video, enter a recipient, download a uniquely marked copy.
          </p>
          <Link
            href="/auth/sign-in?next=/trace"
            className="inline-block rounded-full px-6 py-3 text-sm font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const busy = stage === 'tracing'
  const canTrace = !!file && !!recipient.trim() && !busy

  return (
    <div className="markit-shell flex min-h-dvh flex-col" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <header className="mk-header">
        <div className="mk-h-left">
          <span className="mk-brand">Markit <span className="mk-sep">·</span></span>
          <span style={{ fontFamily: 'var(--font-cinzel), serif', fontSize: 15, fontStyle: 'italic', color: 'var(--accent)' }}>Trace</span>
        </div>
        <div className="mk-h-right">
          <Link href="/detect" className="mk-btn">Detect →</Link>
          <Link href="/editor" className="mk-btn">← Editor</Link>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-8">

          {/* Title */}
          <div>
            <h1 className="font-serif-display text-4xl">Forensic-trace a video</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Embed a unique marker tied to a recipient. If the file leaks,{' '}
              <Link href="/detect" className="underline">drop it in /detect</Link> to identify who.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer"
            style={{
              borderColor: file ? 'var(--primary)' : 'var(--border)',
              background: file ? 'color-mix(in oklch, var(--primary) 6%, transparent)' : 'transparent',
            }}
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {fmtBytes(file.size)} · {file.type || 'video'}
                </p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleSelectFile(null) }}
                  disabled={busy}
                  className="mt-3 rounded-md border px-3 py-1 text-xs disabled:opacity-40"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Choose a different file
                </button>
              </div>
            ) : (
              <div>
                <div className="text-3xl mb-2">📹</div>
                <p className="text-sm font-medium">Drop a file here or click to browse</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Video: MP4, MOV, WebM, MKV (v1) · Image: PNG, JPEG, WebP (v1 &amp; v2)
                </p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_MIME}
              onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
              className="hidden"
              disabled={busy}
            />
          </div>

          {/* Recipient */}
          <label className="block">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Recipient label</span>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={busy}
              placeholder="e.g. alice_test or @fanhandle"
              maxLength={500}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-40"
              style={{ borderColor: 'var(--border)', background: 'transparent' }}
            />
          </label>

          {/* Error */}
          {errorMsg && (
            <p className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
              {errorMsg}
            </p>
          )}

          {/* Action cards */}
          {stage !== 'done' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Option 1 — v1 append marker */}
              <div className="rounded-xl border p-5 space-y-3 flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <div>
                  <p className="font-semibold text-sm">⬇️ v1 — Download to PC</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    Append marker after EOF. Works on video &amp; images.
                    Survives direct shares &amp; most re-uploads. No Creatix needed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runTrace('/api/trace/embed-direct', 'v1')}
                  disabled={!canTrace}
                  className="mt-auto w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40 transition-opacity"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {busy && activeMethod === 'v1' ? 'Embedding…' : 'Trace & Download (v1)'}
                </button>
              </div>

              {/* Option 2 — v2 frame watermark */}
              <div
                className="rounded-xl border p-5 space-y-3 flex flex-col"
                style={{
                  borderColor: isImage ? 'var(--primary)' : 'var(--border)',
                  background: 'var(--card)',
                  opacity: isImage ? 1 : 0.5,
                }}
              >
                <div>
                  <p className="font-semibold text-sm">🔬 v2 — Frame watermark</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    {isImage
                      ? 'LSB pixel watermark embedded locally via sharp. Survives screenshots & re-saves. Drop the result into /detect to test the full loop.'
                      : 'Drop an image (PNG/JPEG/WebP) to use local v2 embed. Video v2 requires Creatix (coming soon).'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runTrace('/api/trace/embed-v2-local', 'v2')}
                  disabled={!canTrace || !isImage}
                  className="mt-auto w-full rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40 transition-opacity"
                  style={{ background: isImage ? 'var(--primary)' : 'var(--muted)', color: isImage ? 'var(--primary-foreground)' : 'var(--muted-foreground)' }}
                >
                  {busy && activeMethod === 'v2' ? 'Embedding…' : isImage ? 'Trace & Download (v2)' : 'Image required for v2'}
                </button>
              </div>
            </div>
          )}

          {/* Done state */}
          {stage === 'done' && downloadUrl && (
            <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 6%, transparent)' }}>
              <p className="font-semibold text-sm" style={{ color: 'var(--primary)' }}>✓ Traced successfully</p>
              <p className="text-sm">
                Recipient: <span className="font-semibold">{recipient}</span>
                {payloadId && (
                  <span className="ml-2 font-mono-ui text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    · payload {payloadId.slice(0, 8)}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={downloadUrl}
                  download={downloadName}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  Download again
                </a>
                <Link
                  href="/detect"
                  className="rounded-lg border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Test in /detect →
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Trace another
                </button>
              </div>
            </div>
          )}

          {/* Caveat */}
          <div className="rounded-lg p-4 space-y-1.5" style={{ background: 'var(--card-2)', border: '1px solid var(--border-soft)' }}>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>v1:</span>{' '}
              Append marker — works for video &amp; images. Test by dropping into <Link href="/detect" className="underline">/detect</Link>.
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-semibold" style={{ color: 'var(--primary)' }}>v2 (images):</span>{' '}
              LSB frame watermark — drop a PNG/JPEG/WebP, get a watermarked PNG back. Drop it into /detect to verify the full loop.
              Video v2 requires Creatix (coming soon).
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}
