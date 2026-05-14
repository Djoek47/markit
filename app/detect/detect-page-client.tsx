'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type DetectVerdict =
  | { kind: 'identified'; recipientLabel: string; payloadIdShort: string; algorithmVersion: string }
  | { kind: 'orphaned'; payloadIdShort: string; reason: string }
  | { kind: 'no_marker' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'expired' }
  | { kind: 'v2_candidate'; payload_id: string; confidence: number; source: string; recipient_hint?: string }

type DetectResponse = {
  ok: true
  verdict: DetectVerdict
  line: string
}

type Stage = 'idle' | 'analyzing' | 'done' | 'error'

const ACCEPTED_MIME = 'video/mp4,video/quicktime,video/webm,video/x-matroska,image/jpeg,image/png,image/webp'

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const MAX_BYTES = 1024 * 1024 * 1024 // 1 GB

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function DetectPageClient() {
  const [authReady, setAuthReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<DetectResponse | null>(null)
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

  const onAnalyze = useCallback(async () => {
    if (!file) return
    setErrorMsg(null)
    setResult(null)
    setStage('analyzing')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/trace/detect', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = (await res.json().catch(() => ({}))) as
        | DetectResponse
        | { error?: string }
      if (!res.ok || !('ok' in data)) {
        const msg = (data as { error?: string }).error || `Detect failed (${res.status})`
        throw new Error(msg)
      }

      setResult(data)
      setStage('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
      setStage('error')
    }
  }, [file])

  const onReset = () => {
    setFile(null)
    setStage('idle')
    setErrorMsg(null)
    setResult(null)
  }

  if (!authReady) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-2xl space-y-12 text-center">
        <h1 className="font-serif-display text-5xl font-bold" style={{ color: 'var(--primary)' }}>
          Verify a Leak
        </h1>
        <div>
          <p className="text-lg mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Sign in to verify a leaked video.
          </p>
          <Link
            href="/auth/sign-in"
            className="inline-block rounded-lg px-6 py-3 font-semibold text-black transition-opacity"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="markit-shell flex min-h-dvh flex-col" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <header className="mk-header">
        <div className="mk-h-left">
          <span className="mk-brand">Markit <span className="mk-sep">·</span></span>
          <span style={{ fontFamily: 'var(--font-cinzel), serif', fontSize: 15, fontStyle: 'italic', color: 'var(--accent)' }}>Detect</span>
        </div>
        <div className="mk-h-right">
          <Link href="/editor" className="mk-btn">← Editor</Link>
        </div>
      </header>
      <main className="flex-1 px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-12">
        {/* Page title */}
        <div className="space-y-3 text-center">
          <h1 className="font-serif-display text-4xl">Verify a Leak</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Drop a video or screenshot. We extract its marker and tell you who it was sent to.
          </p>
        </div>

      {/* Drop Zone */}
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault()
          if (dropRef.current) dropRef.current.style.borderColor = 'var(--primary)'
        }}
        onDragLeave={() => {
          if (dropRef.current) dropRef.current.style.borderColor = file ? 'var(--primary)' : 'var(--border)'
        }}
        className="cursor-pointer space-y-4 rounded-lg border-2 border-dashed p-12 text-center transition-colors"
        style={{ borderColor: file ? 'var(--primary)' : 'var(--border)', background: file ? 'color-mix(in oklch, var(--primary) 6%, transparent)' : 'var(--card)' }}
        onClick={() => inputRef.current?.click()}
      >
        <div className="text-4xl">{file && IMAGE_MIMES.has(file.type) ? '🖼️' : '📹'}</div>
        {file ? (
          <div>
            <p className="font-mono-ui text-sm font-semibold" style={{ color: 'var(--primary)' }}>
              {file.name}
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {fmtBytes(file.size)} · {IMAGE_MIMES.has(file.type) ? 'Screenshot (v2 detection)' : 'Video (v1 detection)'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold">Click or drag a file here</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Video: MP4, MOV, WebM, Matroska (v1 marker) · Screenshot: PNG, JPEG, WebP (v2 frame watermark)
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME}
          className="hidden"
          onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Error Display */}
      {errorMsg && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--destructive)', background: 'color-mix(in oklch, var(--destructive) 10%, transparent)' }}>
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>{errorMsg}</p>
        </div>
      )}

      {/* Verdict Display */}
      {result && (
        <div className="space-y-4 rounded-lg p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {result.verdict.kind === 'identified' ? (
            <>
              <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Result</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
                  {result.verdict.recipientLabel}
                </div>
                <div className="font-mono-ui text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Payload: {result.verdict.payloadIdShort}
                </div>
                <div className="font-mono-ui text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Algorithm: {result.verdict.algorithmVersion}
                </div>
              </div>
            </>
          ) : result.verdict.kind === 'v2_candidate' ? (
            <>
              <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                {result.verdict.recipient_hint ? 'v2 Watermark Detected' : 'v2 Watermark Detected — Not in Your Records'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {result.verdict.recipient_hint && (
                  <div className="rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'color-mix(in oklch, var(--primary) 60%, transparent)', color: 'var(--foreground)' }}>
                    {result.verdict.recipient_hint}
                  </div>
                )}
                <div className="rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'color-mix(in oklch, var(--primary) 40%, transparent)', color: 'var(--foreground)' }}>
                  {(result.verdict.confidence * 100).toFixed(1)}% confidence
                </div>
                <div className="font-mono-ui text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Payload: {result.verdict.payload_id.slice(0, 16)}…
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {result.verdict.recipient_hint
                  ? `Recipient "${result.verdict.recipient_hint}" found — traced by a different account.`
                  : 'Frame watermark found but this payload isn\'t in any trace records. May have been traced outside Markit.'}
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--muted-foreground)' }}>{result.line}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        {file && stage === 'idle' && (
          <button
            onClick={onAnalyze}
            disabled={stage !== 'idle'}
            className="rounded-lg px-6 py-3 font-semibold text-black transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Verify Leak
          </button>
        )}
        {stage === 'analyzing' && (
          <button
            disabled
            className="rounded-lg px-6 py-3 font-semibold text-black opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Analyzing...
          </button>
        )}
        {stage === 'done' && (
          <button
            onClick={onReset}
            className="rounded-lg px-6 py-3 font-semibold transition-opacity"
            style={{ backgroundColor: 'var(--circe-light)', color: '#000' }}
          >
            Verify Another
          </button>
        )}
      </div>

      {/* Caveat */}
      <div className="rounded-lg p-4 space-y-2" style={{ background: 'var(--card-2)', border: '1px solid var(--border-soft)' }}>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>v1 (video):</span>{' '}
          Append marker — survives direct file shares and most platform re-uploads. Does not survive re-encoding or screenshots.
        </p>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <span className="font-semibold" style={{ color: 'var(--primary)' }}>v2 (screenshot):</span>{' '}
          Frame-level watermark — detects Ariadne v2 traces directly from PNG/JPEG screenshots. Survives re-encoding and platform re-upload.
        </p>
      </div>
      </div>
      </main>
    </div>
  )
}
