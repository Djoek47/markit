'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrCreateMarkitDivineSessionId } from '@/lib/divine-session-id'
import {
  extractRealtimeFunctionCallId,
  injectToolResultFallback,
  isRealtimeUserSpeechEvent,
  triggerRealtimeAssistantResponse,
} from '@/lib/realtime-voice-helpers'
import { useDivineQueueStore } from '@/lib/stores/divine-queue-store'
import { isTimelineEditAction } from '@/lib/markit-v5/divine-editor-actions'
import type { VoiceIntentRequest, VoiceIntentResponse } from '@/lib/voice/intent-schema'

const VOICE_TOOL_FETCH_TIMEOUT_MS = 115_000

const REALTIME_PATH = '/api/creatix/divine-manager-realtime'
const TOOL_PATH = '/api/creatix/divine-voice-tool'
const INTENT_PATH = '/api/voice/intent'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error'

/**
 * Divine Manager Realtime (OpenAI WebRTC) against Creatix via Markit API proxy + Bearer token.
 *
 * Day 6 addition: the `edit_timeline` tool is handled locally — it calls /api/voice/intent
 * (Claude-powered), then enqueues the resulting timeline-editing actions in the divine queue
 * for user confirmation. Nav-only actions (seek, focus_inspector, etc.) are applied directly
 * by the caller via the existing divine-action-stream path.
 */
