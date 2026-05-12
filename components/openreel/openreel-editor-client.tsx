'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpFromLine, Check, Loader2 } from 'lucide-react'
import OpenReelApp from '@/vendor/openreel/web/App'
import { useProjectStore } from '@/vendor/openreel/web/stores/project-store'
import { useUIStore } from '@/vendor/openreel/web/stores/ui-store'
import { toast } from '@/vendor/openreel/web/stores/notification-store'
import { getExportEngine, type ExportResult, type VideoExportSettings } from '@openreel/core'
import { OpenReelVoiceOverlay } from '@/components/openreel/openreel-voice-overlay'
import { useDivineQueueStore } from '@/lib/stores/divine-queue-store'
import { runMarkitTraceFlow } from '@/lib/openreel-trace-flow'
import { applyBrandToOpenReelProject, resetBrandState } from '@/lib/openreel-brand-adapter'
import type { BrandSnapshot } from '@/lib/brand-contract'
import { validateBrandSnapshot, defaultBrandSnapshot } from '@/lib/brand-contract'
import type { BatchMediaItem } from '@/app/api/media/batch/route'
import { DivineQueueBanner } from '@/components/studio/divine-queue-banner'
import { applyDivineActionToOpenReel } from '@/lib/openreel-divine-adapter'
import type { LeakAlertView } from '@/lib/leak-alert-contract'
import { leakAlertNeedsAttention } from '@/lib/leak-alert-contract'

type BridgeStatus = 'idle' | 'importing' | 'ready' | 'saving' | 'saved' | 'error'

type BridgeParams = {
  importUrl: string
  exportUrl: string
  exportToken: string
  title: string
}

function readBridgeParams(): BridgeParams | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const importUrl = params.get('importUrl')?.trim() || ''
  const exportUrl = params.get('exportUrl')?.trim() || ''
  const exportToken = params.get('exportToken')?.trim() || ''

  if (!importUrl) return null

  return {
    importUrl,
    exportUrl,
    exportToken,
    title: params.get('title')?.trim() || 'Creatix vault video',
  }
}

function filenameFromResponse(response: Response, fallback: string) {
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].replace(/"$/g, ''))
    } catch {
      return match[1].replace(/"$/g, '')
    }
  }
  return fallback
}

function extensionFromMime(mime: string) {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('quicktime')) return 'mov'
  if (mime.includes('x-m4v')) return 'm4v'
  return 'mp4'
}

async function exportProjectToBlob(settings: Partial<VideoExportSettings>, onProgress: (progress: number, phase: string) => void) {
  const project = useProjectStore.getState().project
  const engine = getExportEngine()
  await engine.initialize()

  let buffer = new Uint8Array(16 * 1024 * 1024)
  let length = 0
  let cursor = 0

  const grow = (needed: number) => {
    if (needed <= buffer.length) return
    let nextSize = buffer.length
    while (nextSize < needed) nextSize *= 2
    const next = new Uint8Array(nextSize)
    next.set(buffer.subarray(0, length))
    buffer = next
  }

  const writeBytes = (bytes: Uint8Array, position: number) => {
    const end = position + bytes.byteLength
    grow(end)
    buffer.set(bytes, position)
    length = Math.max(length, end)
    cursor = end
  }

  const writable = {
    seek(position: number) {
      cursor = position
      return Promise.resolve()
    },
    write(data: unknown) {
      if (data instanceof ArrayBuffer) {
        writeBytes(new Uint8Array(data), cursor)
      } else if (ArrayBuffer.isView(data)) {
        writeBytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), cursor)
      }
      return Promise.resolve()
    },
    close() {
      return Promise.resolve()
    },
    abort() {
      return Promise.resolve()
    },
    truncate() {
      return Promise.resolve()
    },
  } as unknown as FileSystemWritableFileStream

  const generator = engine.exportVideo(project, settings, writable)
  let finalResult: ExportResult | undefined

  while (true) {
    const { value, done } = await generator.next()
    if (done) {
      finalResult = value
      break
    }
    onProgress(value.progress * 100, value.phase === 'complete' ? 'Complete' : value.phase)
  }

  if (!finalResult?.success) {
    throw new Error(finalResult?.error?.message || 'Export failed')
  }

  return new Blob([buffer.slice(0, length)], { type: 'video/mp4' })
}

