import type { MediaContext } from '@/lib/stores/editor-shell-store'

// ─── UI / Navigation actions (applied immediately, no confirmation needed) ────

/** Seek the preview video to a specific second. */
export type DivineSeekPlayhead = { type: 'seek_playhead'; sec: number }

/** Switch between simple / pro editor density. */
export type DivineSetDensity = { type: 'set_density'; density: 'simple' | 'pro' }

/** Switch between video / image editing context. */
export type DivineSetMediaContext = { type: 'set_media_context'; context: MediaContext }

/** Focus a specific inspector tab. */
export type DivineFocusInspector = {
  type: 'focus_inspector'
  tab: 'clip' | 'crop' | 'trim' | 'export' | 'trace'
}

/** No-op (used when the model wants to acknowledge but not change anything). */
export type DivineNoop = { type: 'noop'; reason?: string }

// ─── Timeline editing actions (queued for user confirmation) ──────────────────

/**
 * Split a segment at the given absolute time on the timeline.
 * If `segmentId` is omitted the segment containing `splitAtSec` is targeted.
 */
export type DivineSplitSegment = {
  type: 'split_segment'
  segmentId?: string
  splitAtSec: number
}

/**
 * Adjust the in/out points of a segment.
 * Omitting `startSec` or `endSec` leaves that edge unchanged.
 */
export type DivineTrimSegment = {
  type: 'trim_segment'
  segmentId: string
  startSec?: number
  endSec?: number
}

/** Remove a segment from the timeline. */
export type DivineRemoveSegment = {
  type: 'remove_segment'
  segmentId: string
}

/** Move a segment to a new zero-based index in the timeline. */
export type DivineReorderSegment = {
  type: 'reorder_segment'
  segmentId: string
  toIndex: number
}

/**
 * Apply a crop / aspect-ratio preset to the whole timeline.
 * This updates the global `cropRect` in the editor shell.
 */
export type DivineSetCropProfile = {
  type: 'set_crop_profile'
  profile: '9:16' | '16:9' | '1:1' | '4:5' | '3:4' | 'original'
}

/** Set playback speed on a segment (25–400 %). */
export type DivineSetSegmentSpeed = {
  type: 'set_segment_speed'
  segmentId: string
  speedPct: number
}

/** Set fade-in and/or fade-out duration on a segment (0–5000 ms). */
export type DivineSetSegmentFade = {
  type: 'set_segment_fade'
  segmentId: string
  fadeInMs?: number
  fadeOutMs?: number
}

// ─── v8 AI editing actions (queued for confirmation) ─────────────────────────

/**
 * Automatically trim silence / low-energy sections from a segment.
 * Requires an intensity scan for the segment's source media.
 */
export type DivineAutoTrimSilence = {
  type: 'auto_trim_silence'
  segmentId: string
}

/**
 * Crop a segment to a specific aspect ratio.
 * Platform-aware variants: 9:16-of (OnlyFans), 9:16-fansly (Fansly) match their
 * safe-zone guidelines; they resolve to the same rect but carry platform metadata.
 */
export type DivineCropToAspect = {
  type: 'crop_to_aspect'
  segmentId: string
  aspect: '9:16-of' | '9:16-fansly' | '9:16' | '1:1' | '4:5' | '16:9' | 'original'
}

/** Blur faces in a segment — auto-detect or manual regions. */
export type DivineBlurFaces = {
  type: 'blur_faces'
  segmentId: string
  mode: 'auto' | 'manual'
  regions?: Array<{ x: number; y: number; width: number; height: number }>
}

/** Set playback speed using the v8 clip identifier (alias for set_segment_speed with different field name for backward compat). */
export type DivineSetClipSpeed = {
  type: 'set_clip_speed'
  segmentId: string
  speedPct: number // 25..400
}

/**
 * Create a short teaser clip from the highest-intensity window.
 * Requires intensity scan. `targetSec` is the desired teaser duration.
 */
export type DivineCreateTeaser = {
  type: 'create_teaser'
  segmentId: string
  targetSec: number
  mode: 'single' | 'multi-shot'
  shotCount?: number
}

/**
 * Trim the segment to end on its highest-intensity climax peak.
 * Requires intensity scan. `tailSec` is optional padding after the climax.
 */
export type DivineEndOnClimax = {
  type: 'end_on_climax'
  segmentId: string
  tailSec?: number
}

// ─── v8 brand + trace + export actions (queued for confirmation) ──────────────

/** Set the recipient label (and optional platform) for the next Ariadne trace export. */
export type DivineSetRecipient = {
  type: 'set_recipient'
  recipientLabel: string
  platform?: 'onlyfans' | 'fansly' | 'manyvids' | 'custom'
  platformId?: string
}

