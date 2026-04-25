'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrCreateMarkitDivineSessionId } from '@/lib/divine-session-id'
import {
  extractRealtimeFunctionCallId,
  injectToolResultFallback,
  isRealtimeUserSpeechEvent,
  summarizeVoiceToolArgs,
  triggerRealtimeAssistantResponse,
} from '@/lib/realtime-voice-helpers'

const VOICE_TOOL_FETCH_TIMEOUT_MS = 115_000

const REALTIME_PATH = '/api/creatix/divine-manager-realtime'
const TOOL_PATH = '/api/creatix/divine-voice-tool'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error'

/**
 * Divine Manager Realtime (OpenAI WebRTC) against Creatix via Markit API proxy + Bearer token.
 */
export function useMarkitDivineVoice(opts: {
  enabled: boolean
  getAccessToken: () => Promise<string | null>
  importUrl: string
  timelineSummary: string
}) {
  const getTokenRef = useRef(opts.getAccessToken)
  useEffect(() => {
    getTokenRef.current = opts.getAccessToken
  }, [opts.getAccessToken])

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

      dc.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            type?: string
            tool_calls?: Array<{ id?: string; call_id?: string; name?: string; arguments?: string }>
            response?: { output?: Array<{ id?: string; type?: string; name?: string; arguments?: string }> }
          }

          if (isRealtimeUserSpeechEvent(payload)) {
            /* optional: silence protocol */
          }

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
              if (!out) {
                return `Error: Tool returned no text.`
              }
              return out
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

          const toolCalls = payload?.tool_calls
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            const endCallToolCalls = toolCalls.filter((tc) => tc.name === 'end_call')
            const parallelToolCalls = toolCalls.filter((tc) => tc.name && tc.name !== 'end_call')
            let needAssistantResponse = false
            const results = await Promise.all(
              parallelToolCalls.map(async (tc) => {
                const name = tc.name
                const args =
                  typeof tc.arguments === 'string'
                    ? (() => {
                        try {
                          return JSON.parse(tc.arguments!) as Record<string, unknown>
                        } catch {
                          return {}
                        }
                      })()
                    : ((tc.arguments ?? {}) as Record<string, unknown>)
                const callId = extractRealtimeFunctionCallId(tc)
                const summary = await runTool(name!, args)
                return finalizeRealtimeToolOutput(callId, summary, name!)
              }),
            )
            if (results.some((r) => r === 'paired')) needAssistantResponse = true
            for (const tc of endCallToolCalls) {
              if (!tc.name) continue
              const args =
                typeof tc.arguments === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(tc.arguments!) as Record<string, unknown>
                      } catch {
                        return {}
                      }
                    })()
                  : ((tc.arguments ?? {}) as Record<string, unknown>)
              const callId = extractRealtimeFunctionCallId(tc)
              const summary = await runTool(tc.name, args)
              if (finalizeRealtimeToolOutput(callId, summary, tc.name) === 'paired') {
                needAssistantResponse = true
              }
            }
            if (needAssistantResponse) {
              triggerRealtimeAssistantResponse(dc)
            }
            return
          }
          if (payload?.type === 'response.done' && Array.isArray(payload.response?.output)) {
            const fnItems = payload.response!.output!.filter(
              (item) => item?.type === 'function_call' && item.name,
            ) as Array<{ id?: string; call_id?: string; name: string; arguments?: string }>
            const doneResults = await Promise.all(
              fnItems.map(async (item) => {
                const args =
                  typeof item.arguments === 'string'
                    ? (() => {
                        try {
                          return JSON.parse(item.arguments!) as Record<string, unknown>
                        } catch {
                          return {}
                        }
                      })()
                    : ({} as Record<string, unknown>)
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
  }, [endVoiceCall, opts.enabled, opts.importUrl, opts.timelineSummary])

  scheduleIdleDisconnectRef.current = () => {}

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
