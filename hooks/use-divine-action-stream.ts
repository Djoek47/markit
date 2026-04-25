'use client'

import { useEffect, useRef } from 'react'
import type { EditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'
import { parseEditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'

const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(/\/$/, '')

type DivineStreamHandlers = {
  onAction: (action: EditorDivineUiAction) => void
  getAccessToken: () => Promise<string | null>
  enabled: boolean
}

/**
 * Stream `divine_action` events from Creatix (`GET /api/divine/action-stream`) using fetch + SSE framing.
 * EventSource cannot set Authorization; Markit uses Bearer from Supabase session.
 */
export function useDivineActionStream(opts: DivineStreamHandlers) {
  const { getAccessToken, enabled, onAction } = opts
  const onActionRef = useRef(onAction)
  useEffect(() => {
    onActionRef.current = onAction
  }, [onAction])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      const token = await getAccessToken()
      if (!token || cancelled) return
      const res = await fetch(`${creatix}/api/divine/action-stream`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
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
  }, [enabled, getAccessToken])
}