/** Toggle brand watermark overlay on/off for the export. */
export type DivineSetBrandApply = {
  type: 'set_brand_apply'
  applyBrand: boolean
}

/** Configure which Ariadne trace layers to use on this export. */
export type DivineSetTraceLayers = {
  type: 'set_trace_layers'
  spatialGrid: boolean
  temporalRedundancy: boolean
  metadataAppend: boolean
}

/** Confirm and start the render + export pipeline. */
export type DivineStartExport = {
  type: 'start_export'
  confirm: boolean
}

// ─── v8 library / vault navigation actions (applied immediately) ──────────────

/** Search the media library. */
export type DivineLibrarySearch = {
  type: 'library_search'
  query: string
}

/** Select a media item in the library (optionally adding to multi-selection). */
export type DivineLibrarySelectMedia = {
  type: 'library_select_media'
  mediaId: string
  multi?: boolean
}

/** Trigger "Create with AI" for a set of selected media IDs. */
export type DivineLibraryCreateWithAi = {
  type: 'library_create_with_ai'
  mediaIds: string[]
}

/** Open / focus a specific Ariadne marker in the vault panel. */
export type DivineVaultOpenMarker = {
  type: 'vault_open_marker'
  markerId: string
}

/** Dismiss a leak alert view in the vault. */
export type DivineVaultDismissLeak = {
  type: 'vault_dismiss_leak'
  leakViewId: string
}

/** Trigger DMCA draft generation for a leak. */
export type DivineVaultGenerateDmca = {
  type: 'vault_generate_dmca'
  leakViewId: string
}

