import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyBrandToOpenReelProject, resetBrandState } from './openreel-brand-adapter'
import type { BrandSnapshot } from '@/lib/brand-contract'

const mockStore = {
  project: {
    timeline: {
      duration: 10000,
      tracks: [] as Array<{ id: string; type: string; name?: string; clips: unknown[] }>,
    },
  },
  addTrack:           vi.fn(),
  renameTrack:        vi.fn(),
  createTextClip:     vi.fn(),
  updateTextTransform: vi.fn(),
  deleteTextClip:     vi.fn(),
}

vi.mock('@/vendor/openreel/web/stores/project-store', () => ({
  useProjectStore: { getState: () => mockStore },
}))

const base: BrandSnapshot = {
  enabled: true,
  platform: 'onlyfans',
  handle: 'cisse',
  position: 'bottom-right',
  opacityPct: 80,
}

describe('applyBrandToOpenReelProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetBrandState()
    mockStore.project.timeline.tracks = []
    mockStore.project.timeline.duration = 10000
    mockStore.addTrack.mockResolvedValue({ success: true })
    mockStore.createTextClip.mockReturnValue({ id: 'text-clip-1' })
    mockStore.updateTextTransform.mockReturnValue({ id: 'text-clip-1' })
  })

  // ── enabled=false ──────────────────────────────────────────────────────────

  it('does nothing when enabled=false (no clips)', async () => {
    await applyBrandToOpenReelProject({ ...base, enabled: false })
    expect(mockStore.createTextClip).not.toHaveBeenCalled()
    expect(mockStore.addTrack).not.toHaveBeenCalled()
  })

  // ── track creation ─────────────────────────────────────────────────────────

  it('creates a text track and renames it on first apply', async () => {
    // Simulate addTrack adding a track to the project
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-new', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject(base)

    expect(mockStore.addTrack).toHaveBeenCalledWith('text')
    expect(mockStore.renameTrack).toHaveBeenCalledWith('track-new', 'Brand Watermark')
  })

  it('reuses existing brand track on second apply', async () => {
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-brand', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject(base)
    vi.clearAllMocks()
    mockStore.createTextClip.mockReturnValue({ id: 'text-clip-2' })

    // Second apply — track already present in timeline.tracks
    mockStore.project.timeline.tracks = [{ id: 'track-brand', type: 'text', clips: [] }]
    await applyBrandToOpenReelProject(base)

    expect(mockStore.addTrack).not.toHaveBeenCalled()
  })

  // ── clip creation ──────────────────────────────────────────────────────────

  it('creates a text clip with the formatted handle and full duration', async () => {
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-new', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject(base)

    expect(mockStore.createTextClip).toHaveBeenCalledWith(
      'track-new',
      0,
      'onlyfans.com/cisse',
      10000,
      expect.any(Object),
    )
  })

  // ── position mapping ───────────────────────────────────────────────────────

  it('maps bottom-right to { x: 0.85, y: 0.9 }', async () => {
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-new', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject({ ...base, position: 'bottom-right' })

    expect(mockStore.updateTextTransform).toHaveBeenCalledWith(
      'text-clip-1',
      expect.objectContaining({ position: { x: 0.85, y: 0.9 } }),
    )
  })

  it('maps top-left to { x: 0.05, y: 0.05 }', async () => {
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-new', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject({ ...base, position: 'top-left' })

    expect(mockStore.updateTextTransform).toHaveBeenCalledWith(
      'text-clip-1',
      expect.objectContaining({ position: { x: 0.05, y: 0.05 } }),
    )
  })

  it('maps middle-center to { x: 0.5, y: 0.5 }', async () => {
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-new', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject({ ...base, position: 'middle-center' })

    expect(mockStore.updateTextTransform).toHaveBeenCalledWith(
      'text-clip-1',
      expect.objectContaining({ position: { x: 0.5, y: 0.5 } }),
    )
  })

  // ── opacity conversion ─────────────────────────────────────────────────────

  it('converts opacityPct to 0–1 opacity', async () => {
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-new', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject({ ...base, opacityPct: 60 })

    expect(mockStore.updateTextTransform).toHaveBeenCalledWith(
      'text-clip-1',
      expect.objectContaining({ opacity: 0.6 }),
    )
  })

  // ── re-apply removes old clip ──────────────────────────────────────────────

  it('deletes the previous clip when re-applied', async () => {
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-brand', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject(base) // creates text-clip-1
    vi.clearAllMocks()
    mockStore.createTextClip.mockReturnValue({ id: 'text-clip-2' })

    mockStore.project.timeline.tracks = [{ id: 'track-brand', type: 'text', clips: [] }]
    await applyBrandToOpenReelProject({ ...base, opacityPct: 50 })

    expect(mockStore.deleteTextClip).toHaveBeenCalledWith('text-clip-1')
  })

  // ── enabled=false removes existing clip ───────────────────────────────────

  it('deletes existing clip when disabled', async () => {
    mockStore.addTrack.mockImplementation(async () => {
      mockStore.project.timeline.tracks = [{ id: 'track-brand', type: 'text', clips: [] }]
      return { success: true }
    })

    await applyBrandToOpenReelProject(base)
    vi.clearAllMocks()

    mockStore.project.timeline.tracks = [{ id: 'track-brand', type: 'text', clips: [] }]
    await applyBrandToOpenReelProject({ ...base, enabled: false })

    expect(mockStore.deleteTextClip).toHaveBeenCalledWith('text-clip-1')
    expect(mockStore.createTextClip).not.toHaveBeenCalled()
  })
})
