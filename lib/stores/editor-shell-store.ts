import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { MarkitOutputFormat } from '@/lib/markit-edit-plan'

export type MediaContext = 'video' | 'image'

type EditorShellState = {
  density: 'simple' | 'pro'
  setDensity: (d: 'simple' | 'pro') => void
  mediaContext: MediaContext
  setMediaContext: (c: MediaContext) => void
  playheadSec: number
  setPlayheadSec: (sec: number) => void
  /** Monotonic id so the editor can imperatively seek the preview video from outside (e.g. Divine). */
  seekRequest: { id: number; sec: number } | null
  requestSeek: (sec: number) => void
  exportFormat: MarkitOutputFormat
  setExportFormat: (f: MarkitOutputFormat) => void
  encoderProfile: string
  setEncoderProfile: (s: string) => void
}

export const useEditorShellStore = create<EditorShellState>()(
  subscribeWithSelector((set) => ({
    density: 'simple',
    setDensity: (d) => set({ density: d }),
    mediaContext: 'video',
    setMediaContext: (c) => set({ mediaContext: c }),
    playheadSec: 0,
    setPlayheadSec: (sec) => set({ playheadSec: sec }),
    seekRequest: null,
    requestSeek: (sec) =>
      set((s) => ({
        seekRequest: { id: (s.seekRequest?.id ?? 0) + 1, sec },
        playheadSec: sec,
      })),
    exportFormat: 'mp4',
    setExportFormat: (f) => set({ exportFormat: f }),
    encoderProfile: 'markit.v1.h264',
    setEncoderProfile: (s) => set({ encoderProfile: s }),
  })),
)
