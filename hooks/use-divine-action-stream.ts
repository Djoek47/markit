'use client'

import { useEffect, useRef } from 'react'
import type { EditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'
import { parseEditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'

type DivineStreamHandlers = {
  onAction: (action: EditorDivineUiAction) => void
  enabled: boolean
}

/**
 * Stream `divine_action` events via Markit `GET /api/creatix/divine-action-stream` (proxies Creatix SSE).
 * Same-origin + session cookies — avoids cross-origin CORS / Referrer issues with circeetvenus.com.
 */
export function useDivineActionStream(opts: DivineStreamHandlers) {
  const { enabled, onAction } = opts
  const onActionRef = useRef(onAction)
  useEffect(() => {
    onActionRef.current = onAction
  }, [onAction])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      const res = await fetch('/api/creatix/divine-action-stream', {
        credentials: 'include',
        headers: { Accept: 'text/event-stream' },
        cache: 'no-store',
      })
      if (!res.ok || !res.body) return
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (!cancelled) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const block of parts) {
          const lines = block.split('\n').filter(Boolean)
          let event = 'message'
          const dataLines: string[] = []
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
          }
          if (event === 'divine_action' && dataLines.length) {
            try {
              const payload = JSON.parse(dataLines.join('\n')) as { action?: unknown }
              const parsed = parseEditorDivineUiAction(payload.action)
              if (parsed) onActionRef.current(parsed)
            } catch {
              /* ignore */
            }
          }
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [enabled])
}