/** Send a DMCA takedown notice for a leak. */
export type DivineVaultSendDmca = {
  type: 'vault_send_dmca'
  leakViewId: string
  hostDestination?: string
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type EditorDivineUiAction =
  // UI / nav (5 — applied immediately)
  | DivineSeekPlayhead
  | DivineSetDensity
  | DivineSetMediaContext
  | DivineFocusInspector
  | DivineNoop
  // Timeline editing (7 — queued for confirmation)
  | DivineSplitSegment
  | DivineTrimSegment
  | DivineRemoveSegment
  | DivineReorderSegment
  | DivineSetCropProfile
  | DivineSetSegmentSpeed
  | DivineSetSegmentFade
  // v8 AI editing (6 — queued for confirmation, some need intensity scan)
  | DivineAutoTrimSilence
  | DivineCropToAspect
  | DivineBlurFaces
  | DivineSetClipSpeed
  | DivineCreateTeaser
  | DivineEndOnClimax
  // v8 brand + trace + export (4 — queued for confirmation)
  | DivineSetRecipient
  | DivineSetBrandApply
  | DivineSetTraceLayers
  | DivineStartExport
  // v8 library / vault navigation (7 — applied immediately)
  | DivineLibrarySearch
  | DivineLibrarySelectMedia
  | DivineLibraryCreateWithAi
  | DivineVaultOpenMarker
  | DivineVaultDismissLeak
  | DivineVaultGenerateDmca
  | DivineVaultSendDmca

/**
 * Actions that require an intensity scan result before they can be applied.
 * The applier returns PRECONDITION_MISSING when the scan is absent.
 */
export function isIntensityScanRequired(
  action: EditorDivineUiAction,
): action is DivineAutoTrimSilence | DivineCreateTeaser | DivineEndOnClimax {
  return (
    action.type === 'auto_trim_silence' ||
    action.type === 'create_teaser' ||
    action.type === 'end_on_climax'
  )
}

/** True for actions that mutate the timeline and must be confirmed before applying. */
export function isTimelineEditAction(
  action: EditorDivineUiAction,
): action is
  | DivineSplitSegment
  | DivineTrimSegment
  | DivineRemoveSegment
  | DivineReorderSegment
  | DivineSetCropProfile
  | DivineSetSegmentSpeed
  | DivineSetSegmentFade
  | DivineAutoTrimSilence
  | DivineCropToAspect
  | DivineBlurFaces
  | DivineSetClipSpeed
  | DivineCreateTeaser
  | DivineEndOnClimax
  | DivineSetRecipient
  | DivineSetBrandApply
  | DivineSetTraceLayers
  | DivineStartExport {
  return (
    action.type === 'split_segment' ||
    action.type === 'trim_segment' ||
    action.type === 'remove_segment' ||
    action.type === 'reorder_segment' ||
    action.type === 'set_crop_profile' ||
    action.type === 'set_segment_speed' ||
    action.type === 'set_segment_fade' ||
    action.type === 'auto_trim_silence' ||
    action.type === 'crop_to_aspect' ||
    action.type === 'blur_faces' ||
    action.type === 'set_clip_speed' ||
    action.type === 'create_teaser' ||
    action.type === 'end_on_climax' ||
    action.type === 'set_recipient' ||
    action.type === 'set_brand_apply' ||
    action.type === 'set_trace_layers' ||
    action.type === 'start_export'
  )
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseEditorDivineUiAction(raw: unknown): EditorDivineUiAction | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const t = o.type

  // ── UI / nav ──────────────────────────────────────────────────────────────
  if (t === 'seek_playhead' && typeof o.sec === 'number' && Number.isFinite(o.sec)) {
    return { type: 'seek_playhead', sec: Math.max(0, o.sec) }
  }
  if (t === 'set_density' && (o.density === 'simple' || o.density === 'pro')) {
    return { type: 'set_density', density: o.density }
  }
  if (t === 'set_media_context' && (o.context === 'video' || o.context === 'image')) {
    return { type: 'set_media_context', context: o.context }
  }
  if (t === 'focus_inspector') {
    const tab = o.tab
    if (tab === 'clip' || tab === 'crop' || tab === 'trim' || tab === 'export' || tab === 'trace') {
      return { type: 'focus_inspector', tab }
    }
  }
  if (t === 'noop') {
    return { type: 'noop', reason: typeof o.reason === 'string' ? o.reason : undefined }
  }

  // ── Timeline editing ──────────────────────────────────────────────────────
  if (t === 'split_segment' && typeof o.splitAtSec === 'number' && Number.isFinite(o.splitAtSec)) {
    return {
      type: 'split_segment',
      segmentId: typeof o.segmentId === 'string' ? o.segmentId : undefined,
      splitAtSec: Math.max(0, o.splitAtSec),
    }
  }
  if (t === 'trim_segment' && typeof o.segmentId === 'string') {
    const action: DivineTrimSegment = { type: 'trim_segment', segmentId: o.segmentId }
    if (typeof o.startSec === 'number' && Number.isFinite(o.startSec)) action.startSec = Math.max(0, o.startSec)
    if (typeof o.endSec === 'number' && Number.isFinite(o.endSec)) action.endSec = Math.max(0, o.endSec)
    if (action.startSec === undefined && action.endSec === undefined) return null
    return action
  }
  if (t === 'remove_segment' && typeof o.segmentId === 'string') {
    return { type: 'remove_segment', segmentId: o.segmentId }
  }
  if (t === 'reorder_segment' && typeof o.segmentId === 'string' && typeof o.toIndex === 'number') {
    return { type: 'reorder_segment', segmentId: o.segmentId, toIndex: Math.max(0, Math.floor(o.toIndex)) }
  }
  if (t === 'set_crop_profile') {
    const p = o.profile
    if (p === '9:16' || p === '16:9' || p === '1:1' || p === '4:5' || p === '3:4' || p === 'original') {
      return { type: 'set_crop_profile', profile: p }
    }
  }
  if (t === 'set_segment_speed' && typeof o.segmentId === 'string' && typeof o.speedPct === 'number') {
    return {
      type: 'set_segment_speed',
      segmentId: o.segmentId,
      speedPct: Math.max(25, Math.min(400, o.speedPct)),
    }
  }
  if (t === 'set_segment_fade' && typeof o.segmentId === 'string') {
    const action: DivineSetSegmentFade = { type: 'set_segment_fade', segmentId: o.segmentId }
    if (typeof o.fadeInMs === 'number' && Number.isFinite(o.fadeInMs)) action.fadeInMs = Math.max(0, Math.min(5000, o.fadeInMs))
    if (typeof o.fadeOutMs === 'number' && Number.isFinite(o.fadeOutMs)) action.fadeOutMs = Math.max(0, Math.min(5000, o.fadeOutMs))
    if (action.fadeInMs === undefined && action.fadeOutMs === undefined) return null
    return action
  }

  // ── v8 AI editing ──────────────────────────────────────────────────────────
  if (t === 'auto_trim_silence' && typeof o.segmentId === 'string') {
    return { type: 'auto_trim_silence', segmentId: o.segmentId }
  }
  if (t === 'crop_to_aspect' && typeof o.segmentId === 'string') {
    const a = o.aspect
    const validAspects = ['9:16-of', '9:16-fansly', '9:16', '1:1', '4:5', '16:9', 'original'] as const
    if (!validAspects.includes(a as (typeof validAspects)[number])) return null
    return { type: 'crop_to_aspect', segmentId: o.segmentId, aspect: a as DivineCropToAspect['aspect'] }
  }
  if (t === 'blur_faces' && typeof o.segmentId === 'string') {
    const mode = o.mode
    if (mode !== 'auto' && mode !== 'manual') return null
    const action: DivineBlurFaces = { type: 'blur_faces', segmentId: o.segmentId, mode }
    if (Array.isArray(o.regions)) {
      const regions = (o.regions as unknown[]).filter(
        (r): r is { x: number; y: number; width: number; height: number } =>
          typeof r === 'object' && r !== null &&
          typeof (r as Record<string, unknown>).x === 'number' &&
          typeof (r as Record<string, unknown>).y === 'number' &&
          typeof (r as Record<string, unknown>).width === 'number' &&
          typeof (r as Record<string, unknown>).height === 'number',
      )
      action.regions = regions
    }
    return action
  }
  if (t === 'set_clip_speed' && typeof o.segmentId === 'string' && typeof o.speedPct === 'number') {
    return { type: 'set_clip_speed', segmentId: o.segmentId, speedPct: Math.max(25, Math.min(400, o.speedPct)) }
  }
  if (t === 'create_teaser' && typeof o.segmentId === 'string' && typeof o.targetSec === 'number' && Number.isFinite(o.targetSec)) {
    const mode = o.mode
    if (mode !== 'single' && mode !== 'multi-shot') return null
    const action: DivineCreateTeaser = { type: 'create_teaser', segmentId: o.segmentId, targetSec: Math.max(0, o.targetSec), mode }
    if (typeof o.shotCount === 'number' && Number.isFinite(o.shotCount)) action.shotCount = Math.max(1, Math.floor(o.shotCount))
    return action
  }
  if (t === 'end_on_climax' && typeof o.segmentId === 'string') {
    const action: DivineEndOnClimax = { type: 'end_on_climax', segmentId: o.segmentId }
    if (typeof o.tailSec === 'number' && Number.isFinite(o.tailSec)) action.tailSec = Math.max(0, o.tailSec)
    return action
  }

  // ── v8 brand + trace + export ──────────────────────────────────────────────
  if (t === 'set_recipient' && typeof o.recipientLabel === 'string' && o.recipientLabel.trim() !== '') {
    const action: DivineSetRecipient = { type: 'set_recipient', recipientLabel: o.recipientLabel.trim() }
    const validPlatforms = ['onlyfans', 'fansly', 'manyvids', 'custom'] as const
    if (validPlatforms.includes(o.platform as (typeof validPlatforms)[number])) {
      action.platform = o.platform as DivineSetRecipient['platform']
    }
    if (typeof o.platformId === 'string') action.platformId = o.platformId
    return action
  }
  if (t === 'set_brand_apply' && typeof o.applyBrand === 'boolean') {
    return { type: 'set_brand_apply', applyBrand: o.applyBrand }
  }
  if (
    t === 'set_trace_layers' &&
    typeof o.spatialGrid === 'boolean' &&
    typeof o.temporalRedundancy === 'boolean' &&
    typeof o.metadataAppend === 'boolean'
  ) {
    return {
      type: 'set_trace_layers',
      spatialGrid: o.spatialGrid,
      temporalRedundancy: o.temporalRedundancy,
      metadataAppend: o.metadataAppend,
    }
  }
  if (t === 'start_export' && typeof o.confirm === 'boolean') {
    return { type: 'start_export', confirm: o.confirm }
  }

  // ── v8 library / vault navigation ──────────────────────────────────────────
  if (t === 'library_search' && typeof o.query === 'string') {
    return { type: 'library_search', query: o.query }
  }
  if (t === 'library_select_media' && typeof o.mediaId === 'string') {
    return {
      type: 'library_select_media',
      mediaId: o.mediaId,
      multi: o.multi === true ? true : undefined,
    }
  }
  if (t === 'library_create_with_ai' && Array.isArray(o.mediaIds)) {
    const mediaIds = (o.mediaIds as unknown[]).filter((id): id is string => typeof id === 'string')
    if (mediaIds.length === 0) return null
    return { type: 'library_create_with_ai', mediaIds }
  }
  if (t === 'vault_open_marker' && typeof o.markerId === 'string') {
    return { type: 'vault_open_marker', markerId: o.markerId }
  }
  if (t === 'vault_dismiss_leak' && typeof o.leakViewId === 'string') {
    return { type: 'vault_dismiss_leak', leakViewId: o.leakViewId }
  }
  if (t === 'vault_generate_dmca' && typeof o.leakViewId === 'string') {
    return { type: 'vault_generate_dmca', leakViewId: o.leakViewId }
  }
  if (t === 'vault_send_dmca' && typeof o.leakViewId === 'string') {
    const action: DivineVaultSendDmca = { type: 'vault_send_dmca', leakViewId: o.leakViewId }
    if (typeof o.hostDestination === 'string') action.hostDestination = o.hostDestination
    return action
  }

  return null
}
