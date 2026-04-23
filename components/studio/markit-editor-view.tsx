'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarkitEditPlanV1 } from '@/lib/markit-edit-plan'
import { planNeedsSecondarySource } from '@/lib/markit-edit-plan'
import type { TimelineSegment } from '@/lib/timeline-project'
import { TimelineClipsStrip } from '@/components/studio/timeline-clips-strip'

type TabId = 'basic' | 'effects' | 'adjust'

export type MarkitEditorViewProps = {
  creatixUrl: string
  importUrl: string
  hasVaultSource: boolean
  sessionUserId: string | null
  onSignOut: () => void
  /** Export / vault */
  exportBusy: boolean
  canExport: boolean
  onSendSourceToVault: () => void
  onReplaceFile: (file: File) => void
  exportStatus: string | null
  /** Trim panel (ffmpeg UI) */
  trimPanel: ReactNode
  /** Assist */
  chatMessages: { id: string; role: 'user' | 'assistant'; text: string }[]
  chatInput: string
  onChatInputChange: (v: string) => void
  onChatSubmit: () => void
  canUseAi: boolean
  aiBusy: boolean
  aiError: string | null
  presets: { id: string; label: string; description: string }[]
  onPresetClick: (p: { id: string; label: string; description: string }) => void
  onQuickAssist: (hint: string) => void
  /** Parsed ```markit-edit``` plan from the latest assistant message */
  pendingEditPlan: MarkitEditPlanV1 | null
  onApplyAiEditPlan: () => void
  hasSecondaryImport: boolean
  /** Multi-clip timeline (Phase 2) */
  timelineSegments: TimelineSegment[]
  onTimelineSegmentsChange: (segments: TimelineSegment[]) => void
  onExportTimeline: () => void
  onVideoDuration: (sec: number) => void
  /** Voice-first Divine editing */
  voiceTranscript: string
  onVoiceTranscriptChange: (v: string) => void
  onVoiceRun: () => void
  voiceBusy: boolean
  voiceStatus: string | null
  onApplyAIAutoPlan: () => void
  timelineManifest: { revision: number; segmentChecksum: string }
  /** Ariadne */
  ariadneBlock: ReactNode
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MarkitEditorView({
  creatixUrl,
  importUrl,
  hasVaultSource,
  sessionUserId,
  onSignOut,
  exportBusy,
  canExport,
  onSendSourceToVault,
  onReplaceFile,
  exportStatus,
  trimPanel,
  chatMessages,
  chatInput,
  onChatInputChange,
  onChatSubmit,
  canUseAi,
  aiBusy,
  aiError,
  presets,
  onPresetClick,
  onQuickAssist,
  pendingEditPlan,
  onApplyAiEditPlan,
  hasSecondaryImport,
  timelineSegments,
  onTimelineSegmentsChange,
  onExportTimeline,
  onVideoDuration,
  voiceTranscript,
  onVoiceTranscriptChange,
  onVoiceRun,
  voiceBusy,
  voiceStatus,
  onApplyAIAutoPlan,
  timelineManifest,
  ariadneBlock,
}: MarkitEditorViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<TabId>('basic')
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  const onMeta = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const d = v.duration
    if (Number.isFinite(d)) {
      setDuration(d)
      onVideoDuration(d)
    }
  }, [onVideoDuration])

  const onTick = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
  }, [])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [importUrl])

  const seekFromTimeline = useCallback((clientX: number) => {
    const el = timelineRef.current
    const v = videoRef.current
    if (!el || !v || !duration) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    const t = (x / rect.width) * duration
    v.currentTime = t
    setCurrentTime(t)
  }, [duration])

  const seekToSeconds = useCallback(
    (sec: number) => {
      const v = videoRef.current
      if (!v || !duration) return
      const t = Math.min(Math.max(0, sec), duration)
      v.currentTime = t
      setCurrentTime(t)
    },
    [duration],
  )

  const ct = Math.floor(currentTime)
  const assistHint = `I can help you edit at ${formatTime(currentTime)}. What would you like to do?`

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Top chrome */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-3 md:px-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-tight">Markit</span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{ background: 'var(--studio-accent-muted)', color: 'var(--studio-accent)' }}
          >
            Beta
          </span>
          <span className="hidden text-xs md:inline" style={{ color: 'var(--muted-foreground)' }}>
            Circe et Venus
          </span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button
            type="button"
            className="rounded-lg px-2 py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-white/5"
            title="Save is your vault export"
            disabled={!canExport || exportBusy}
            onClick={() => canExport && onSendSourceToVault()}
          >
            Save
          </button>
          <a
            href={`${creatixUrl}/dashboard/ai-studio`}
            className="rounded-lg px-2 py-1.5 text-xs hover:bg-white/5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Vault
          </a>
          <span
            className="hidden rounded-lg px-2 py-1 text-xs font-medium md:inline"
            style={{ background: 'var(--studio-accent-muted)', color: 'var(--studio-accent)' }}
          >
            Pro
          </span>
          {sessionUserId ? (
            <button
              type="button"
              className="text-xs hover:underline"
              style={{ color: 'var(--muted-foreground)' }}
              onClick={() => void onSignOut()}
            >
              Out
            </button>
          ) : (
            <Link href="/auth/sign-in" className="text-xs font-medium" style={{ color: 'var(--studio-accent)' }}>
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div
        className="shrink-0 border-b border-[var(--border)] px-3 py-1.5 text-center text-[11px] leading-snug md:px-4 md:text-left"
        style={{ background: 'var(--studio-accent-muted)', color: 'var(--muted-foreground)' }}
        role="status"
      >
        <strong style={{ color: 'var(--foreground)' }}>Beta —</strong> This video editor is still in development.
        Features, export quality, and performance may change. Report issues from{' '}
        <a href={`${creatixUrl}/dashboard/ai-studio`} className="underline" style={{ color: 'var(--studio-accent)' }}>
          AI Studio
        </a>{' '}
        / your usual Circe et Venus support channels.
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Media library */}
        <aside
          className="flex w-full shrink-0 flex-col border-b border-[var(--border)] p-3 md:w-52 md:border-b-0 md:border-r"
          style={{ background: 'var(--card)' }}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
            Media library
          </p>
          <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] py-6 text-sm hover:bg-white/5">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              disabled={!canExport || exportBusy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onReplaceFile(f)
                e.target.value = ''
              }}
            />
            <span style={{ color: 'var(--studio-accent)' }}>+</span>
            <span>Import media</span>
          </label>
          <div className="rounded-lg border border-[var(--border)] p-2 text-xs">
            <p style={{ color: 'var(--muted-foreground)' }}>Source</p>
            {hasVaultSource ? (
              <p className="mt-1 font-medium text-[var(--circe-light)]">Vault bridge</p>
            ) : (
              <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
                Open from{' '}
                <a href={`${creatixUrl}/dashboard/ai-studio`} className="underline" style={{ color: 'var(--studio-accent)' }}>
                  AI Studio
                </a>
              </p>
            )}
          </div>
        </aside>

        {/* Center: preview + AI dock */}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col p-2 md:p-4">
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-black/40">
            {!importUrl ? (
              <div className="max-w-md p-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                <p className="mb-2 font-medium text-[var(--foreground)]">No video loaded</p>
                <p>
                  Launch from{' '}
                  <a href={`${creatixUrl}/dashboard/ai-studio`} className="underline" style={{ color: 'var(--studio-accent)' }}>
                    Media &amp; vault
                  </a>{' '}
                  on Circe et Venus, or import a file.
                </p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  key={importUrl}
                  src={importUrl}
                  className="max-h-[min(56vh,calc(100dvh-240px))] w-full max-w-5xl object-contain"
                  playsInline
                  onLoadedMetadata={onMeta}
                  onTimeUpdate={onTick}
                  onClick={togglePlay}
                />
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="rounded-full px-4 py-1.5 text-sm font-medium"
                    style={{ background: 'var(--studio-accent)', color: 'var(--primary-foreground)' }}
                  >
                    {playing ? 'Pause' : 'Play'}
                  </button>
                  <label className="cursor-pointer rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-white/5">
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={!canExport || exportBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) onReplaceFile(f)
                        e.target.value = ''
                      }}
                    />
                    Replace
                  </label>
                  <button
                    type="button"
                    disabled={!canExport || exportBusy}
                    onClick={() => onSendSourceToVault()}
                    className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm hover:bg-white/5 disabled:opacity-40"
                  >
                    Send source to vault
                  </button>
                </div>
              </>
            )}

            {/* Floating AI assistant */}
            {importUrl ? (
              <div
                className="absolute bottom-3 right-2 left-2 mx-auto w-[min(100%,22rem)] rounded-xl border shadow-2xl md:right-4 md:left-auto md:mx-0"
                style={{
                  borderColor: 'var(--border)',
                  background: 'oklch(0.14 0.02 280 / 0.95)',
                  boxShadow: '0 12px 40px oklch(0.3 0.15 290 / 0.25)',
                }}
              >
                <div className="border-b border-[var(--border)] px-3 py-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--studio-accent)' }}>
                    Markit Assistant
                  </p>
                  <p className="text-[11px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                    {assistHint}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 border-b border-[var(--border)] px-2 py-2">
                  {[
                    {
                      label: 'Teaser',
                      hint:
                        'Propose a short teaser (under 60s) as segment timestamps, and include a ```markit-edit``` JSON block so I can build it.',
                    },
                    {
                      label: 'Compilation',
                      hint:
                        'Propose a highlight compilation with segment timestamps and a ```markit-edit``` JSON block (concat_segments) to assemble it.',
                    },
                    {
                      label: `Cut @ ${ct}s`,
                      hint: `Suggest edits around ${ct}s and include a markit-edit plan if you can.`,
                    },
                  ].map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      disabled={!canUseAi || aiBusy}
                      onClick={() => onQuickAssist(q.hint)}
                      className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] hover:bg-[var(--studio-accent-muted)] disabled:opacity-40"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="studio-scrollbar max-h-28 overflow-y-auto px-3 py-2 text-xs">
                  {chatMessages.length === 0 ? (
                    <p style={{ color: 'var(--muted-foreground)' }}>Ask for pacing, hooks, or tags — editing guidance.</p>
                  ) : (
                    chatMessages.map((m) => (
                      <div key={m.id} className="mb-2">
                        <span className="text-[10px] uppercase" style={{ color: 'var(--muted-foreground)' }}>
                          {m.role}
                        </span>
                        <p
                          className="whitespace-pre-wrap"
                          style={{ color: m.role === 'assistant' ? 'var(--circe-light)' : 'var(--foreground)' }}
                        >
                          {m.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                {pendingEditPlan ? (
                  <div className="border-t border-[var(--border)] px-2 py-2">
                    <p className="mb-1 text-[10px] font-medium" style={{ color: 'var(--studio-accent)' }}>
                      AI edit ready
                    </p>
                    <p className="mb-2 text-[10px] leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                      {pendingEditPlan.segments.length} segment{pendingEditPlan.segments.length === 1 ? '' : 's'}
                      {pendingEditPlan.label ? ` · ${pendingEditPlan.label}` : ''}. Renders in your browser, then uploads to
                      the vault.
                    </p>
                    {planNeedsSecondarySource(pendingEditPlan) && !hasSecondaryImport ? (
                      <p className="mb-2 text-[10px] text-amber-400/90">
                        This plan uses a second angle — add <code className="text-[9px]">importUrl2</code> (second asset URL)
                        to the page query.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={!canExport || exportBusy || (planNeedsSecondarySource(pendingEditPlan) && !hasSecondaryImport)}
                      onClick={onApplyAiEditPlan}
                      className="w-full rounded-lg py-2 text-xs font-semibold disabled:opacity-40"
                      style={{ background: 'var(--studio-accent)', color: 'var(--primary-foreground)' }}
                    >
                      {exportBusy ? 'Working…' : 'Build & upload to vault'}
                    </button>
                  </div>
                ) : null}
                <form
                  className="flex gap-1 border-t border-[var(--border)] p-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    onChatSubmit()
                  }}
                >
                  <input
                    value={chatInput}
                    onChange={(e) => onChatInputChange(e.target.value)}
                    placeholder={
                      canUseAi
                        ? 'Teaser, compilation, rough cut — assistant can output a buildable plan…'
                        : 'Sign in or use vault bridge'
                    }
                    disabled={!canUseAi || aiBusy}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-black/30 px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[var(--studio-accent)] disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={!canUseAi || aiBusy || !chatInput.trim()}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    style={{ background: 'var(--studio-accent)', color: 'var(--primary-foreground)' }}
                  >
                    →
                  </button>
                </form>
                {aiError ? <p className="px-2 pb-2 text-[10px] text-red-400">{aiError}</p> : null}
              </div>
            ) : null}
          </div>
        </main>

        {/* Right: tools */}
        <aside
          className="flex w-full shrink-0 flex-col border-t border-[var(--border)] md:w-80 md:border-l md:border-t-0"
          style={{ background: 'var(--card)' }}
        >
          <div className="flex border-b border-[var(--border)]">
            {(
              [
                ['basic', 'Basic'],
                ['effects', 'Effects'],
                ['adjust', 'Adjust'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="flex-1 py-2.5 text-xs font-medium"
                style={{
                  borderBottom: tab === id ? '2px solid var(--studio-accent)' : '2px solid transparent',
                  color: tab === id ? 'var(--foreground)' : 'var(--muted-foreground)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="studio-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            {tab === 'basic' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {['90s', 'Cinematic'].map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={!canUseAi || aiBusy}
                      onClick={() => onQuickAssist(`Suggest a ${name} look and edit pacing for this clip.`)}
                      className="rounded-lg border border-[var(--border)] py-3 text-xs font-medium hover:bg-white/5 disabled:opacity-40"
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!canUseAi || aiBusy}
                  onClick={() => onQuickAssist('Suggest auto color/exposure adjustments for this clip (no server render).')}
                  className="w-full rounded-lg border border-[var(--border)] py-2 text-xs hover:bg-white/5 disabled:opacity-40"
                >
                  Auto adjust (guidance)
                </button>
                <button
                  type="button"
                  disabled={!canUseAi || aiBusy}
                  onClick={() => onQuickAssist('Suggest AI enhancement priorities for this clip before export.')}
                  className="w-full rounded-lg border border-[var(--border)] py-2 text-xs hover:bg-white/5 disabled:opacity-40"
                >
                  AI enhance (guidance)
                </button>
                <div className="flex flex-wrap gap-1">
                  {presets.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={p.description}
                      disabled={!canUseAi || aiBusy}
                      onClick={() => onPresetClick(p)}
                      className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px] hover:bg-[var(--studio-accent-muted)] disabled:opacity-40"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-[var(--border)] p-2">
                  <p className="mb-1 text-[10px] font-medium" style={{ color: 'var(--studio-accent)' }}>
                    Divine voice-first
                  </p>
                  <div className="flex gap-1">
                    <input
                      value={voiceTranscript}
                      onChange={(e) => onVoiceTranscriptChange(e.target.value)}
                      placeholder='\"Cut hottest 15s and make 3 teasers\"'
                      className="min-w-0 flex-1 rounded border border-[var(--border)] bg-black/30 px-2 py-1 text-[10px]"
                    />
                    <button
                      type="button"
                      onClick={onVoiceRun}
                      disabled={voiceBusy || !voiceTranscript.trim()}
                      className="rounded px-2 py-1 text-[10px] font-medium disabled:opacity-40"
                      style={{ background: 'var(--studio-accent)', color: 'var(--primary-foreground)' }}
                    >
                      {voiceBusy ? '...' : 'Run'}
                    </button>
                  </div>
                  {voiceStatus ? (
                    <p className="mt-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                      {voiceStatus}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onApplyAIAutoPlan}
                  className="w-full rounded-lg border border-[var(--border)] py-2 text-xs hover:bg-white/5"
                >
                  Build AI auto-plan
                </button>
                {trimPanel}
              </>
            )}
            {tab === 'effects' && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Effects packs ship in a future release. Use Assistant for look direction today.
              </p>
            )}
            {tab === 'adjust' && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Fine sliders (speed, curves) — roadmap. Trim and export work today in Basic.
              </p>
            )}
            <div className="mt-auto border-t border-[var(--border)] pt-3">{ariadneBlock}</div>
          </div>
        </aside>
      </div>

      {/* Timeline */}
      <footer className="shrink-0 border-t border-[var(--border)] px-2 py-2" style={{ background: 'var(--timeline-track)' }}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            Timeline
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              rev {timelineManifest.revision} · {timelineManifest.segmentChecksum.slice(0, 8)}
            </span>
            {importUrl ? (
              <button
                type="button"
                disabled={
                  !canExport ||
                  exportBusy ||
                  timelineSegments.length === 0 ||
                  (timelineSegments.some((s) => s.source === 'secondary') && !hasSecondaryImport)
                }
                onClick={onExportTimeline}
                className="rounded-lg px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
                style={{ background: 'var(--studio-accent)', color: 'var(--primary-foreground)' }}
              >
                Export clip list
              </button>
            ) : null}
          </div>
        </div>
        {importUrl ? (
          <TimelineClipsStrip
            duration={duration}
            currentTime={currentTime}
            segments={timelineSegments}
            onSegmentsChange={onTimelineSegmentsChange}
            videoRef={videoRef}
            hasSecondaryImport={hasSecondaryImport}
            disabled={!canExport || exportBusy}
            onSeek={seekToSeconds}
          />
        ) : null}
        <div
          ref={timelineRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 100}
          aria-valuenow={currentTime}
          tabIndex={0}
          className="relative h-14 cursor-pointer rounded-md border border-[var(--border)]"
          style={{ background: 'oklch(0.1 0.02 280)' }}
          onClick={(e) => seekFromTimeline(e.clientX)}
          onKeyDown={(e) => {
            const v = videoRef.current
            if (!v || !duration) return
            if (e.key === 'ArrowLeft') {
              v.currentTime = Math.max(0, v.currentTime - 1)
            }
            if (e.key === 'ArrowRight') {
              v.currentTime = Math.min(duration, v.currentTime + 1)
            }
          }}
        >
          {duration > 0 ? (
            <>
              <div
                className="absolute bottom-2 left-0 top-2 rounded-sm opacity-90"
                style={{
                  width: '100%',
                  background: `linear-gradient(90deg, var(--timeline-clip) 0%, oklch(0.35 0.08 290) 100%)`,
                }}
              />
              <div
                className="absolute bottom-0 top-0 w-0.5 bg-[var(--studio-accent)] shadow-[0_0_8px_var(--studio-accent)]"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              Load a video to see the timeline
            </div>
          )}
        </div>
        {exportStatus ? (
          <p className="mt-1 truncate px-1 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            {exportStatus}
          </p>
        ) : null}
      </footer>
    </div>
  )
}
