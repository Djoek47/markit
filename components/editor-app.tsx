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
import { MarkitEditorV2 } from '@/components/studio/markit-editor-v2'
import type { MarkitEditPlanV1 } from '@/lib/markit-edit-plan'
import { findLatestEditPlan, planNeedsSecondarySource } from '@/lib/markit-edit-plan'
import { runMarkitEditPlan } from '@/lib/run-markit-edit-plan'
import {
  clampAllSegments,
  loadTimelineFromStorage,
  saveTimelineToStorage,
  timelineToEditPlan,
} from '@/lib/timeline-project'
import type { TimelineSegment } from '@/lib/timeline-project'
import { createClipAtPlayhead } from '@/lib/editor/edit-operations'
import { createExportManifest } from '@/lib/editor/export-plan'
import { flagFramerTracedExport } from '@/lib/flags'
import { isFullFrameCrop } from '@/lib/crop-utils'

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
  /** Second vault asset (optional): same query shape from a second `frame-session` — for multi-angle cuts. */
  const importUrl2 = sp.get('importUrl2') || ''

  const hasVaultBridge = Boolean(importUrl && exportUrl && exportToken)
  const hasSecondaryImport = Boolean(importUrl2)
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

  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [vaultUploadOk, setVaultUploadOk] = useState(false)

  const canManualExport = hasVaultBridge

  /** POST one file to the primary vault slot (bridge). */
  const postFileToVault = useCallback(
    async (file: File): Promise<boolean> => {
      if (!hasVaultBridge) return false
      const fd = new FormData()
      fd.append('file', file)
      fd.append('exportToken', exportToken)
      const res = await fetch(exportUrl, { method: 'POST', body: fd, credentials: 'omit' })
      const text = await res.text()
      if (!res.ok) {
        console.error('[markit] vault export failed', { status: res.status })
        setExportStatus(`Upload failed (${res.status}): ${text.slice(0, 400)}`)
        return false
      }
      setExportStatus('Saved to your vault. Refresh Media & vault on Circe et Venus.')
      setVaultUploadOk(true)
      return true
    },
    [exportToken, exportUrl, hasVaultBridge],
  )

  const pushFile = useCallback(
    async (file: File) => {
      if (!hasVaultBridge) return
      setExportBusy(true)
      setExportStatus(null)
      setVaultUploadOk(false)
      try {
        await postFileToVault(file)
      } catch (e) {
        setExportStatus(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setExportBusy(false)
      }
    },
    [hasVaultBridge, postFileToVault],
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
  /* eslint-disable react-hooks/set-state-in-effect */
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

  const handleChatSubmit = useCallback(() => {
    const t = chatInput.trim()
    if (!t || !canUseAi) return
    void runAssist(t)
    setChatInput('')
  }, [canUseAi, chatInput, runAssist])

  const pendingEditPlan = useMemo(() => findLatestEditPlan(chatMessages), [chatMessages])

  const [timelineSegments, setTimelineSegments] = useState<TimelineSegment[]>([])
  const [videoDuration, setVideoDuration] = useState(0)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 1, height: 1 })
  const previewObjectUrlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!contentId) {
      setTimelineSegments([])
      return
    }
    setTimelineSegments(loadTimelineFromStorage(contentId))
  }, [contentId])

  useEffect(() => {
    if (!contentId) return
    saveTimelineToStorage(contentId, timelineSegments)
  }, [contentId, timelineSegments])

  useEffect(() => {
    if (videoDuration <= 0) return
    setTimelineSegments((prev) => clampAllSegments(prev, videoDuration))
  }, [videoDuration])

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
        previewObjectUrlRef.current = null
      }
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const clearPreview = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }
    setPreviewUrl(null)
  }, [])

  const runLocalPreview = useCallback(
    async (segments: TimelineSegment[]) => {
      if (segments.length === 0) {
        setExportStatus('Add clips or run a preset.')
        return
      }
      if (!importUrl || !hasVaultBridge) {
        setExportStatus('Open Markit from Media & vault to build a video preview.')
        return
      }
      const d = videoDuration
      if (!d || d <= 0) {
        setExportStatus('Wait for the source video to load.')
        return
      }
      setExportStatus('Rendering preview in your browser…')
      try {
        const plan = timelineToEditPlan(segments, 'markit-preview', cropRect)
        const mergedCrop = plan.crop ?? cropRect
        const effectivePlan: MarkitEditPlanV1 = {
          ...plan,
          crop: isFullFrameCrop(mergedCrop) ? undefined : mergedCrop,
        }
        setExportStatus('Loading video for preview…')
        const pres = await fetch(importUrl, { method: 'GET', mode: 'cors' })
        if (!pres.ok) throw new Error(`Could not read main video (${pres.status}).`)
        const primaryBlob = await pres.blob()
        setExportStatus('Rendering cuts in your browser…')
        const out = await runMarkitEditPlan(primaryBlob, null, effectivePlan, (p) => {
          if (p.message) setExportStatus(p.message)
        })
        if (previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current)
          previewObjectUrlRef.current = null
        }
        const url = URL.createObjectURL(out)
        previewObjectUrlRef.current = url
        setPreviewUrl(url)
        setExportStatus('Preview ready — press Play to watch your edit.')
      } catch (e) {
        console.error('[markit] preview render failed', e)
        const message =
          e instanceof Error
            ? e.message
            : typeof e === 'string'
              ? e
              : e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
                ? (e as { message: string }).message
                : `Preview failed: ${String(e)}`
        setExportStatus(message)
      } finally {
        // keep status messages only; no separate busy spinner in v2 shell
      }
    },
    [cropRect, hasVaultBridge, importUrl, videoDuration],
  )

  const executeEditPlan = useCallback(
    async (plan: MarkitEditPlanV1) => {
      if (!importUrl || !hasVaultBridge) return
      setExportBusy(true)
      setExportStatus(null)
      setVaultUploadOk(false)
      try {
        setExportStatus('Loading main video…')
        const pres = await fetch(importUrl, { method: 'GET', mode: 'cors' })
        if (!pres.ok) throw new Error(`Could not read main video (${pres.status}).`)
        const primaryBlob = await pres.blob()

        let secondaryBlob: Blob | null = null
        if (planNeedsSecondarySource(plan)) {
          if (!hasSecondaryImport) {
            throw new Error(
              'This plan uses a second angle. Add importUrl2=… to the Markit URL (asset URL from a second vault item’s frame session).',
            )
          }
          setExportStatus('Loading second angle…')
          const sres = await fetch(importUrl2, { method: 'GET', mode: 'cors' })
          if (!sres.ok) throw new Error(`Could not read second video (${sres.status}).`)
          secondaryBlob = await sres.blob()
        }

        setExportStatus('Rendering cuts in your browser…')
        const mergedCrop = plan.crop ?? cropRect
        const effectivePlan: MarkitEditPlanV1 = {
          ...plan,
          crop: isFullFrameCrop(mergedCrop) ? undefined : mergedCrop,
        }

        const out = await runMarkitEditPlan(primaryBlob, secondaryBlob, effectivePlan, (p) => {
          if (p.message) setExportStatus(p.message)
        })
        const baseName =
          (effectivePlan.label || 'markit-export').replace(/[^\w.-]+/g, '_').slice(0, 72) || 'markit-export'
        const file = new File([out], `${baseName}.mp4`, { type: 'video/mp4' })
        setExportStatus('Uploading to vault…')
        await postFileToVault(file)
      } catch (e) {
        console.error('[markit] edit export failed', e)
        const message =
          e instanceof Error
            ? e.message
            : typeof e === 'string'
              ? e
              : e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
                ? (e as { message: string }).message
                : `Export failed: ${String(e)}`
        setExportStatus(message)
        setVaultUploadOk(false)
      } finally {
        setExportBusy(false)
      }
    },
    [cropRect, hasSecondaryImport, hasVaultBridge, importUrl, importUrl2, postFileToVault],
  )

  const applyAiEditPlan = useCallback(async () => {
    const plan = findLatestEditPlan(chatMessagesRef.current)
    if (!plan) return
    await executeEditPlan(plan)
  }, [executeEditPlan])

  const exportTimelineToVault = useCallback(async () => {
    if (timelineSegments.length === 0) return
    const plan = timelineToEditPlan(timelineSegments, 'timeline-export', cropRect)
    await executeEditPlan(plan)
  }, [cropRect, executeEditPlan, timelineSegments])

  const runVoiceCommand = useCallback(async () => {
    const transcript = voiceTranscript.trim()
    if (!transcript) return
    setVoiceBusy(true)
    setVoiceStatus(null)
    try {
      const res = await fetch('/api/divine/voice-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        intent?: { type?: string; seconds?: number; durationSec?: number; count?: number }
        confirmation?: string
      }
      if (!res.ok) {
        setVoiceStatus(data.error || 'Voice command failed')
        return
      }
      const intent = data.intent
      if (intent?.type === 'make_teasers') {
        const count = Math.max(1, Math.min(8, Number(intent.count || 3)))
        const d = Math.max(6, Math.min(60, Number(intent.durationSec || 15)))
        const segs: TimelineSegment[] = []
        const vd = Math.max(0.1, videoDuration)
        for (let i = 0; i < count; i++) {
          const at = Math.min(i * d, Math.max(0, vd - d - 0.1))
          const clip = createClipAtPlayhead(vd, at, d, 'primary')
          segs.push({
            id: clip.id,
            startSec: clip.startSec,
            endSec: clip.endSec,
            source: clip.source,
            label: clip.label,
          })
        }
        setTimelineSegments(segs)
        setVoiceStatus(data.confirmation || 'Rendering voice teasers…')
        await runLocalPreview(segs)
      } else if (intent?.type === 'trim_window') {
        const seconds = Math.max(5, Math.min(120, Number(intent.seconds || 15)))
        const vd = videoDuration || seconds
        const segs: TimelineSegment[] = [
          {
            id: crypto.randomUUID(),
            startSec: 0,
            endSec: Math.min(vd, seconds),
            source: 'primary',
            label: `Voice trim ${seconds}s`,
          },
        ]
        setTimelineSegments(segs)
        setVoiceStatus(data.confirmation || 'Rendering trim…')
        await runLocalPreview(segs)
      } else {
        setVoiceStatus(data.confirmation || 'Voice intent parsed')
      }
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : 'Voice command failed')
    } finally {
      setVoiceBusy(false)
    }
  }, [runLocalPreview, videoDuration, voiceTranscript])

  const [recipientKey, setRecipientKey] = useState('')
  const [ariadneBusy, setAriadneBusy] = useState(false)
  const [ariadneMsg, setAriadneMsg] = useState<string | null>(null)
  const tracedExportEnabled = flagFramerTracedExport()

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

  const onSignOut = useCallback(async () => {
    await createClient().auth.signOut()
    setSessionUserId(null)
    setPaid(null)
  }, [])

  const ariadneBlock = hasVaultBridge && contentId ? (
    <div className="space-y-2 text-xs">
      <p className="text-[var(--muted-foreground)]">Step 1: export to vault. Step 2: add recipient key. Step 3: trace.</p>
      <label className="block">
        <span className="text-[var(--muted-foreground)]">Recipient key</span>
        <input
          value={recipientKey}
          onChange={(e) => setRecipientKey(e.target.value)}
          placeholder="fan-handle or email hash"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/20 px-2 py-1.5 text-xs"
        />
      </label>
      <button
        type="button"
        disabled={ariadneBusy || !vaultUploadOk || !recipientKey.trim() || !exportToken}
        onClick={() => void applyAriadne()}
        className="rounded-lg px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-40"
        style={{ background: 'var(--studio-accent)' }}
      >
        {ariadneBusy ? 'Embedding marker…' : 'Embed Ariadne marker'}
      </button>
      {!vaultUploadOk ? <p className="text-[11px] text-[var(--muted-foreground)]">Export to vault first.</p> : null}
      {ariadneMsg ? <p className="text-[11px] text-[var(--circe-light)]">{ariadneMsg}</p> : null}
      {tracedExportEnabled ? <p className="text-[11px] text-[var(--muted-foreground)]">Traced export mode enabled.</p> : null}
    </div>
  ) : (
    <a href={`${CREATIX}/dashboard/ai-studio/ariadne`} className="text-xs underline text-[var(--studio-accent)]">
      Open Ariadne on Circe et Venus
    </a>
  )

  if (!hasVaultBridge && (!authReady || !entitlementReady)) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--background)] px-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        <p>Loading…</p>
        <p className="mt-6 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Markit video editor is in beta.
        </p>
      </div>
    )
  }

  if (gateBlocked) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[var(--background)] px-4 py-16 text-[var(--foreground)]">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="mb-3 text-lg font-semibold">{sessionUserId ? 'Subscription required' : 'Sign in required'}</h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Open Markit from <strong>Media &amp; vault</strong> with a bridge link (manual export is free; AI uses credits).
            Or sign in with an <strong>active paid</strong> Circe et Venus plan.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {!sessionUserId ? (
              <Link
                href="/auth/sign-in"
                className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold"
                style={{ background: 'var(--studio-accent)', color: 'var(--primary-foreground)' }}
              >
                Sign in
              </Link>
            ) : null}
            <a
              href={`${CREATIX}/dashboard/settings`}
              className="inline-block rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm"
            >
              Manage subscription
            </a>
          </div>
          <p className="mt-10 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Markit video editor is in beta — features may change.
          </p>
        </div>
      </div>
    )
  }

  return (
    <MarkitEditorV2
      creatixUrl={CREATIX}
      importUrl={importUrl}
      hasVaultSource={hasVaultBridge}
      sessionUserId={sessionUserId}
      onSignOut={onSignOut}
      exportBusy={exportBusy}
      canExport={canManualExport}
      onSendSourceToVault={() => void sendSourceToVault()}
      onReplaceFile={(f) => {
        clearPreview()
        void pushFile(f)
      }}
      exportStatus={exportStatus}
      trimPanel={
        importUrl && hasVaultBridge ? (
          <VideoTrimSection
            importUrl={importUrl}
            disabled={!canManualExport || exportBusy}
            onTrimmedExport={pushFile}
          />
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            Open from Media &amp; vault to trim in the browser and upload to your vault.
          </p>
        )
      }
      chatMessages={chatMessages}
      chatInput={chatInput}
      onChatInputChange={setChatInput}
      onChatSubmit={handleChatSubmit}
      canUseAi={canUseAi}
      aiBusy={aiBusy}
      aiError={aiError}
      presets={presets.map((p) => ({ id: p.id, label: p.label, description: p.description }))}
      onQuickAssist={(hint) => void runAssist(hint)}
      previewUrl={previewUrl}
      onClearPreview={clearPreview}
      ariadneBlock={ariadneBlock}
      pendingEditPlan={pendingEditPlan}
      onApplyAiEditPlan={() => void applyAiEditPlan()}
      hasSecondaryImport={hasSecondaryImport}
      timelineSegments={timelineSegments}
      onTimelineSegmentsChange={setTimelineSegments}
      onExportTimeline={() => void exportTimelineToVault()}
      onVideoDuration={setVideoDuration}
      voiceTranscript={voiceTranscript}
      onVoiceTranscriptChange={setVoiceTranscript}
      onVoiceRun={() => void runVoiceCommand()}
      voiceBusy={voiceBusy}
      voiceStatus={voiceStatus}
      cropRect={cropRect}
      onCropRectChange={(next) => {
        const maxX = Math.max(0, 1 - next.width)
        const maxY = Math.max(0, 1 - next.height)
        setCropRect({
          x: Math.max(0, Math.min(maxX, next.x)),
          y: Math.max(0, Math.min(maxY, next.y)),
          width: Math.max(0.1, Math.min(1, next.width)),
          height: Math.max(0.1, Math.min(1, next.height)),
        })
      }}
      timelineManifest={createExportManifest({
        durationSec: Math.max(0, videoDuration),
        revision: timelineSegments.length + 1,
        tracks: [
          {
            id: 'main',
            name: 'Main Track',
            clips: timelineSegments.map((s) => ({
              id: s.id,
              source: s.source ?? 'primary',
              startSec: s.startSec,
              endSec: s.endSec,
              label: s.label,
            })),
          },
        ],
      })}
    />
  )
}