export function useMarkitDivineVoice(opts: {
  enabled: boolean
  getAccessToken: () => Promise<string | null>
  importUrl: string
  timelineSummary: string
  /** Forwarded to /api/voice/intent for context-aware parsing. */
  voiceIntentContext?: VoiceIntentRequest['context']
}) {
  const getTokenRef = useRef(opts.getAccessToken)
  useEffect(() => {
    getTokenRef.current = opts.getAccessToken
  }, [opts.getAccessToken])

  const intentContextRef = useRef(opts.voiceIntentContext)
  useEffect(() => {
    intentContextRef.current = opts.voiceIntentContext
  }, [opts.voiceIntentContext])

  const { enqueue } = useDivineQueueStore()

  const [status, setStatus] = useState<VoiceStatus>('idle')
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  const [error, setError] = useState<string | null>(null)
  const [remoteVoiceStream, setRemoteVoiceStream] = useState<MediaStream | null>(null)
  const [localVoiceStream, setLocalVoiceStream] = useState<MediaStream | null>(null)
  const [closingPending, setClosingPending] = useState(false)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const oaiDataChannelRef = useRef<RTCDataChannel | null>(null)
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null)
  const toolInFlightRef = useRef(false)
  const endCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endCallRafRef = useRef<number | null>(null)
  const scheduleIdleDisconnectRef = useRef<() => void>(() => {})

  const endVoiceCall = useCallback(
    (reason?: string) => {
      void reason
      if (endCallTimeoutRef.current) {
        clearTimeout(endCallTimeoutRef.current)
        endCallTimeoutRef.current = null
      }
      if (endCallRafRef.current != null) {
        cancelAnimationFrame(endCallRafRef.current)
        endCallRafRef.current = null
      }
      setClosingPending(false)
      toolInFlightRef.current = false
      const pc = pcRef.current
      if (pc) {
        pc.close()
        pcRef.current = null
      }
      const stream = streamRef.current
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      oaiDataChannelRef.current = null
      setRemoteVoiceStream(null)
      setLocalVoiceStream(null)
      remoteAnalyserRef.current = null
      setStatus('idle')
      setError(null)
    },
    [],
  )

  useEffect(() => {
    return () => {
      endVoiceCall()
    }
  }, [endVoiceCall])

  useEffect(() => {
    if (!remoteVoiceStream) {
      remoteAnalyserRef.current = null
      return
    }
    try {
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(remoteVoiceStream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      remoteAnalyserRef.current = analyser
      return () => {
        remoteAnalyserRef.current = null
        void audioContext.close()
      }
    } catch {
      return undefined
    }
  }, [remoteVoiceStream])

  /**
   * Handle the `edit_timeline` tool locally:
   * 1. POST transcript to /api/voice/intent (Claude-haiku)
   * 2. Timeline editing actions → enqueue in divine queue
   * 3. Nav-only actions → returned so the caller can apply them directly
   * 4. Returns the spoken confirmation text for the Realtime model
   */
  const runEditTimelineLocally = useCallback(
    async (args: Record<string, unknown>, token: string): Promise<string> => {
      const transcript =
        typeof args.transcript === 'string'
          ? args.transcript.trim()
          : typeof args.command === 'string'
            ? args.command.trim()
            : JSON.stringify(args)

      const reqBody: VoiceIntentRequest = {
        transcript,
        context: intentContextRef.current,
      }

      const abort = new AbortController()
      const timer = setTimeout(() => abort.abort(), 30_000)
      try {
        const res = await fetch(INTENT_PATH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(reqBody),
          signal: abort.signal,
        })

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          return `Error: Intent parsing failed (${err.error ?? res.status}). Please try again.`
        }

        const data = (await res.json()) as VoiceIntentResponse

        // Enqueue all actions — queue store handles them; confirm/dismiss is up to the user
        let queuedCount = 0
        let navCount = 0
        for (const action of data.actions) {
          if (isTimelineEditAction(action)) {
            enqueue(action, describeAction(action))
            queuedCount++
          } else {
            // Nav actions — still enqueue so the pending-queue banner can show them
            // with immediate auto-confirm. The UI layer decides.
            enqueue(action, describeAction(action))
            navCount++
          }
        }

        const suffix =
          queuedCount > 0
            ? ` ${queuedCount} edit${queuedCount !== 1 ? 's' : ''} queued — tap Confirm to apply.`
            : navCount > 0
              ? ' Applied immediately.'
              : ''

        return data.confirmationText + suffix
      } catch (e) {
        const aborted =
          (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') ||
          (e instanceof Error && e.name === 'AbortError')
        return aborted
          ? 'Error: Intent request timed out.'
          : `Error: ${e instanceof Error ? e.message : 'Network error'}`
      } finally {
        clearTimeout(timer)
      }
    },
    [enqueue],
  )

  const startVoice = useCallback(async () => {
    if (!opts.enabled) {
      setError('Divine voice is on Premium — includes Markit and the dashboard.')
      return
    }
    if (statusRef.current === 'connecting' || statusRef.current === 'connected') return
    const token = await getTokenRef.current()
    if (!token) {
      setError('Sign in to use Divine voice.')
      return
    }

    setError(null)
    setStatus('connecting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setLocalVoiceStream(stream)
      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioEl.setAttribute('playsinline', 'true')
      pc.ontrack = (e) => {
        if (e.streams[0]) {
          audioEl.srcObject = e.streams[0]
          setRemoteVoiceStream(e.streams[0])
        }
      }

      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      const dc = pc.createDataChannel('oai-events')
      oaiDataChannelRef.current = dc

      const scheduleGracefulEndCall = () => {
        if (endCallTimeoutRef.current) {
          clearTimeout(endCallTimeoutRef.current)
          endCallTimeoutRef.current = null
        }
        if (endCallRafRef.current != null) {
          cancelAnimationFrame(endCallRafRef.current)
          endCallRafRef.current = null
        }
        setClosingPending(true)
        const start = Date.now()
        let lastLoudAt = Date.now()
        const minMs = 1600
        const silenceMs = 550
        const maxMs = 14000
        const loudThreshold = 10

        const runTick = () => {
          const elapsed = Date.now() - start
          const analyser = remoteAnalyserRef.current
          if (analyser) {
            const buf = new Uint8Array(analyser.frequencyBinCount)
            analyser.getByteFrequencyData(buf)
            let sum = 0
            for (let i = 0; i < buf.length; i++) sum += buf[i]
            const avg = sum / buf.length
            if (avg > loudThreshold) lastLoudAt = Date.now()
          }
          const minDone = elapsed >= minMs
          const quietAfterSpeech = Date.now() - lastLoudAt >= silenceMs
          if ((minDone && quietAfterSpeech) || elapsed >= maxMs) {
            setClosingPending(false)
            endVoiceCall('end_call')
            endCallRafRef.current = null
            return
          }
          endCallRafRef.current = requestAnimationFrame(runTick)
        }

        if (!remoteAnalyserRef.current) {
          endCallTimeoutRef.current = setTimeout(() => {
            endCallTimeoutRef.current = null
            setClosingPending(false)
            endVoiceCall('end_call')
          }, 2500)
          return
        }
        endCallTimeoutRef.current = setTimeout(() => {
          endCallTimeoutRef.current = null
          endCallRafRef.current = requestAnimationFrame(runTick)
        }, 50)
      }

      const authHeaders = (): HeadersInit => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      })

      const finalizeRealtimeToolOutput = (
        callId: string | undefined,
        summary: string | null,
        toolName?: string,
      ): 'paired' | 'fallback' | 'none' => {
        if (summary == null || summary === '') return 'none'
        if (callId) {
          dc.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: { type: 'function_call_output', call_id: callId, output: summary },
            }),
          )
          return 'paired'
        }
        if (toolName) {
          injectToolResultFallback(dc, toolName, summary)
          return 'fallback'
        }
        return 'none'
      }

      const runTool = async (name: string, args: Record<string, unknown>): Promise<string | null> => {
        if (!name) return null

        if (name === 'end_call') {
          scheduleGracefulEndCall()
          return 'Call ended.'
        }

        // ── Local: edit_timeline — handled by Claude intent parser + queue ──
        if (name === 'edit_timeline') {
          return runEditTimelineLocally(args, token)
        }

        // ── Remote: everything else proxied to Creatix ──
        toolInFlightRef.current = true
        const abort = new AbortController()
        const abortTimer = setTimeout(() => abort.abort(), VOICE_TOOL_FETCH_TIMEOUT_MS)
        try {
          const res = await fetch(TOOL_PATH, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ name, arguments: args }),
            signal: abort.signal,
          })
          const data = (await res.json().catch(() => ({}))) as { error?: string; content?: string }
          if (!res.ok) {
            const detail = data.error?.trim() || `HTTP ${res.status}`
            return `Error: Tool failed (${detail}). Say this to the creator.`
          }
          const out = typeof data.content === 'string' ? data.content.trim() : ''
          return out || 'Error: Tool returned no text.'
        } catch (e) {
          const aborted =
            (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') ||
            (e instanceof Error && e.name === 'AbortError')
          if (aborted) {
            return `Error: Tool timed out after ${Math.round(VOICE_TOOL_FETCH_TIMEOUT_MS / 1000)}s.`
          }
          const msg = e instanceof Error ? e.message : 'network error'
          return `Error: Tool request failed (${msg}).`
        } finally {
          clearTimeout(abortTimer)
          toolInFlightRef.current = false
          scheduleIdleDisconnectRef.current()
        }
      }

      dc.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type?: string
            tool_calls?: Array<{ id?: string; call_id?: string; name?: string; arguments?: string }>
            response?: { output?: Array<{ id?: string; type?: string; name?: string; arguments?: string }> }
          }

          if (isRealtimeUserSpeechEvent(payload)) {
            /* silence protocol — reserved */
          }

          const toolCalls = payload?.tool_calls
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            const endCallToolCalls = toolCalls.filter((tc) => tc.name === 'end_call')
            const parallelToolCalls = toolCalls.filter((tc) => tc.name && tc.name !== 'end_call')
            let needAssistantResponse = false

            const results = await Promise.all(
              parallelToolCalls.map(async (tc) => {
                const name = tc.name
                const args = parseArgs(tc.arguments)
                const callId = extractRealtimeFunctionCallId(tc)
                const summary = await runTool(name!, args)
                return finalizeRealtimeToolOutput(callId, summary, name!)
              }),
            )
            if (results.some((r) => r === 'paired')) needAssistantResponse = true

            for (const tc of endCallToolCalls) {
              if (!tc.name) continue
              const args = parseArgs(tc.arguments)
              const callId = extractRealtimeFunctionCallId(tc)
              const summary = await runTool(tc.name, args)
              if (finalizeRealtimeToolOutput(callId, summary, tc.name) === 'paired') {
                needAssistantResponse = true
              }
            }
            if (needAssistantResponse) triggerRealtimeAssistantResponse(dc)
            return
          }

          if (payload?.type === 'response.done' && Array.isArray(payload.response?.output)) {
            const fnItems = payload.response!.output!.filter(
              (item) => item?.type === 'function_call' && item.name,
            ) as Array<{ id?: string; call_id?: string; name: string; arguments?: string }>

            const doneResults = await Promise.all(
              fnItems.map(async (item) => {
                const args = parseArgs(item.arguments)
                const summary = await runTool(item.name, args)
                return finalizeRealtimeToolOutput(extractRealtimeFunctionCallId(item), summary, item.name)
              }),
            )
            if (doneResults.some((r) => r === 'paired')) {
              triggerRealtimeAssistantResponse(dc)
            }
          }
        } catch {
          /* non-json */
        }
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      const res = await fetch(REALTIME_PATH, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          sdp: offer.sdp ?? '',
          divine_session_id: getOrCreateMarkitDivineSessionId(),
          context: {
            surface: 'markit',
            importUrl: opts.importUrl,
            timelineSummary: opts.timelineSummary,
          },
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
        if (res.status === 403 && err.code === 'divine_voice_premium_required') {
          throw new Error('Divine voice is on Premium — includes Markit and the dashboard.')
        }
        throw new Error((err as { error?: string }).error || `Session failed ${res.status}`)
      }
      const answerSdp = await res.text()
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }))
      setStatus('connected')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start voice call'
      endVoiceCall('error')
      setError(msg)
      setStatus('error')
    }
  }, [endVoiceCall, opts.enabled, opts.importUrl, opts.timelineSummary, runEditTimelineLocally])

  return {
    status,
    error,
    remoteVoiceStream,
    localVoiceStream,
    closingPending,
    startVoice,
    endVoice: endVoiceCall,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(raw: string | undefined | Record<string, unknown>): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return (raw ?? {}) as Record<string, unknown>
}

