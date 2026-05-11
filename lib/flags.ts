function envBool(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback
  const t = value.trim().toLowerCase()
  return t === '1' || t === 'true' || t === 'yes' || t === 'on'
}

// ─── Legacy / Ariadne trace flags ─────────────────────────────────────────────

export function flagAriadneV2Embed() {
  return envBool(process.env.ARIADNE_V2_EMBED_ENABLED, false)
}

export function flagAriadneV2Detect() {
  return envBool(process.env.ARIADNE_V2_DETECT_ENABLED, false)
}

export function flagAriadneConfidenceGate() {
  return envBool(process.env.ARIADNE_CONFIDENCE_GATING_ENABLED, false)
}

export function flagFramerTracedExport() {
  return envBool(process.env.FRAMER_TRACED_EXPORT_ENABLED, false)
}

// ─── v8 feature flags ─────────────────────────────────────────────────────────
// All default to false. Set via env var to enable.
// NEXT_PUBLIC_ mirrors are auto-generated — add matching NEXT_PUBLIC_ vars in .env.local
// if you need client-side flag checks.

/**
 * Enables the Claude-powered voice intent route (/api/voice/intent).
 * MARKIT_FEATURE_VOICE_INTENT=1
 */
export function flagVoiceIntent() {
  return envBool(process.env.MARKIT_FEATURE_VOICE_INTENT, false)
}

/**
 * Enables the leak monitor panel and Supabase Realtime leak-alert channel.
 * MARKIT_FEATURE_LEAK_MONITOR=1
 */
export function flagLeakMonitor() {
  return envBool(process.env.MARKIT_FEATURE_LEAK_MONITOR, false)
}

/**
 * Enables the /api/dmca/generate DMCA forwarder to Creatix.
 * MARKIT_FEATURE_DMCA_FORWARDER=1
 */
export function flagDmcaForwarder() {
  return envBool(process.env.MARKIT_FEATURE_DMCA_FORWARDER, false)
}

/**
 * Enables persistent brand settings stored in Supabase (markit.brand_settings).
 * MARKIT_FEATURE_BRAND_PERSISTENCE=1
 */
export function flagBrandPersistence() {
  return envBool(process.env.MARKIT_FEATURE_BRAND_PERSISTENCE, false)
}

/**
 * Enables the standalone media upload pipeline (/api/media/sign-upload, /api/media/finalize).
 * Required for library-based (non-bridge) workflows.
 * MARKIT_FEATURE_MEDIA_PIPELINE=1
 */
export function flagMediaPipeline() {
  return envBool(process.env.MARKIT_FEATURE_MEDIA_PIPELINE, false)
}

/**
 * Enables the intensity scan worker call (QStash → /api/internal/intensity-scan).
 * Unlocks AI editing actions: auto_trim_silence, create_teaser, end_on_climax.
 * MARKIT_FEATURE_INTENSITY_SCAN=1
 */
export function flagIntensityScan() {
  return envBool(process.env.MARKIT_FEATURE_INTENSITY_SCAN, false)
}

// ─── Gate decisions ───────────────────────────────────────────────────────────

/**
 * Whether the standalone library view should be fully functional.
 * Degrades to bridge-only (vault import) when mediaPipeline is off.
 */
export function resolveLibraryViewEnabled(): boolean {
  return flagMediaPipeline()
}

/**
 * Whether the vault leak-alert block should be shown.
 * Hidden when leakMonitor is off.
 */
export function resolveVaultLeakBlockEnabled(): boolean {
  return flagLeakMonitor()
}

/**
 * Whether brand + trace UI should be shown on the export panel.
 * Disabled when both brandPersistence and the legacy exportApiBridge are off.
 */
export function resolveExportBrandTraceEnabled(): boolean {
  return (
    flagBrandPersistence() ||
    envBool(process.env.MARKIT_FEATURE_EXPORT_API_BRIDGE, false)
  )
}

/**
 * Whether AI editing actions that require intensity data should be surfaced.
 */
export function resolveIntensityActionsEnabled(): boolean {
  return flagIntensityScan()
}

