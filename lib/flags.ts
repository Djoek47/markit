function envBool(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback
  const t = value.trim().toLowerCase()
  return t === '1' || t === 'true' || t === 'yes' || t === 'on'
}

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

