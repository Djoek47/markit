/**
 * Brand component library — Circe et Venus / Markit visual language.
 *
 * All components are CSS-variable–driven; they work in both dark and light themes
 * without any runtime theme detection.
 */

// Pre-existing brand primitives (kept in their original location)
export { BrandSeal } from '@/components/markit-v5/brand-seal'
export { DivineOrb } from '@/components/markit-v5/divine-orb'

// New v8 brand components
export { IntensityStrip } from './intensity-strip'
export type { IntensityPoint } from './intensity-strip'

export { VoiceMicButton } from './voice-mic-button'

export { TraceStatusPill } from './trace-status-pill'
export type { TraceStatus } from './trace-status-pill'
