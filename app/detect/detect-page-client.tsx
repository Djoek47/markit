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

type DetectResponse = {
  ok: true
  verdict: DetectVerdict
  line: string
}

type Stage = 'idle' | 'analyzing' | 'done' | 'error'

const ACCEPTED_MIME = 'video/mp4,video/quicktime,video/webm,video/x-matroska'
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
    <div className="mx-auto max-w-2xl space-y-12">
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="font-serif-display text-5xl font-bold" style={{ color: 'var(--primary)' }}>
          Verify a Leak
        </h1>
        <p className="text-lg" style={{ color: 'var(--muted-foreground)' }}>
          Drop a video. We extract its marker and tell you who it was sent to.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault()
          dropRef.current?.classList.add('border-amber-400')
        }}
        onDragLeave={() => {
          dropRef.current?.classList.remove('border-amber-400')
        }}
        className="cursor-pointer space-y-4 rounded-lg border-2 border-dashed border-gray-600 bg-slate-800/50 p-12 text-center transition-colors hover:border-amber-400 hover:bg-slate-700/50"
        onClick={() => inputRef.current?.click()}
      >
        <div className="text-4xl">📹</div>
        {file ? (
          <div>
            <p className="font-mono-ui text-sm font-semibold" style={{ color: 'var(--primary)' }}>
              {file.name}
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {fmtBytes(file.size)}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold">Click or drag a video file here</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              MP4, MOV, WebM, or Matroska (up to 1 GB)
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
        <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-4">
          <p className="text-sm text-red-200">{errorMsg}</p>
        </div>
      )}

      {/* Verdict Display */}
      {result && (
        <div className="space-y-4 rounded-lg bg-slate-700/30 p-6">
          {result.verdict.kind === 'identified' ? (
            <>
              <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                Result
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={{ backgroundColor: 'var(--primary)', color: '#000' }}
                >
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
      <div className="rounded-lg bg-slate-700/20 p-4">
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Append-v1 markers survive direct file shares and most platform re-uploads (MP4 → MP4 with no
          re-encode), but do not survive re-encoding, format conversion, or significant edits.
        </p>
      </div>
    </div>
  )
}
