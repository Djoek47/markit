'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/client'
import { isPaidSubscription } from '@/lib/billing'
import { parseVaultContentIdFromExportUrl } from '@/lib/content-id'
import presetsData from '@/lib/data/frame-edit-presets.json'
import { VideoTrimSection } from '@/components/video-trim-section'

const CREATIX = process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com'

type Preset = {
  id: string
  label: string
  description: string
  tags: string[]
}

export function EditorApp() {
  const sp = useSearchParams()
  const importUrl = sp.get('importUrl') || ''
  const exportUrl = sp.get('exportUrl') || ''
  const exportToken = sp.get('exportToken') || ''

  const hasVaultBridge = Boolean(importUrl && exportUrl && exportToken)
  const contentId = useMemo(() => (exportUrl ? parseVaultContentIdFromExportUrl(exportUrl) : null), [exportUrl])

  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [paid, setPaid] = useState<boolean | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [entitlementReady, setEntitlementReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUserId(session?.user?.id ?? null)
      setAuthReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setSessionUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (!sessionUserId) {
      setPaid(null)
      setEntitlementReady(true)
      return
    }
    setEntitlementReady(false)
    const supabase = createClient()
    void supabase
      .from('subscriptions')
      .select('plan_id,status')
      .eq('user_id', sessionUserId)
      .maybeSingle()
      .then(({ data }) => {
        setPaid(isPaidSubscription(data))
        setEntitlementReady(true)
      })
  }, [authReady, sessionUserId])

  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [vaultUploadOk, setVaultUploadOk] = useState(false)

  const canManualExport = hasVaultBridge

  const pushFile = useCallback(
    async (file: File) => {
      if (!hasVaultBridge) return
      setExportBusy(true)
      setExportStatus(null)
      setVaultUploadOk(false)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('exportUrl', exportUrl)
        fd.append('exportToken', exportToken)
        const res = await fetch('/api/export', { method: 'POST', body: fd })
        const text = await res.text()
        if (!res.ok) {
          setExportStatus(`Upload failed (${res.status}): ${text.slice(0, 400)}`)
        } else {
          setExportStatus('Saved to your vault. Refresh Media & vault on Circe et Venus.')
          setVaultUploadOk(true)
        }
      } catch (e) {
        setExportStatus(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setExportBusy(false)
      }
    },
    [exportToken, exportUrl, hasVaultBridge],
  )

  const sendSourceToVault = useCallback(async () => {
    if (!importUrl || !hasVaultBridge) return
    setExportBusy(true)
    setExportStatus(null)
    setVaultUploadOk(false)
    try {
      const res = await fetch(importUrl, { method: 'GET', mode: 'cors' })
      if (!res.ok) {
        setExportStatus(`Could not read source (${res.status}).`)
        setExportBusy(false)
        return
      }
      const blob = await res.blob()
      const file = new File([blob], 'from-markit.mp4', { type: blob.type || 'video/mp4' })
      await pushFile(file)
    } catch (e) {
      setExportStatus(
        e instanceof Error
          ? `${e.message} — If CORS failed, confirm NEXT_PUBLIC_FRAME_URL on Creatix matches this host.`
          : 'Could not fetch source',
      )
      setExportBusy(false)
    }
  }, [hasVaultBridge, importUrl, pushFile])

  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'assistant'; text: string }[]>([])
  const chatMessagesRef = useRef(chatMessages)
  useEffect(() => {
    chatMessagesRef.current = chatMessages
  }, [chatMessages])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const canUseAi = hasVaultBridge || Boolean(sessionUserId)

  const runAssist = useCallback(
    async (userText: string) => {
      if (!canUseAi || aiBusy) return
      const userMsg = { id: crypto.randomUUID(), role: 'user' as const, text: userText }
      const next = [...chatMessagesRef.current, userMsg]
      setChatMessages(next)
      chatMessagesRef.current = next
      setAiBusy(true)
      setAiError(null)
      try {
        const ui: UIMessage[] = next.map((m) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: 'text', text: m.text }],
        }))
        const res = await fetch('/api/ai-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ messages: ui, vaultExportToken: exportToken || undefined }),
        })
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
        if (!res.ok) {
          setAiError(data.error || res.statusText)
          return
        }
        const reply = typeof data.text === 'string' ? data.text : ''
        const withAssistant = [
          ...next,
          { id: crypto.randomUUID(), role: 'assistant' as const, text: reply || '(empty response)' },
        ]
        setChatMessages(withAssistant)
        chatMessagesRef.current = withAssistant
      } catch (e) {
        setAiError(e instanceof Error ? e.message : 'Request failed')
      } finally {
        setAiBusy(false)
      }
    },
    [aiBusy, canUseAi, exportToken],
  )

  const presets = useMemo(() => (presetsData as { presets: Preset[] }).presets || [], [])
  const taxonomy = useMemo(
    () => (presetsData as { tagTaxonomy?: string[] }).tagTaxonomy || [],
    [],
  )

  const insertPreset = (p: Preset) => {
    const hint = `Preset "${p.label}": ${p.description}. Tags: ${p.tags.join(', ')}.`
    void runAssist(hint)
  }

  const [recipientKey, setRecipientKey] = useState('')
  const [ariadneBusy, setAriadneBusy] = useState(false)
  const [ariadneMsg, setAriadneMsg] = useState<string | null>(null)

  const applyAriadne = useCallback(async () => {
    if (!contentId || !exportToken || !recipientKey.trim()) {
      setAriadneMsg('Enter a recipient key.')
      return
    }
    setAriadneBusy(true)
    setAriadneMsg(null)
    try {
      const res = await fetch('/api/ariadne-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${exportToken}`,
        },
        body: JSON.stringify({
          contentId,
          recipientKey: recipientKey.trim(),
          source: 'frame_export',
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        setAriadneMsg(data.error || data.message || res.statusText)
        return
      }
      setAriadneMsg('Ariadne marker embedded. Vault file updated on Circe et Venus.')
    } catch (e) {
      setAriadneMsg(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setAriadneBusy(false)
    }
  }, [contentId, exportToken, recipientKey])

  const gateBlocked =
    !hasVaultBridge && entitlementReady && (sessionUserId === null || paid === false)

  return (
    <div className="bg-gradient-frame min-h-screen">
      <header className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="font-serif-display text-lg font-semibold tracking-wider" style={{ color: 'var(--primary)' }}>
              CIRCE ET VENUS
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Markit — video editor
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <a
              href={`${CREATIX}/dashboard/ai-studio`}
              className="hover:underline"
              style={{ color: 'var(--circe-light)' }}
            >
              AI Studio
            </a>
            <a href={`${CREATIX}/dashboard`} className="hover:underline" style={{ color: 'var(--circe-light)' }}>
              Dashboard
            </a>
            <a
              href={`${CREATIX}/dashboard/settings`}
              className="hover:underline"
              style={{ color: 'var(--circe-light)' }}
            >
              Subscription
            </a>
            <span style={{ color: 'var(--muted-foreground)' }}>|</span>
            {sessionUserId ? (
              <button
                type="button"
                className="hover:opacity-90"
                style={{ color: 'var(--muted-foreground)' }}
                onClick={async () => {
                  await createClient().auth.signOut()
                  setSessionUserId(null)
                  setPaid(null)
                }}
              >
                Sign out
              </button>
            ) : (
              <Link href="/auth/sign-in" className="font-medium hover:underline" style={{ color: 'var(--gold)' }}>
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      {!hasVaultBridge && (!authReady || !entitlementReady) ? (
        <p className="px-4 py-20 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Loading…
        </p>
      ) : gateBlocked ? (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h2 className="font-serif-display mb-3 text-xl">
            {sessionUserId ? 'Subscription required' : 'Sign in required'}
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Open Markit from <strong>Media &amp; vault</strong> with a bridge link (manual export is free; AI uses
            credits). Or sign in with an <strong>active paid</strong> Circe et Venus plan.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {!sessionUserId ? (
              <Link
                href="/auth/sign-in"
                className="bg-primary text-primary-foreground inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
              >
                Sign in
              </Link>
            ) : null}
            <a
              href={`${CREATIX}/dashboard/settings`}
              className="inline-block rounded-lg border px-5 py-2.5 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              Manage subscription
            </a>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-2">
          <section className="space-y-4">
            <h2 className="font-serif-display text-lg font-semibold">Preview &amp; export</h2>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <strong>No credits</strong> for vault uploads. AI credits apply to <strong>Markit Assist</strong> and{' '}
              <strong>Ariadne embed</strong> (per Creatix billing).
            </p>

            {!importUrl ? (
              <div
                className="rounded-xl border p-6 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
              >
                No <code style={{ color: 'var(--circe-light)' }}>importUrl</code>. Launch from{' '}
                <a href={`${CREATIX}/dashboard/ai-studio`} className="underline" style={{ color: 'var(--circe-light)' }}>
                  Media &amp; vault
                </a>{' '}
                on the main site.
              </div>
            ) : (
              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--border)', background: '#000' }}
              >
                <video key={importUrl} src={importUrl} controls playsInline className="max-h-[55vh] w-full" />
              </div>
            )}

            {importUrl && hasVaultBridge ? (
              <VideoTrimSection
                importUrl={importUrl}
                disabled={!canManualExport || exportBusy}
                onTrimmedExport={pushFile}
              />
            ) : null}

            <div
              className="flex flex-wrap gap-2 rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              <button
                type="button"
                disabled={!canManualExport || exportBusy}
                onClick={() => void sendSourceToVault()}
                className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Send source file to vault
              </button>
              <label
                className="cursor-pointer rounded-lg border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--border)' }}
              >
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={!canManualExport || exportBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void pushFile(f)
                    e.target.value = ''
                  }}
                />
                Upload edited file…
              </label>
            </div>
            {exportStatus ? (
              <p
                className="rounded-lg border p-3 text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
              >
                {exportStatus}
              </p>
            ) : null}
          </section>

          <section className="space-y-4">
            <h2 className="font-serif-display text-lg font-semibold">Markit Assist</h2>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Uses your <strong>AI credits</strong> on Circe et Venus. Open from the vault for bridge token auth, or
              sign in.
            </p>

            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              <p
                className="mb-2 text-xs font-medium uppercase tracking-wide"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Presets &amp; tags
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => insertPreset(p)}
                    disabled={!canUseAi || aiBusy}
                    className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-white/5 disabled:opacity-40"
                    style={{ borderColor: 'var(--border)' }}
                    title={p.description}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Taxonomy: {taxonomy.join(' · ')}
              </p>
            </div>

            <div
              className="flex min-h-[220px] flex-col rounded-xl border"
              style={{ borderColor: 'var(--border)', background: 'oklch(0.1 0.01 285)' }}
            >
              <div className="max-h-64 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
                {chatMessages.length === 0 ? (
                  <p style={{ color: 'var(--muted-foreground)' }}>
                    Ask for cuts, pacing, hooks, captions, or library tags.
                  </p>
                ) : (
                  chatMessages.map((m) => (
                    <div key={m.id} className={m.role === 'user' ? 'text-foreground' : ''} style={m.role === 'assistant' ? { color: 'var(--circe-light)' } : undefined}>
                      <span className="text-xs uppercase" style={{ color: 'var(--muted-foreground)' }}>
                        {m.role}
                      </span>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  ))
                )}
              </div>
              <form
                className="border-t p-2"
                style={{ borderColor: 'var(--border)' }}
                onSubmit={(e) => {
                  e.preventDefault()
                  const t = chatInput.trim()
                  if (!t || !canUseAi) return
                  void runAssist(t)
                  setChatInput('')
                }}
              >
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={canUseAi ? 'Ask Markit Assist…' : 'Sign in or use vault bridge for AI'}
                    disabled={!canUseAi || aiBusy}
                    className="focus:ring-primary flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-40"
                    style={{ borderColor: 'var(--border)', background: 'oklch(0.12 0.01 285)' }}
                  />
                  <button
                    type="submit"
                    disabled={!canUseAi || aiBusy || !chatInput.trim()}
                    className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>
            {aiError ? <p className="text-sm text-red-400">{aiError}</p> : null}

            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              <h3 className="font-serif-display mb-2 text-base font-semibold">Ariadne Trace</h3>
              <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                Optional <strong>append-v1</strong> forensic marker on the vault file after upload (uses AI credits per
                Circe et Venus). Configure recipient keys from the main app vault / Ariadne flows.
              </p>
              {hasVaultBridge && contentId ? (
                <div className="space-y-2">
                  <label className="block text-xs">
                    <span style={{ color: 'var(--muted-foreground)' }}>Recipient key</span>
                    <input
                      value={recipientKey}
                      onChange={(e) => setRecipientKey(e.target.value)}
                      placeholder="e.g. fan handle or label"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: 'var(--border)', background: 'oklch(0.1 0.01 285)' }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      ariadneBusy || !vaultUploadOk || !recipientKey.trim() || !exportToken
                    }
                    onClick={() => void applyAriadne()}
                    className="w-full rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-40"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {ariadneBusy ? 'Embedding…' : 'Embed marker on vault file'}
                  </button>
                  {!vaultUploadOk ? (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Upload or trim to vault first — then you can embed a marker on that file.
                    </p>
                  ) : null}
                  {ariadneMsg ? <p className="text-xs" style={{ color: 'var(--circe-light)' }}>{ariadneMsg}</p> : null}
                </div>
              ) : (
                <a
                  href={`${CREATIX}/dashboard/ai-studio/ariadne`}
                  className="text-sm underline"
                  style={{ color: 'var(--circe-light)' }}
                >
                  Open Ariadne on Circe et Venus →
                </a>
              )}
            </div>

            <div className="rounded-xl border border-dashed p-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                <strong>Roadmap:</strong> multi-clip timeline and transitions — see <code>ROADMAP.md</code> in this repo.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
