'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpFromLine, Check, Loader2 } from 'lucide-react'
import OpenReelApp from '@/vendor/openreel/web/App'
import { useProjectStore } from '@/vendor/openreel/web/stores/project-store'
import { useUIStore } from '@/vendor/openreel/web/stores/ui-store'
import { toast } from '@/vendor/openreel/web/stores/notification-store'
import { getExportEngine, type ExportResult, type VideoExportSettings } from '@openreel/core'

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
  const setGlobalExportState = useUIStore((state) => state.setExportState)

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

      setMessage('Saving to Creatix vault...')
      const formData = new FormData()
      formData.append('exportUrl', bridge.exportUrl)
      formData.append('exportToken', bridge.exportToken)
      formData.append('file', new File([blob], `${project.name || 'markit-export'}.mp4`, { type: 'video/mp4' }))

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

export function OpenReelEditorClient() {
  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.body.classList.add('markit-editor-active')
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#/welcome') {
      window.location.hash = '#/editor'
    }

    return () => {
      document.body.classList.remove('markit-editor-active')
    }
  }, [])

  return (
    <div className="openreel-markit h-screen w-screen overflow-hidden bg-background text-text-primary">
      <OpenReelApp />
      <CreatixBridge />
    </div>
  )
}