/** Short human-readable label for each action type — shown in the confirm banner. */
function describeAction(action: { type: string; [k: string]: unknown }): string {
  switch (action.type) {
    case 'split_segment':
      return `Split clip at ${typeof action.splitAtSec === 'number' ? action.splitAtSec.toFixed(1) + 's' : '?'}`
    case 'trim_segment': {
      const parts: string[] = []
      if (typeof action.startSec === 'number') parts.push(`in → ${action.startSec.toFixed(1)}s`)
      if (typeof action.endSec === 'number') parts.push(`out → ${action.endSec.toFixed(1)}s`)
      return `Trim clip (${parts.join(', ')})`
    }
    case 'remove_segment':
      return 'Remove clip'
    case 'reorder_segment':
      return `Move clip to position ${typeof action.toIndex === 'number' ? action.toIndex + 1 : '?'}`
    case 'set_crop_profile':
      return `Crop: ${action.profile}`
    case 'set_segment_speed':
      return `Speed: ${action.speedPct}%`
    case 'set_segment_fade': {
      const parts: string[] = []
      if (typeof action.fadeInMs === 'number') parts.push(`fade in ${action.fadeInMs}ms`)
      if (typeof action.fadeOutMs === 'number') parts.push(`fade out ${action.fadeOutMs}ms`)
      return `Set ${parts.join(', ')}`
    }
    case 'seek_playhead':
      return `Seek to ${typeof action.sec === 'number' ? action.sec.toFixed(1) + 's' : '?'}`
    case 'focus_inspector':
      return `Open ${action.tab} panel`
    case 'set_density':
      return `Switch to ${action.density} mode`
    case 'set_media_context':
      return `Switch to ${action.context} context`
    default:
      return action.type as string
  }
}