function CreatixBridge() {
  const bridge = useMemo(() => readBridgeParams(), [])
  const [status, setStatus] = useState<BridgeStatus>(bridge ? 'importing' : 'idle')
  const [message, setMessage] = useState(bridge ? 'Opening from Creatix vault...' : '')
  const [progress, setProgress] = useState(0)
  const [traceRecipient, setTraceRecipient] = useState<string | null>(null)
  const setGlobalExportState = useUIStore((state) => state.setExportState)
  const { queue, confirm } = useDivineQueueStore()

  // Auto-apply set_recipient actions from the divine queue (config, not a timeline edit)
  useEffect(() => {
    for (const item of queue) {
      if (item.action.type === 'set_recipient') {
        setTraceRecipient(item.action.recipientLabel)
        confirm(item.id)
        break
      }
    }
  }, [queue, confirm])

  useEffect(() => {
    if (!bridge) return

    const activeBridge = bridge
    let cancelled = false
    const bridgeKey = `markit:creatix-import:${activeBridge.importUrl}:${activeBridge.exportUrl}`

    async function importVaultAsset() {
      if (sessionStorage.getItem(bridgeKey) === 'done') {
        setStatus('ready')
        setMessage('Connected to Creatix vault')
        return
      }

      try {
        setStatus('importing')
        setMessage('Importing vault media...')
        toast.info('Creatix vault connected', 'Importing your selected video into Markit.')

        const response = await fetch(activeBridge.importUrl, { credentials: 'omit', mode: 'cors' })
        if (!response.ok) {
          throw new Error(`Creatix asset fetch failed (${response.status})`)
        }

        const blob = await response.blob()
        const mime = blob.type || response.headers.get('content-type') || 'video/mp4'
        const fileName = filenameFromResponse(response, `${activeBridge.title}.${extensionFromMime(mime)}`)
        const file = new File([blob], fileName, { type: mime, lastModified: Date.now() })
        const store = useProjectStore.getState()
        const result = await store.importMedia(file)

        if (!result.success || !result.actionId) {
          throw new Error(result.error?.message || 'Import failed')
        }

        await useProjectStore.getState().addClipToNewTrack(result.actionId, 0)
        sessionStorage.setItem(bridgeKey, 'done')

        if (!cancelled) {
          setStatus('ready')
          setMessage('Connected to Creatix vault')
          toast.success('Ready to edit', 'The vault video is on your timeline.')
        }
      } catch (error) {
        if (!cancelled) {
          const text = error instanceof Error ? error.message : 'Could not import vault media'
          setStatus('error')
          setMessage(text)
          toast.error('Creatix import failed', text)
        }
      }
    }

    void importVaultAsset()

    return () => {
      cancelled = true
    }
  }, [bridge])

  if (!bridge) return null

  const canSave = status === 'ready' || status === 'saved' || status === 'error'

  const saveToCreatix = async () => {
    if (!bridge.exportUrl || !bridge.exportToken) {
      toast.error('Vault export unavailable', 'Open Markit from a Creatix vault item to save back.')
      return
    }

    try {
      setStatus('saving')
      setProgress(0)
      setMessage('Rendering for Creatix vault...')
      setGlobalExportState({ isExporting: true, progress: 0, phase: 'Rendering for Creatix...' })

      const project = useProjectStore.getState().project
      const blob = await exportProjectToBlob(
        {
          width: project.settings.width,
          height: project.settings.height,
          frameRate: project.settings.frameRate,
          format: 'mp4',
          codec: 'h264',
          bitrate: 12000,
          quality: 85,
        },
        (nextProgress, phase) => {
          setProgress(nextProgress)
          setGlobalExportState({ isExporting: true, progress: nextProgress, phase })
        },
      )

      // Embed Ariadne trace before vault send if a recipient has been set
      let vaultBlob = blob
      if (traceRecipient) {
        setMessage('Embedding Ariadne trace...')
        const traceResult = await runMarkitTraceFlow(blob, traceRecipient)
        const tracedRes = await fetch(traceResult.downloadUrl)
        vaultBlob = await tracedRes.blob()
      }

      setMessage('Saving to Creatix vault...')
      const formData = new FormData()
      formData.append('exportUrl', bridge.exportUrl)
      formData.append('exportToken', bridge.exportToken)
      formData.append('file', new File([vaultBlob], `${project.name || 'markit-export'}.mp4`, { type: 'video/mp4' }))

      const response = await fetch('/api/export', { method: 'POST', body: formData })
      const json = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(json.error || `Vault save failed (${response.status})`)
      }

      setStatus('saved')
      setProgress(100)
      setMessage('Saved to Creatix vault')
      toast.success('Saved to Creatix', 'Refresh Media & vault to see the updated file.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not save to Creatix'
      setStatus('error')
      setMessage(text)
      toast.error('Creatix save failed', text)
    } finally {
      setGlobalExportState({ isExporting: false, progress: 0, phase: '' })
    }
  }

  return (
    <div className="pointer-events-none fixed right-4 top-[4.75rem] z-[80] flex max-w-[23rem] flex-col items-end gap-2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-xl">
        {status === 'importing' || status === 'saving' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
        ) : status === 'saved' ? (
          <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
        ) : (
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_14px_var(--primary)]" aria-hidden />
        )}
        <span className="max-w-[12rem] truncate text-white/82">{message}</span>
        {bridge.exportUrl ? (
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void saveToCreatix()}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden />
            Save
          </button>
        ) : null}
      </div>
      {status === 'saving' ? (
        <div className="h-1 w-56 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
      ) : null}
    </div>
  )
}

