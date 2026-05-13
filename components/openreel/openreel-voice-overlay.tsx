'use client'

import { useCallback } from 'react'
import { VoiceMicButton } from '@/components/brand'
import { useMarkitDivineVoice } from '@/hooks/use-markit-divine-voice'
import { useProjectStore } from '@/vendor/openreel/web/stores/project-store'
import { createClient } from '@/lib/supabase/client'

export function OpenReelVoiceOverlay() {
  const project = useProjectStore((s) => s.project)

  // Flatten clips from all tracks; OpenReel times are ms, voice hook expects seconds
  const allClips = project?.timeline.tracks.flatMap((t) => t.clips) ?? []

  const timelineSummary = allClips.length
    ? `${allClips.length} clip(s), total ${(allClips.reduce((s, c) => s + c.duration, 0) / 1000).toFixed(1)}s`
    : 'Empty timeline'

  const getAccessToken = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const { status, startVoice, endVoice } = useMarkitDivineVoice({
    enabled: true,
    getAccessToken,
    importUrl: '',
    timelineSummary,
    voiceIntentContext: {
      segmentCount: allClips.length,
      segments: allClips.slice(0, 12).map((c, i) => ({
        id: c.id,
        startSec: c.startTime / 1000,
        endSec: (c.startTime + c.duration) / 1000,
        label: `Clip ${i + 1}`,
      })),
    },
  })

  const isListening = status === 'connected'
  const isProcessing = status === 'connecting'

  const toggle = () => {
    if (status === 'connected' || status === 'connecting') {
      endVoice('user')
    } else {
      void startVoice()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 220,   // above the OpenReel timeline + transport bar (~200px)
        right: 24,
        zIndex: 9999,  // above all OpenReel layers
      }}
      title={isListening ? 'Stop voice command' : 'Start voice command (say "split at 5 seconds", "set crop to 9:16", etc.)'}
    >
      <VoiceMicButton
        isListening={isListening}
        isProcessing={isProcessing}
        onClick={toggle}
        size="lg"
      />
    </div>
  )
}
