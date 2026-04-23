import { detectWatermarkFromSignals } from '@/lib/forensics/detectWatermark'

type Scenario = {
  name: string
  extractedBitstrings: string[]
}

const scenarios: Scenario[] = [
  { name: 'transcode_low', extractedBitstrings: ['aabbccdd1122', 'aabbccdd3344', 'aabbccdd5566'] },
  { name: 'crop_10', extractedBitstrings: ['aabbccdd8899', '001122334455', 'aabbccddff00'] },
  { name: 'blur_noise', extractedBitstrings: ['1234567890ab', 'aabbccdd0000', 'ffffeeee1111'] },
]

const knownPayloadRefs = ['payload_demo_aabbccdd', 'payload_other_xxxx']

const report = scenarios.map((s) => ({
  scenario: s.name,
  result: detectWatermarkFromSignals({
    extractedBitstrings: s.extractedBitstrings,
    knownPayloadRefs,
  }),
}))

console.log(JSON.stringify({ benchmark: 'markit_forensics', report }, null, 2))

