'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MarkitEditPlanV1 } from '@/lib/markit-edit-plan'
import { planNeedsSecondarySource } from '@/lib/markit-edit-plan'
import type { TimelineSegment } from '@/lib/timeline-project'
import { TimelineClipsStrip } from '@/components/studio/timeline-clips-strip'

export type MarkitEditorViewProps = {
  creatixUrl: string
  importUrl: string
  hasVaultSource: boolean
  sessionUserId: string | null
  onSignOut: () => void
  exportBusy: boolean
  canExport: boolean
  onSendSourceToVault: () => void
  onReplaceFile: (file: File) => void
  exportStatus: string | null
  trimPanel: ReactNode
  chatMessages: { id: string; role: 'user' | 'assistant'; text: string }[]
  chatInput: string
  onChatInputChange: (v: string) => void
  onChatSubmit: () => void
  canUseAi: boolean
  aiBusy: boolean
  aiError: string | null
  presets: { id: string; label: string; description: string }[]
  onQuickAssist: (hint: string) => void
  pendingEditPlan: MarkitEditPlanV1 | null
  onApplyAiEditPlan: () => void
  hasSecondaryImport: boolean
  timelineSegments: TimelineSegment[]
  onTimelineSegmentsChange: (segments: TimelineSegment[]) => void
  onExportTimeline: () => void
  onVideoDuration: (sec: number) => void
  voiceTranscript: string
  onVoiceTranscriptChange: (v: string) => void
  onVoiceRun: () => void
  voiceBusy: boolean
  voiceStatus: string | null
  timelineManifest: { revision: number; segmentChecksum: string }
  cropRect: { x: number; y: number; width: number; height: number }
  onCropRectChange: (next: { x: number; y: number; width: number; height: number }) => void
  ariadneBlock: ReactNode
  /** Local blob URL of last rendered edit — Play previews this, not the raw import. */
  previewUrl: string | null
  onClearPreview: () => void
  previewBusy: boolean
  canBuildPreview: boolean
  onRunPreset: (presetId: string) => void
  onRunAutoPlan: () => void
  onRunPromptTeaser: () => void
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function CropSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-[var(--muted-foreground)]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        <span className="w-12 text-right text-[11px]">{Math.round(value * 100)}%</span>
      </div>
    </label>
  )
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
  timelineManifest,
  cropRect,
  onCropRectChange,
  ariadneBlock,
  previewUrl,
  onClearPreview,
  previewBusy,
  canBuildPreview,
  onRunPreset,
  onRunAutoPlan,
  onRunPromptTeaser,
}: MarkitEditorViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  const onMeta = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const d = v.duration
    if (!Number.isFinite(d)) return
    setDuration(d)
    // Do not push preview duration to parent — avoids clamping source timeline to output length
    if (!previewUrl) onVideoDuration(d)
  }, [onVideoDuration, previewUrl])

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
  }, [importUrl, previewUrl])

  const seekFromTimeline = useCallback(
    (clientX: number) => {
      const el = timelineRef.current
      const v = videoRef.current
      if (!el || !v || !duration) return
      const rect = el.getBoundingClientRect()
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
      const t = (x / rect.width) * duration
      v.currentTime = t
      setCurrentTime(t)
    },
    [duration],
  )

  const exportDisabled =
    !canExport ||
    exportBusy ||
    previewBusy ||
    timelineSegments.length === 0 ||
    (timelineSegments.some((s) => s.source === 'secondary') && !hasSecondaryImport)

  const videoSrc = previewUrl || importUrl
  const stripSegments =
    previewUrl && duration > 0
      ? [
          {
            id: 'preview-whole',
            startSec: 0,
            endSec: duration,
            source: 'primary' as const,
            label: 'Rendered output',
          },
        ]
      : timelineSegments

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] px-4 py-4 text-[var(--foreground)] md:px-6">
      <header className="mx-auto mb-4 flex w-full max-w-[1500px] items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div>
          <p className="text-lg font-semibold tracking-tight">Markit Editor</p>
          <p className="text-xs text-[var(--muted-foreground)]">Deterministic timeline + AI + Ariadne</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${creatixUrl}/dashboard/ai-studio`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5"
          >
            Vault
          </a>
          {sessionUserId ? (
            <button type="button" onClick={() => void onSignOut()} className="rounded-full px-3 py-1.5 text-xs hover:bg-white/5">
              Sign out
            </button>
          ) : (
            <Link href="/auth/sign-in" className="rounded-full px-3 py-1.5 text-xs text-[var(--studio-accent)] hover:bg-white/5">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5">
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
              Import video
            </label>
            {previewUrl ? (
              <button
                type="button"
                onClick={onClearPreview}
                className="rounded-full border border-amber-400/50 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10"
              >
                Back to source
              </button>
            ) : null}
            <button
              type="button"
              onClick={togglePlay}
              disabled={!videoSrc}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={onSendSourceToVault}
              disabled={!canExport || exportBusy}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40"
            >
              Upload source
            </button>
            <button
              type="button"
              onClick={onExportTimeline}
              disabled={exportDisabled}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-40"
              style={{ background: 'var(--studio-accent)' }}
            >
              Export clip list
            </button>
          </div>

          <div className="relative mb-4 flex min-h-[360px] items-center justify-center rounded-xl border border-[var(--border)] bg-black/40">
            {!importUrl ? (
              <p className="max-w-sm px-4 text-center text-sm text-[var(--muted-foreground)]">
                Open Markit from Media &amp; Vault on Circe et Venus, or import a local video.
              </p>
            ) : (
              <>
                {previewUrl ? (
                  <p className="absolute left-3 top-3 rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] text-amber-100">
                    Playing rendered edit (not raw source)
                  </p>
                ) : null}
                <video
                  ref={videoRef}
                  key={previewUrl || importUrl}
                  src={videoSrc}
                  className="max-h-[62vh] w-full rounded-lg object-contain"
                  playsInline
                  onLoadedMetadata={onMeta}
                  onTimeUpdate={onTick}
                  onClick={togglePlay}
                />
              </>
            )}
          </div>

          <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="font-mono">
              rev {timelineManifest.revision} · {timelineManifest.segmentChecksum.slice(0, 8)}
            </span>
          </div>
          <TimelineClipsStrip
            duration={duration}
            currentTime={currentTime}
            segments={stripSegments}
            onSegmentsChange={onTimelineSegmentsChange}
            videoRef={videoRef}
            hasSecondaryImport={hasSecondaryImport}
            disabled={!canExport || exportBusy || Boolean(previewUrl)}
            onSeek={(sec) => {
              const v = videoRef.current
              if (!v) return
              v.currentTime = sec
              setCurrentTime(sec)
            }}
          />
          <div
            ref={timelineRef}
            className="relative mt-2 h-12 cursor-pointer rounded-md border border-[var(--border)] bg-[var(--timeline-track)]"
            onClick={(e) => seekFromTimeline(e.clientX)}
          >
            {duration > 0 ? (
              <>
                <div className="absolute bottom-1 left-0 top-1 w-full rounded bg-[var(--timeline-clip)] opacity-30" />
                <div
                  className="absolute bottom-0 top-0 w-0.5 bg-[var(--studio-accent)]"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </>
            ) : null}
          </div>
          {exportStatus ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{exportStatus}</p> : null}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Crop (real export)</h2>
            <div className="space-y-2">
              <CropSlider
                label="X"
                value={cropRect.x}
                min={0}
                max={1 - cropRect.width}
                step={0.01}
                onChange={(x) => onCropRectChange({ ...cropRect, x })}
              />
              <CropSlider
                label="Y"
                value={cropRect.y}
                min={0}
                max={1 - cropRect.height}
                step={0.01}
                onChange={(y) => onCropRectChange({ ...cropRect, y })}
              />
              <CropSlider
                label="Width"
                value={cropRect.width}
                min={0.1}
                max={1 - cropRect.x}
                step={0.01}
                onChange={(width) => onCropRectChange({ ...cropRect, width })}
              />
              <CropSlider
                label="Height"
                value={cropRect.height}
                min={0.1}
                max={1 - cropRect.y}
                step={0.01}
                onChange={(height) => onCropRectChange({ ...cropRect, height })}
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
              Crop is applied during export to every timeline segment.
            </p>
            <div className="mt-3">{trimPanel}</div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-2 text-sm font-semibold">AI + Divine voice</h2>
            <p className="mb-1 text-[11px] text-[var(--muted-foreground)]">
              Builds a real cut list, renders in-browser, then press Play to watch the result.
            </p>
            <div className="mb-2 flex flex-wrap gap-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!canBuildPreview || previewBusy || exportBusy}
                  onClick={() => onRunPreset(p.id)}
                  className="rounded-full border border-[var(--border)] px-2 py-1 text-[11px] hover:bg-white/5 disabled:opacity-40"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                disabled={!canBuildPreview || previewBusy || exportBusy}
                onClick={onRunAutoPlan}
                className="rounded-full border border-[var(--border)] px-2 py-1 text-[11px] hover:bg-white/5 disabled:opacity-40"
              >
                Auto plan
              </button>
              <button
                type="button"
                disabled={!canBuildPreview || previewBusy || exportBusy}
                onClick={onRunPromptTeaser}
                className="rounded-full border border-[var(--border)] px-2 py-1 text-[11px] hover:bg-white/5 disabled:opacity-40"
              >
                Prompt teaser
              </button>
            </div>
            <div className="mb-2 flex gap-2">
              <input
                value={voiceTranscript}
                onChange={(e) => onVoiceTranscriptChange(e.target.value)}
                placeholder='Voice intent e.g. "make 3 teasers of 15 seconds"'
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-black/20 px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={onVoiceRun}
                disabled={voiceBusy || !voiceTranscript.trim()}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-40"
                style={{ background: 'var(--studio-accent)' }}
              >
                {voiceBusy ? 'Running…' : 'Run'}
              </button>
            </div>
            {voiceStatus ? <p className="mb-2 text-xs text-[var(--muted-foreground)]">{voiceStatus}</p> : null}
            <div className="max-h-32 overflow-y-auto rounded-lg border border-[var(--border)] p-2 text-xs">
              {chatMessages.length === 0 ? (
                <p className="text-[var(--muted-foreground)]">Ask for edits and apply the returned plan.</p>
              ) : (
                chatMessages.slice(-4).map((m) => (
                  <p key={m.id} className="mb-1 whitespace-pre-wrap">
                    <span className="mr-1 uppercase text-[10px] text-[var(--muted-foreground)]">{m.role}:</span>
                    {m.text}
                  </p>
                ))
              )}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                onChatSubmit()
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                placeholder={canUseAi ? 'Ask for a markit-edit plan' : 'Sign in or open from vault'}
                disabled={!canUseAi || aiBusy}
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-black/20 px-2 py-1.5 text-xs"
              />
              <button
                type="submit"
                disabled={!canUseAi || aiBusy || !chatInput.trim()}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Send
              </button>
            </form>
            {pendingEditPlan ? (
              <div className="mt-2 rounded-lg border border-[var(--border)] p-2 text-xs">
                <p className="font-medium">AI plan ready ({pendingEditPlan.segments.length} clips)</p>
                {planNeedsSecondarySource(pendingEditPlan) && !hasSecondaryImport ? (
                  <p className="mt-1 text-amber-300">Plan needs second source (`importUrl2`).</p>
                ) : null}
                <button
                  type="button"
                  onClick={onApplyAiEditPlan}
                  disabled={!canExport || exportBusy || (planNeedsSecondarySource(pendingEditPlan) && !hasSecondaryImport)}
                  className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-40"
                  style={{ background: 'var(--studio-accent)' }}
                >
                  Apply AI plan and upload
                </button>
              </div>
            ) : null}
            {aiError ? <p className="mt-2 text-xs text-red-300">{aiError}</p> : null}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="mb-2 text-sm font-semibold">Ariadne Trace</h2>
            {ariadneBlock}
            {!hasVaultSource ? (
              <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                Open from{' '}
                <a href={`${creatixUrl}/dashboard/ai-studio`} className="underline">
                  Media &amp; Vault
                </a>{' '}
                to trace exported assets.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
