'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrandSeal } from '@/components/markit-v5/brand-seal'
import { DivineOrb } from '@/components/markit-v5/divine-orb'
import type { MarkitEditPlanV1 } from '@/lib/markit-edit-plan'
import { MARKIT_OUTPUT_FORMATS, planNeedsSecondarySource } from '@/lib/markit-edit-plan'
import { applyEditorDivineAction, makeDivineApplierContext } from '@/lib/markit-v5/divine-action-applier'
import { useEditorShellStore } from '@/lib/stores/editor-shell-store'
import type { TimelineSegment } from '@/lib/timeline-project'
import { resizeSegmentEdge, splitSegmentAtSec, rectForAspect, patchSegment } from '@/lib/timeline-project'

export type InspectorTab = 'clip' | 'crop' | 'trim' | 'export' | 'trace'

type LibraryItem = {
  id: string
  name: string
  kind: 'video' | 'audio' | 'image'
  src: string
  importedAt: string
}

type TrackKind = 'video' | 'audio' | 'overlay'

type TimelineTrack = {
  id: 'v2' | 'v1' | 'a1' | 'ov'
  kind: TrackKind
  label: string
  height: number
  visible: boolean
  locked: boolean
  muted: boolean
  proOnly?: boolean
}

type TimelineClip = {
  id: string
  trackId: TimelineTrack['id']
  mediaId: string
  start: number
  in: number
  out: number
  volume: number
  opacity: number
  speed: number
  fadeInMs: number
  fadeOutMs: number
  source: 'primary' | 'secondary'
  label?: string
}

type TimelineModel = {
  id: string
  duration: number
  tracks: TimelineTrack[]
  clips: TimelineClip[]
  pxPerSecond: number
}

export type MarkitEditorV2Props = {
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
  /** Premium Divine add-on: show Realtime voice; otherwise hide the Divine FAB. */
  divineVoicePremium: boolean
  markitVoice: {
    status: 'idle' | 'connecting' | 'connected' | 'error'
    error: string | null
    start: () => void
    end: () => void
    closingPending: boolean
  }
  /** When true with Premium, allow legacy keyword `/api/divine/voice-edit` path (incidents). */
  keywordVoiceIncident: boolean
  /** Optional Divine suggestion awaiting user approval (ghost navigation). */
  pendingDivineAction: import('@/lib/markit-v5/divine-editor-actions').EditorDivineUiAction | null
  onDivineResolved: () => void
  timelineManifest: { revision: number; segmentChecksum: string }
  cropRect: { x: number; y: number; width: number; height: number }
  onCropRectChange: (next: { x: number; y: number; width: number; height: number }) => void
  ariadneBlock: ReactNode
  previewUrl: string | null
  onClearPreview: () => void
}

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function IconSearch() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" strokeLinecap="round" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  )
}

function IconMic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3M8 21h8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconFilm() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1" />
      <path d="M7 5v14M17 5v14M3 10h4M3 14h4M17 10h4M17 14h4" strokeWidth="1" />
    </svg>
  )
}

const TRACK_DEFS: TimelineTrack[] = [
  { id: 'v2', kind: 'video', label: 'V2', height: 32, visible: true, locked: false, muted: false, proOnly: true },
  { id: 'v1', kind: 'video', label: 'V1', height: 32, visible: true, locked: false, muted: false },
  { id: 'a1', kind: 'audio', label: 'A1', height: 32, visible: true, locked: false, muted: false },
  { id: 'ov', kind: 'overlay', label: 'OV', height: 32, visible: true, locked: false, muted: false, proOnly: true },
]

function toTimelineClip(seg: TimelineSegment): TimelineClip {
  return {
    id: seg.id,
    trackId: 'v1',
    mediaId: 'vault-primary',
    start: seg.startSec,
    in: seg.startSec,
    out: seg.endSec,
    volume: 1,
    opacity: 1,
    speed: (seg.speedPct ?? 100) / 100,
    fadeInMs: seg.fadeInMs ?? 0,
    fadeOutMs: seg.fadeOutMs ?? 0,
    source: seg.source === 'secondary' ? 'secondary' : 'primary',
    label: seg.label,
  }
}

function clipToSegment(clip: TimelineClip): TimelineSegment {
  const span = Math.max(0.05, clip.out - clip.in)
  return {
    id: clip.id,
    startSec: Math.max(0, clip.start),
    endSec: Math.max(clip.start + 0.05, clip.start + span),
    source: clip.source,
    label: clip.label,
  }
}

