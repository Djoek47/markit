import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  flagVoiceIntent,
  flagLeakMonitor,
  flagDmcaForwarder,
  flagBrandPersistence,
  flagMediaPipeline,
  flagIntensityScan,
  resolveLibraryViewEnabled,
  resolveVaultLeakBlockEnabled,
  resolveExportBrandTraceEnabled,
  resolveIntensityActionsEnabled,
} from '@/lib/flags'

// ─── helpers ─────────────────────────────────────────────────────────────────

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {}
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k]
    if (vars[k] === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = vars[k]
    }
  }
  try {
    fn()
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

// ─── v8 flag defaults (all false) ────────────────────────────────────────────

describe('v8 flags — default to false', () => {
  beforeEach(() => {
    delete process.env.MARKIT_FEATURE_VOICE_INTENT
    delete process.env.MARKIT_FEATURE_LEAK_MONITOR
    delete process.env.MARKIT_FEATURE_DMCA_FORWARDER
    delete process.env.MARKIT_FEATURE_BRAND_PERSISTENCE
    delete process.env.MARKIT_FEATURE_MEDIA_PIPELINE
    delete process.env.MARKIT_FEATURE_INTENSITY_SCAN
  })

  afterEach(() => {
    delete process.env.MARKIT_FEATURE_VOICE_INTENT
    delete process.env.MARKIT_FEATURE_LEAK_MONITOR
    delete process.env.MARKIT_FEATURE_DMCA_FORWARDER
    delete process.env.MARKIT_FEATURE_BRAND_PERSISTENCE
    delete process.env.MARKIT_FEATURE_MEDIA_PIPELINE
    delete process.env.MARKIT_FEATURE_INTENSITY_SCAN
  })

  it('flagVoiceIntent is false by default', () => expect(flagVoiceIntent()).toBe(false))
  it('flagLeakMonitor is false by default', () => expect(flagLeakMonitor()).toBe(false))
  it('flagDmcaForwarder is false by default', () => expect(flagDmcaForwarder()).toBe(false))
  it('flagBrandPersistence is false by default', () => expect(flagBrandPersistence()).toBe(false))
  it('flagMediaPipeline is false by default', () => expect(flagMediaPipeline()).toBe(false))
  it('flagIntensityScan is false by default', () => expect(flagIntensityScan()).toBe(false))
})

// ─── truthy env values ────────────────────────────────────────────────────────

describe('v8 flags — truthy values', () => {
  for (const truthy of ['1', 'true', 'yes', 'on', 'TRUE', 'ON']) {
    it(`flagVoiceIntent is true when env="${truthy}"`, () => {
      withEnv({ MARKIT_FEATURE_VOICE_INTENT: truthy }, () => {
        expect(flagVoiceIntent()).toBe(true)
      })
    })
  }

  it('flagLeakMonitor is true when set to "1"', () => {
    withEnv({ MARKIT_FEATURE_LEAK_MONITOR: '1' }, () => expect(flagLeakMonitor()).toBe(true))
  })

  it('flagDmcaForwarder is true when set to "true"', () => {
    withEnv({ MARKIT_FEATURE_DMCA_FORWARDER: 'true' }, () => expect(flagDmcaForwarder()).toBe(true))
  })

  it('flagBrandPersistence is true when set to "1"', () => {
    withEnv({ MARKIT_FEATURE_BRAND_PERSISTENCE: '1' }, () => expect(flagBrandPersistence()).toBe(true))
  })

  it('flagMediaPipeline is true when set to "1"', () => {
    withEnv({ MARKIT_FEATURE_MEDIA_PIPELINE: '1' }, () => expect(flagMediaPipeline()).toBe(true))
  })

  it('flagIntensityScan is true when set to "1"', () => {
    withEnv({ MARKIT_FEATURE_INTENSITY_SCAN: '1' }, () => expect(flagIntensityScan()).toBe(true))
  })
})

// ─── gate decisions ───────────────────────────────────────────────────────────

describe('gate decisions', () => {
  afterEach(() => {
    delete process.env.MARKIT_FEATURE_MEDIA_PIPELINE
    delete process.env.MARKIT_FEATURE_LEAK_MONITOR
    delete process.env.MARKIT_FEATURE_BRAND_PERSISTENCE
    delete process.env.MARKIT_FEATURE_EXPORT_API_BRIDGE
    delete process.env.MARKIT_FEATURE_INTENSITY_SCAN
  })

  it('resolveLibraryViewEnabled: false when mediaPipeline off', () => {
    expect(resolveLibraryViewEnabled()).toBe(false)
  })

  it('resolveLibraryViewEnabled: true when mediaPipeline on', () => {
    withEnv({ MARKIT_FEATURE_MEDIA_PIPELINE: '1' }, () => {
      expect(resolveLibraryViewEnabled()).toBe(true)
    })
  })

  it('resolveVaultLeakBlockEnabled: false when leakMonitor off', () => {
    expect(resolveVaultLeakBlockEnabled()).toBe(false)
  })

  it('resolveVaultLeakBlockEnabled: true when leakMonitor on', () => {
    withEnv({ MARKIT_FEATURE_LEAK_MONITOR: '1' }, () => {
      expect(resolveVaultLeakBlockEnabled()).toBe(true)
    })
  })

  it('resolveExportBrandTraceEnabled: false when both flags off', () => {
    expect(resolveExportBrandTraceEnabled()).toBe(false)
  })

  it('resolveExportBrandTraceEnabled: true when brandPersistence on', () => {
    withEnv({ MARKIT_FEATURE_BRAND_PERSISTENCE: '1' }, () => {
      expect(resolveExportBrandTraceEnabled()).toBe(true)
    })
  })

  it('resolveExportBrandTraceEnabled: true when exportApiBridge on', () => {
    withEnv({ MARKIT_FEATURE_EXPORT_API_BRIDGE: '1' }, () => {
      expect(resolveExportBrandTraceEnabled()).toBe(true)
    })
  })

  it('resolveIntensityActionsEnabled: false when intensityScan off', () => {
    expect(resolveIntensityActionsEnabled()).toBe(false)
  })

  it('resolveIntensityActionsEnabled: true when intensityScan on', () => {
    withEnv({ MARKIT_FEATURE_INTENSITY_SCAN: '1' }, () => {
      expect(resolveIntensityActionsEnabled()).toBe(true)
    })
  })
})