async function bootstrapFromLibrary(ids: string[]): Promise<void> {
  const res = await fetch(`/api/media/batch?ids=${ids.join(',')}`)
  if (!res.ok) return
  const { items } = (await res.json()) as { items: BatchMediaItem[] }
  if (!items?.length) return

  toast.info('Importing library media', `Loading ${items.length} item(s) into your timeline…`)

  let cursor = 0
  for (const item of items) {
    if (!item.signedUrl) continue
    try {
      const blobRes = await fetch(item.signedUrl)
      if (!blobRes.ok) continue
      const blob = await blobRes.blob()
      const file = new File([blob], item.name, { type: blob.type || 'video/mp4' })

      const store = useProjectStore.getState()
      const result = await store.importMedia(file)
      if (!result.success || !result.actionId) continue

      await store.addClipToNewTrack(result.actionId, cursor)

      // Advance cursor by clip duration (duration_sec is a numeric string from the DB)
      const durationMs = item.duration_sec ? parseFloat(item.duration_sec) * 1000 : 5_000
      cursor += durationMs
    } catch {
      // Non-fatal — skip this item and continue with the rest
    }
  }

  toast.success('Library media loaded', `${items.length} item(s) added to the timeline.`)
}

export function OpenReelEditorClient() {
  const project = useProjectStore((s) => s.project)
  const [brandSnapshot, setBrandSnapshot] = useState<BrandSnapshot>(defaultBrandSnapshot())
  const [leakAlerts, setLeakAlerts] = useState<LeakAlertView[]>([])
  const [showLeaks, setShowLeaks] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.body.classList.add('markit-editor-active')
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#/welcome') {
      window.location.hash = '#/editor'
    }

    return () => {
      document.body.classList.remove('markit-editor-active')
      resetBrandState()
    }
  }, [])

  // Bootstrap from library when ?from=library&ids= is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'library') return
    const ids = params.get('ids')?.split(',').filter(Boolean) ?? []
    if (ids.length === 0) return
    void bootstrapFromLibrary(ids)
  }, [])

  // Fetch brand settings once on mount
  useEffect(() => {
    fetch('/api/brand')
      .then((r) => r.json())
      .then((data: unknown) => {
        const result = validateBrandSnapshot(data)
        if (result.ok) setBrandSnapshot(result.snapshot)
      })
      .catch(() => { /* non-fatal */ })
  }, [])

  // Fetch leak alerts once on mount
  useEffect(() => {
    fetch('/api/leaks')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { alerts?: LeakAlertView[] } | null) => {
        if (body?.alerts) setLeakAlerts(body.alerts)
      })
      .catch(() => { /* non-fatal */ })
  }, [])

  // Re-apply brand overlay whenever snapshot or project changes
  useEffect(() => {
    void applyBrandToOpenReelProject(brandSnapshot)
  }, [brandSnapshot, project])

  const activeLeakCount = leakAlerts.filter((a) => !a.dismissedAt).length
  const leakNeedsAttention = leakAlerts.some(leakAlertNeedsAttention)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }} className="openreel-markit bg-background text-text-primary overflow-hidden">
      <OpenReelApp />
      <CreatixBridge />

      {/* Divine queue banner — fixed top, full width */}
      <DivineQueueBanner
        onApply={applyDivineActionToOpenReel}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 150,
        }}
      />

      {/* Voice mic — bottom right */}
      <OpenReelVoiceOverlay />

      {/* Leaks toggle button — bottom left */}
      {activeLeakCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowLeaks((v) => !v)}
          style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: leakNeedsAttention ? 'var(--destructive)' : 'var(--muted-foreground)',
            fontSize: 12,
            cursor: 'pointer',
          }}
          aria-label={showLeaks ? 'Hide leak alerts' : 'Show leak alerts'}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: leakNeedsAttention ? 'var(--destructive)' : 'var(--muted-foreground)' }} />
          {activeLeakCount} leak{activeLeakCount !== 1 ? 's' : ''}
        </button>
      ) : null}

      {/* Leaks inspector panel — toggled via floating button */}
      {showLeaks && activeLeakCount > 0 ? (
        <div
          style={{
            position: 'fixed',
            bottom: 64,
            left: 24,
            zIndex: 200,
            width: 320,
            maxHeight: 480,
            overflowY: 'auto',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            padding: 16,
            boxShadow: '0 8px 32px rgb(0 0 0 / 0.4)',
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Leak Monitor
          </p>
          {leakAlerts.filter((a) => !a.dismissedAt).map((alert) => (
            <div
              key={alert.id}
              style={{
                marginBottom: 10,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${leakAlertNeedsAttention(alert) ? 'var(--destructive)' : 'var(--muted-foreground)'}`,
                background: 'var(--background)',
                fontSize: 11,
                color: 'var(--muted-foreground)',
              }}
            >
              <p style={{ fontWeight: 600, color: 'var(--foreground)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {alert.url}
              </p>
              {alert.attributedToRecipientLabel ? (
                <p style={{ color: 'var(--accent)', fontSize: 10 }}>✦ {alert.attributedToRecipientLabel}</p>
              ) : null}
              <p style={{ fontSize: 10, marginTop: 4 }}>
                {new Date(alert.detectedAt).toLocaleDateString()} · DMCA: {alert.dmcaState}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