export function MarkitEditorV2(props: MarkitEditorV2Props) {
  const {
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
    divineVoicePremium,
    markitVoice,
    keywordVoiceIncident,
    pendingDivineAction,
    onDivineResolved,
    timelineManifest,
    cropRect,
    onCropRectChange,
    ariadneBlock,
    previewUrl,
    onClearPreview,
  } = props

  const density = useEditorShellStore((s) => s.density)
  const setDensity = useEditorShellStore((s) => s.setDensity)
  const mediaContext = useEditorShellStore((s) => s.mediaContext)
  const setMediaContext = useEditorShellStore((s) => s.setMediaContext)
  const exportFormat = useEditorShellStore((s) => s.exportFormat)
  const setExportFormat = useEditorShellStore((s) => s.setExportFormat)
  const seekRequest = useEditorShellStore((s) => s.seekRequest)
  const setPlayheadStore = useEditorShellStore((s) => s.setPlayheadSec)

  const [tab, setTab] = useState<InspectorTab>('clip')
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set())
  const [libraryQuery, setLibraryQuery] = useState('')
  const [libraryKind, setLibraryKind] = useState<'all' | 'video' | 'audio' | 'image'>('all')
  const [libraryImports, setLibraryImports] = useState<LibraryItem[]>([])
  const [auxClips, setAuxClips] = useState<TimelineClip[]>([])
  const [divineOpen, setDivineOpen] = useState(false)
  const [micHolding, setMicHolding] = useState(false)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    document.documentElement.dataset.density = density
  }, [density])

  useEffect(() => {
    document.documentElement.dataset.mediaContext = mediaContext
  }, [mediaContext])

  useEffect(() => {
    if (!seekRequest) return
    const v = videoRef.current
    if (!v) return
    v.currentTime = seekRequest.sec
    setCurrentTime(seekRequest.sec)
  }, [seekRequest])

  const library = useMemo(() => {
    const items = [...libraryImports]
    if (importUrl) {
      items.unshift({
        id: 'vault-primary',
        name: 'Vault source',
        kind: 'video',
        src: importUrl,
        importedAt: new Date().toISOString(),
      })
    }
    return items
  }, [importUrl, libraryImports])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setDivineOpen((v) => !v)
      }
      if (e.key === 'Escape') setDivineOpen(false)
      if (divineOpen && e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setMicHolding(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (divineOpen && e.code === 'Space') {
        e.preventDefault()
        setMicHolding(false)
        const transcript = voiceTranscript.trim()
        if (transcript) onQuickAssist(transcript)
        else if (keywordVoiceIncident) void onVoiceRun()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [divineOpen, keywordVoiceIncident, onQuickAssist, onVoiceRun, voiceTranscript])

  const filteredLibrary = useMemo(
    () =>
      library.filter((x) => {
        if (libraryKind !== 'all' && x.kind !== libraryKind) return false
        if (!libraryQuery.trim()) return true
        return x.name.toLowerCase().includes(libraryQuery.trim().toLowerCase())
      }),
    [library, libraryKind, libraryQuery],
  )

  const videoSrc = previewUrl || importUrl

  const timeline = useMemo<TimelineModel>(() => {
    const v1Clips = timelineSegments.map(toTimelineClip)
    const allClips = [...auxClips, ...v1Clips]
    const rightMost = allClips.reduce((max, clip) => Math.max(max, clip.start + Math.max(0.05, clip.out - clip.in)), 0)
    return {
      id: 'main',
      duration: Math.max(duration || 0, rightMost || 0),
      tracks: TRACK_DEFS,
      clips: allClips,
      pxPerSecond: 40,
    }
  }, [auxClips, duration, timelineSegments])

  const selectedClip = timeline.clips.find((x) => x.id === selectedClipId) || null
  const v1SelectedClip = selectedClip && selectedClip.trackId === 'v1' ? selectedClip : null

  const setV1Clips = useCallback(
    (clips: TimelineClip[]) => {
      onTimelineSegmentsChange(
        clips
          .filter((clip) => clip.trackId === 'v1')
          .sort((a, b) => a.start - b.start)
          .map(clipToSegment),
      )
    },
    [onTimelineSegmentsChange],
  )

  const upsertClip = useCallback(
    (nextClip: TimelineClip) => {
      if (nextClip.trackId === 'v1') {
        const currentV1 = timeline.clips.filter((clip) => clip.trackId === 'v1' && clip.id !== nextClip.id)
        setV1Clips([...currentV1, nextClip])
      } else {
        setAuxClips((prev) => {
          const without = prev.filter((clip) => clip.id !== nextClip.id)
          return [...without, nextClip]
        })
      }
    },
    [setV1Clips, timeline.clips],
  )

  const exportDisabled =
    !canExport ||
    exportBusy ||
    timeline.clips.filter((clip) => clip.trackId === 'v1').length === 0 ||
    timeline.clips.some((clip) => clip.source === 'secondary') && !hasSecondaryImport

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => {})
    else v.pause()
  }, [])

  const rulerMarks = useMemo(() => {
    if (duration <= 0) return []
    const n = 5
    return Array.from({ length: n }, (_, i) => ({
      left: (i / (n - 1)) * 100,
      label: fmt((duration * i) / (n - 1)),
    }))
  }, [duration])

  const playheadLeft = duration > 0 ? (currentTime / duration) * 100 : 0

  useEffect(() => {
    if (!importUrl) return
    if (timelineSegments.length > 0) return
    const span = Math.max(0.5, Math.min(5, duration || 5))
    onTimelineSegmentsChange([
      {
        id: crypto.randomUUID(),
        startSec: 0,
        endSec: span,
        source: 'primary',
        label: 'Vault source',
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importUrl, timelineSegments.length])

  const toggleMediaSelection = (itemId: string, additive: boolean) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(additive ? prev : [])
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const commitDropToTrack = (trackId: TimelineTrack['id']) => {
    const selected = selectedMediaIds.size ? Array.from(selectedMediaIds) : ['vault-primary']
    if (!selected.length) return
    const created = selected.map((mediaId, idx) => {
      const start = Math.max(0, currentTime + idx * 0.2)
      const span = Math.max(0.5, Math.min(5, timeline.duration || 5))
      return {
        id: crypto.randomUUID(),
        trackId,
        mediaId,
        start,
        in: start,
        out: start + span,
        volume: 1,
        opacity: 1,
        speed: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        source: 'primary' as const,
        label: `Clip ${timeline.clips.length + idx + 1}`,
      }
    })
    created.forEach((clip) => upsertClip(clip))
  }

  return (
    <div
      className="markit-shell grid h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]"
      style={{
        gridTemplateRows: pendingDivineAction
          ? '52px minmax(0, auto) 1fr 28px'
          : '52px 1fr 28px',
      }}
    >
      <header className="mk-header">
        <div className="mk-h-left">
          <Link href="/" className="text-muted-foreground hover:text-foreground mr-2 text-[11px] no-underline">
            Home
          </Link>
          <div className="mk-brand flex items-center gap-2">
            <BrandSeal size={24} />
            <span>
              Markit<span className="mk-sep">·</span>Editor<span className="mk-beta">Beta</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="mk-mode-pill">
            <button type="button" className={density === 'simple' ? 'mk-active' : ''} onClick={() => setDensity('simple')}>
              Simple
            </button>
            <button type="button" className={density === 'pro' ? 'mk-active' : ''} onClick={() => setDensity('pro')}>
              Pro
            </button>
          </div>
          <div className="mk-mode-pill">
            <button
              type="button"
              className={mediaContext === 'video' ? 'mk-active' : ''}
              onClick={() => setMediaContext('video')}
            >
              Video
            </button>
            <button
              type="button"
              className={mediaContext === 'image' ? 'mk-active' : ''}
              onClick={() => setMediaContext('image')}
            >
              Image
            </button>
          </div>
        </div>
        <div className="mk-h-right">
          <a href={`${creatixUrl}/dashboard/ai-studio`} className="mk-btn">
            Vault
          </a>
          {sessionUserId ? (
            <button type="button" className="mk-btn mk-btn-ghost" onClick={() => void onSignOut()}>
              Sign out
            </button>
          ) : (
            <Link href="/auth/sign-in?next=/editor" className="mk-btn mk-btn-ghost">
              Sign in
            </Link>
          )}
        </div>
      </header>

      {pendingDivineAction ? (
        <div
          className="flex min-h-0 items-center justify-between gap-2 border-b px-3 py-2"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <span className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <DivineOrb size="sm" />
            Divine suggestion: <span className="font-mono-ui text-[var(--foreground)]">{pendingDivineAction.type}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="mk-btn mk-btn-primary"
              onClick={() => {
                if (pendingDivineAction) {
                  applyEditorDivineAction(
                    null,
                    pendingDivineAction,
                    makeDivineApplierContext((t) => setTab(t)),
                  )
                }
                onDivineResolved()
              }}
            >
              Apply
            </button>
            <button type="button" className="mk-btn" onClick={onDivineResolved}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 min-w-0 overflow-hidden max-[920px]:grid-cols-[200px_minmax(0,1fr)] min-[921px]:max-[1179px]:grid-cols-[220px_minmax(0,1fr)_290px] min-[1180px]:grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="mk-library">
            <div className="mk-lib-head">
              <h2>
                Media <em>library</em>
              </h2>
              <p className="mk-lib-count">{filteredLibrary.length} items</p>
            </div>
            <div className="mk-lib-search">
              <span className="text-[var(--muted-foreground)]">
                <IconSearch />
              </span>
              <input value={libraryQuery} onChange={(e) => setLibraryQuery(e.target.value)} placeholder="Search…" aria-label="Search library" />
            </div>
            <div className="mk-lib-tabs">
              {(['all', 'video', 'audio', 'image'] as const).map((kind) => (
                <button key={kind} type="button" className={`mk-lib-tab ${libraryKind === kind ? 'mk-active' : ''}`} onClick={() => setLibraryKind(kind)}>
                  {kind}
                </button>
              ))}
            </div>
            <div className="mk-lib-list studio-scrollbar">
              {filteredLibrary.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  onClick={(e) => toggleMediaSelection(item.id, e.metaKey || e.ctrlKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleMediaSelection(item.id, e.metaKey || e.ctrlKey)
                    }
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/media-id', item.id)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  className={`mk-media ${selectedMediaIds.has(item.id) ? 'mk-selected' : ''}`}
                >
                  <div className="mk-thumb" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium">{item.name}</p>
                    <p className="font-mono-ui mt-0.5 text-[9px] uppercase tracking-[0.06em] text-[var(--muted-foreground)]">{item.kind}</p>
                  </div>
                </div>
              ))}
              {filteredLibrary.length === 0 ? <p className="px-2 text-xs text-[var(--muted-foreground)]">No media yet.</p> : null}
            </div>
            <div className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
              <label className="mk-btn block w-full cursor-pointer text-center">
                Import media
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const url = URL.createObjectURL(f)
                    setLibraryImports((prev) => [
                      { id: crypto.randomUUID(), name: f.name, kind: 'video', src: url, importedAt: new Date().toISOString() },
                      ...prev,
                    ])
                    onReplaceFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </aside>

          <div className="mk-stage min-h-0 border-x" style={{ borderColor: 'var(--border)' }}>
            <div className="mk-toolbar">
              <button type="button" className="mk-btn" onClick={onSendSourceToVault} disabled={!canExport || exportBusy}>
                Upload source
              </button>
              <button type="button" className="mk-btn mk-btn-primary" onClick={onExportTimeline} disabled={exportDisabled}>
                Export
              </button>
              <button type="button" className="pro-only mk-btn">
                Snap
              </button>
              <button type="button" className="pro-only mk-btn">
                Split
              </button>
              <span className="mk-spacer" />
              <span className="pro-only mk-toolbar-meta">
                rev {timelineManifest.revision} · {timelineManifest.segmentChecksum.slice(0, 8)}
              </span>
            </div>

            <div className="mk-preview-wrap">
              <div className="mk-preview">
                {!videoSrc ? (
                  <div className="mk-preview-empty px-6 text-center">
                    <div className="mk-sigil">
                      <IconFilm />
                    </div>
                    <p className="mk-label">No source loaded</p>
                    <p className="mk-hint">Open from vault or import</p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      key={previewUrl || importUrl}
                      src={videoSrc}
                      controls
                      playsInline
                      className="bg-black"
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration
                        if (Number.isFinite(d)) {
                          setDuration(d)
                          if (!previewUrl) onVideoDuration(d)
                        }
                      }}
                      onTimeUpdate={(e) => {
                        const t = e.currentTarget.currentTime
                        setCurrentTime(t)
                        setPlayheadStore(t)
                      }}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onEnded={() => setPlaying(false)}
                    />
                    {previewUrl ? (
                      <button
                        type="button"
                        onClick={onClearPreview}
                        className="mk-btn absolute right-3 top-3 bg-black/50 text-xs backdrop-blur-sm"
                      >
                        Back to source
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="mk-transport">
              <div className="flex gap-1">
                <button type="button" className={`mk-tp-btn mk-play ${!videoSrc ? 'opacity-40' : ''}`} disabled={!videoSrc} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? <IconPause /> : <IconPlay />}
                </button>
              </div>
              <div className="mk-tp-time">
                <span>{fmt(currentTime)}</span>
                <span className="mk-sep">/</span>
                <span className="mk-total">{fmt(duration)}</span>
              </div>
              <span className="simple-only font-mono-ui text-[9px] uppercase tracking-[0.18em] text-[var(--muted-faint)]">
                {timeline.clips.length} clips
              </span>
              <span className="pro-only font-mono-ui text-[9px] uppercase tracking-[0.18em] text-[var(--muted-faint)]">
                fps — · {timeline.clips.length} clips
              </span>
            </div>

            <div className="mk-timeline-zone studio-scrollbar">
              <div className="mk-tl-head">
                <h3>Timeline</h3>
              </div>
              <div className="mk-tl-ruler">
                {rulerMarks.map((m) => (
                  <span key={m.label} className="absolute top-0.5" style={{ left: `${m.left}%` }}>
                    {m.label}
                  </span>
                ))}
              </div>
              {timeline.tracks
                .filter((track) => {
                  if (mediaContext === 'image') {
                    return track.id === 'v1' || track.id === 'a1'
                  }
                  return true
                })
                .map((track) => {
                const visible = !track.proOnly || density === 'pro'
                if (!visible) return null
                const swatch = track.kind === 'video' ? 'v' : track.kind === 'audio' ? 'a' : 'o'
                const trackClips = timeline.clips.filter((clip) => clip.trackId === track.id)
                return (
                  <div key={track.id} className="mk-track">
                    <div className="mk-track-label">
                      <span className={`mk-swatch ${swatch}`} />
                      {track.label}
                    </div>
                    <div
                      className="mk-track-lane"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const mediaId = e.dataTransfer.getData('text/media-id')
                        if (mediaId) {
                          setSelectedMediaIds(new Set([mediaId]))
                        }
                        commitDropToTrack(track.id)
                      }}
                    >
                      {trackClips.length
                        ? trackClips.map((clip) => {
                            const rightMost = Math.max(timeline.duration, 0.1)
                            const left = (clip.start / rightMost) * 100
                            const width = ((clip.out - clip.in) / rightMost) * 100
                            const kindClass =
                              track.kind === 'video' ? 'video' : track.kind === 'audio' ? 'audio' : 'overlay'
                            return (
                              <button
                                key={clip.id}
                                type="button"
                                onClick={() => setSelectedClipId(clip.id)}
                                className={`mk-clip ${kindClass} ${clip.id === selectedClipId ? 'mk-selected' : ''}`}
                                style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                              >
                                <span className="truncate">{clip.label || 'clip'}</span>
                              </button>
                            )
                          })
                        : null}
                      {track.id === 'a1' && trackClips.length === 0 ? (
                        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono-ui text-[9px] uppercase tracking-widest text-[var(--muted-faint)]">
                          audio lane
                        </span>
                      ) : null}
                      {track.id !== 'v1' && track.id !== 'a1' && trackClips.length === 0 ? (
                        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono-ui text-[9px] uppercase tracking-widest text-[var(--muted-faint)]">
                          drop zone
                        </span>
                      ) : null}
                      {timeline.duration > 0 && track.id === 'v1' ? (
                        <div className="mk-playhead" style={{ left: `${playheadLeft}%` }} />
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {exportStatus ? <p className="text-xs text-[var(--muted-foreground)]">{exportStatus}</p> : null}
            </div>
          </div>

          <aside className="mk-inspector hidden min-[921px]:flex">
            <div className="mk-tabs">
              {(
                [
                  ['clip', 'Clip'],
                  ['crop', 'Crop'],
                  ['trim', 'Trim'],
                  ['export', 'Export'],
                  ['trace', 'Trace'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={`mk-tab ${tab === id ? 'mk-active' : ''}`} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mk-panels studio-scrollbar">
              {tab === 'clip' ? (
                <div className="mk-section">
                  <h4>
                    Selected <em>clip</em>
                  </h4>
                  <p className="mk-desc">Trim in/out and source angle for this segment on V1.</p>
                  {!selectedClip ? <p className="text-sm text-[var(--muted-foreground)]">Select a clip on V1.</p> : null}
                  {selectedClip ? (
                    <div className="space-y-3 text-sm">
                      <label className="block">
                        <span className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">In</span>
                        <input
                          type="number"
                          step={0.1}
                          value={Number(selectedClip.start.toFixed(2))}
                          onChange={(e) =>
                            upsertClip({ ...selectedClip, start: Number(e.target.value), in: Number(e.target.value) })
                          }
                          className="mt-1 w-full rounded-md border bg-[var(--card-2)] px-3 py-2 font-mono-ui text-xs outline-none transition-colors focus:border-[var(--primary)]"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </label>
                      <label className="block">
                        <span className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Out</span>
                        <input
                          type="number"
                          step={0.1}
                          value={Number((selectedClip.start + (selectedClip.out - selectedClip.in)).toFixed(2))}
                          onChange={(e) =>
                            upsertClip({
                              ...selectedClip,
                              out: Math.max(selectedClip.in + 0.05, Number(e.target.value)),
                            })
                          }
                          className="mt-1 w-full rounded-md border bg-[var(--card-2)] px-3 py-2 font-mono-ui text-xs outline-none transition-colors focus:border-[var(--primary)]"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </label>
                      <label className="block">
                        <span className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Source</span>
                        <select
                          value={selectedClip.source}
                          onChange={(e) =>
                            upsertClip({
                              ...selectedClip,
                              source: e.target.value === 'secondary' ? 'secondary' : 'primary',
                            })
                          }
                          className="mt-1 w-full rounded-md border bg-[var(--card-2)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)]"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <option value="primary">A cam</option>
                          <option value="secondary" disabled={!hasSecondaryImport}>
                            B cam
                          </option>
                        </select>
                      </label>
                      {v1SelectedClip ? <div className="pro-only space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-soft)' }}>
                        <p className="font-mono-ui text-[9px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Speed / fade</p>
                        <label className="block"><span className="text-[10px]">{Math.round(v1SelectedClip.speed * 100)}%</span><input type="range" min={25} max={400} step={1} value={Math.round(v1SelectedClip.speed * 100)} onChange={(e) => onTimelineSegmentsChange(patchSegment(timelineSegments, v1SelectedClip.id, { speedPct: Number(e.target.value) }))} /></label>
                        <label className="block"><span className="text-[10px]">{v1SelectedClip.fadeInMs}ms</span><input type="range" min={0} max={5000} step={50} value={v1SelectedClip.fadeInMs} onChange={(e) => onTimelineSegmentsChange(patchSegment(timelineSegments, v1SelectedClip.id, { fadeInMs: Number(e.target.value) }))} /></label>
                        <label className="block"><span className="text-[10px]">{v1SelectedClip.fadeOutMs}ms</span><input type="range" min={0} max={5000} step={50} value={v1SelectedClip.fadeOutMs} onChange={(e) => onTimelineSegmentsChange(patchSegment(timelineSegments, v1SelectedClip.id, { fadeOutMs: Number(e.target.value) }))} /></label>
                      </div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'crop' ? (
                <div className="mk-section">
                  <h4>
                    Crop <em>· export</em>
                  </h4>
                  <p className="mk-desc">Normalized rectangle applied on export.</p>
                  <div className="simple-only mb-3 flex flex-wrap gap-1">
                    {(['9:16', '1:1', '4:5'] as const).map((r) => {
                      const isActive = JSON.stringify(cropRect) === JSON.stringify(rectForAspect(r))
                      return <button key={r} type="button" className="rounded-full border px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wide" style={{ borderColor: isActive ? 'var(--primary)' : 'var(--border)', color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }} onClick={() => onCropRectChange(rectForAspect(r))}>{r}</button>
                    })}
                    <button type="button" className="rounded-full border px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wide" style={{ borderColor: cropRect.x === 0 && cropRect.y === 0 && cropRect.width === 1 && cropRect.height === 1 ? 'var(--primary)' : 'var(--border)', color: cropRect.x === 0 && cropRect.y === 0 && cropRect.width === 1 && cropRect.height === 1 ? 'var(--foreground)' : 'var(--muted-foreground)' }} onClick={() => onCropRectChange(rectForAspect('original'))}>Original</button>
                  </div>
                  <div className="pro-only mb-3 flex flex-wrap gap-1">
                    {(['9:16', '1:1', '4:5', '16:9', '3:4'] as const).map((r) => {
                      const isActive = JSON.stringify(cropRect) === JSON.stringify(rectForAspect(r))
                      return <button key={r} type="button" className="rounded-full border px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wide" style={{ borderColor: isActive ? 'var(--primary)' : 'var(--border)', color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)' }} onClick={() => onCropRectChange(rectForAspect(r))}>{r}</button>
                    })}
                    <button type="button" className="rounded-full border px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wide" style={{ borderColor: cropRect.x === 0 && cropRect.y === 0 && cropRect.width === 1 && cropRect.height === 1 ? 'var(--primary)' : 'var(--border)', color: cropRect.x === 0 && cropRect.y === 0 && cropRect.width === 1 && cropRect.height === 1 ? 'var(--foreground)' : 'var(--muted-foreground)' }} onClick={() => onCropRectChange(rectForAspect('original'))}>Original</button>
                  </div>
                  {(
                    [
                      ['X', 'x', 0, 1 - cropRect.width, 0.01],
                      ['Y', 'y', 0, 1 - cropRect.height, 0.01],
                      ['W', 'width', 0.1, 1 - cropRect.x, 0.01],
                      ['H', 'height', 0.1, 1 - cropRect.y, 0.01],
                    ] as const
                  ).map(([label, key, min, max, step]) => (
                    <label key={label} className="mb-3 block">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono-ui text-[10px] tracking-wide text-[var(--muted-foreground)]">{label}</span>
                        <span className="font-mono-ui text-[10px] text-[var(--foreground)]">{Math.round(cropRect[key] * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={cropRect[key]}
                        onChange={(e) => onCropRectChange({ ...cropRect, [key]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {tab === 'trim' ? (
                <div className="mk-section">
                  <h4>
                    Trim <em>in browser</em>
                  </h4>
                  <p className="mk-desc">ffmpeg.wasm trim flow (unchanged).</p>
                  {trimPanel}
                </div>
              ) : null}

              {tab === 'export' ? (
                <div className="mk-section">
                  <h4>
                    Export <em>format</em>
                  </h4>
                  <p className="mk-desc">Maps to EditPlan `output` and encoder lineage (Ariadne embed keeps metadata small).</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {MARKIT_OUTPUT_FORMATS.map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        className={`rounded-full border px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-wide ${
                          exportFormat === fmt
                            ? 'border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--foreground)]'
                            : 'text-[var(--muted-foreground)]'
                        }`}
                        style={{ borderColor: exportFormat === fmt ? 'var(--primary)' : 'var(--border)' }}
                        onClick={() => setExportFormat(fmt)}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-3 text-[10px] leading-relaxed">
                    Final pixel pipeline may use Markit <code className="font-mono-ui">/api/render</code> when enabled; vault
                    export remains the primary path for traced files.
                  </p>
                </div>
              ) : null}

              {tab === 'trace' ? (
                <div className="mk-section">
                  <h4>
                    Ariadne <em>trace</em>
                  </h4>
                  <p className="mk-desc">Embed after vault export.</p>
                  {ariadneBlock}
                </div>
              ) : null}
            </div>
          </aside>
      </div>

      <footer className="mk-statusbar">
        <div className="mk-sb-group">
          <span>
            <span className={`mk-sb-dot ${hasVaultSource ? 'gold' : ''}`} />
            {hasVaultSource ? 'Vault' : 'Local'}
          </span>
          <span>
            {density === 'pro' ? 'V2 V1 A1 OV' : 'V1 A1'}
          </span>
        </div>
        <div className="mk-sb-group">
          <span className="simple-only">
            <span className="mk-sb-dot green" />
            Divine
          </span>
          <span className="pro-only font-mono-ui">build {timelineManifest.segmentChecksum.slice(0, 6)}</span>
        </div>
      </footer>

      {divineVoicePremium ? (
        <button
          type="button"
          className="divine-fab"
          onClick={() => setDivineOpen((v) => !v)}
          aria-label="Open Divine voice"
          aria-expanded={divineOpen}
        >
          <IconMic />
        </button>
      ) : null}

      {divineVoicePremium && divineOpen ? (
        <div className="divine-popper" role="dialog" aria-label="Divine Manager">
          <div className="dp-head">
            <div className="dp-title">
              <div className="dp-orb-mini" aria-hidden />
              <div>
                <h5>
                  The Divine <em>Manager</em>
                </h5>
                <small>Assist · presets · voice</small>
              </div>
            </div>
            <button type="button" className="dp-close" onClick={() => setDivineOpen(false)} aria-label="Close">
              <IconClose />
            </button>
          </div>
          <div className="dp-body">
            <div className="dp-prompt">
              <span className="dp-who">Last intent</span>
              Simple first — ship the clip. Pro opens the hood.
            </div>
            <div className="dp-presets">
              {presets.slice(0, 4).map((p) => (
                <button key={p.id} type="button" className="dp-preset" onClick={() => onQuickAssist(`Preset "${p.label}": ${p.description}`)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className={`dp-mic ${micHolding ? 'live' : ''}`} role="presentation">
              <div className="mic-orb" aria-hidden>
                <IconMic />
              </div>
              <span className="label">
                {micHolding
                  ? 'Listening…'
                  : keywordVoiceIncident
                    ? 'Hold Space while open, or use live voice / type below'
                    : 'Live voice (same as dashboard) — uses your mic'}
              </span>
              <div className="wave-mini" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} />
                ))}
              </div>
            </div>
            <div className="mt-3 space-y-2 rounded-md border p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
              <p className="font-medium text-[var(--foreground)]">Divine voice (Premium)</p>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                Same OpenAI Realtime session as the main app. Includes Markit context (timeline, import).
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="mk-btn mk-btn-primary"
                  disabled={markitVoice.status === 'connecting' || markitVoice.status === 'connected'}
                  onClick={() => markitVoice.start()}
                >
                  {markitVoice.status === 'connecting'
                    ? 'Connecting…'
                    : markitVoice.status === 'connected'
                      ? 'Live'
                      : 'Start live voice'}
                </button>
                <button
                  type="button"
                  className="mk-btn"
                  disabled={markitVoice.status !== 'connected' && markitVoice.status !== 'error'}
                  onClick={() => markitVoice.end()}
                >
                  End
                </button>
              </div>
              {markitVoice.error ? (
                <p className="text-[10px] text-[var(--destructive)]">{markitVoice.error}</p>
              ) : null}
              {markitVoice.closingPending ? (
                <p className="text-[10px] text-[var(--muted-foreground)]">Ending after assistant speaks…</p>
              ) : null}
            </div>
            {keywordVoiceIncident ? (
              <div className="mt-3 flex gap-2">
                <input
                  value={voiceTranscript}
                  onChange={(e) => onVoiceTranscriptChange(e.target.value)}
                  placeholder="Incident: keyword intent (legacy)…"
                  className="min-w-0 flex-1 rounded-md border bg-[var(--card-2)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)]"
                  style={{ borderColor: 'var(--border)' }}
                />
                <button
                  type="button"
                  className="mk-btn mk-btn-primary shrink-0"
                  onClick={() => {
                    const transcript = voiceTranscript.trim()
                    if (transcript) onQuickAssist(transcript)
                    else void onVoiceRun()
                  }}
                  disabled={aiBusy || voiceBusy || !voiceTranscript.trim()}
                >
                  {aiBusy || voiceBusy ? '…' : 'Run'}
                </button>
              </div>
            ) : null}
            {voiceStatus && keywordVoiceIncident ? (
              <p className="mt-2 font-mono-ui text-[10px] text-[var(--muted-foreground)]">{voiceStatus}</p>
            ) : null}
            <div className="mt-3 max-h-28 overflow-y-auto rounded-md border p-2 text-[11px]" style={{ borderColor: 'var(--border)' }}>
              {chatMessages.length === 0 ? <p className="text-[var(--muted-foreground)]">No messages yet.</p> : null}
              {chatMessages.slice(-4).map((m) => (
                <p key={m.id} className="mb-1 whitespace-pre-wrap">
                  <span className="font-mono-ui text-[9px] uppercase tracking-widest text-[var(--muted-foreground)]">{m.role}:</span> {m.text}
                </p>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                onChatSubmit()
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                disabled={!canUseAi || aiBusy}
                placeholder={canUseAi ? 'Ask for a markit-edit plan' : 'Sign in or open from vault'}
                className="min-w-0 flex-1 rounded-md border bg-[var(--card-2)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)]"
                style={{ borderColor: 'var(--border)' }}
              />
              <button type="submit" className="mk-btn shrink-0" disabled={!canUseAi || aiBusy || !chatInput.trim()}>
                Send
              </button>
            </form>
            {pendingEditPlan ? (
              <div className="mt-3 rounded-md border p-3 text-xs" style={{ borderColor: 'var(--border)' }}>
                <p className="font-medium">AI plan ready ({pendingEditPlan.segments.length} clips)</p>
                {planNeedsSecondarySource(pendingEditPlan) && !hasSecondaryImport ? (
                  <p className="mt-1 text-[var(--destructive)]">Plan needs importUrl2.</p>
                ) : null}
                <button
                  type="button"
                  className="mk-btn mk-btn-primary mt-2 w-full"
                  onClick={onApplyAiEditPlan}
                  disabled={!canExport || exportBusy || (planNeedsSecondarySource(pendingEditPlan) && !hasSecondaryImport)}
                >
                  Apply AI plan and upload
                </button>
              </div>
            ) : null}
            {aiError ? <p className="mt-2 text-[11px] text-[var(--destructive)]">{aiError}</p> : null}
          </div>
          <div className="dp-foot">
            <span>
              <kbd>Cmd</kbd>+<kbd>K</kbd> toggle
            </span>
            <span>
              <kbd>Space</kbd> hold
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
