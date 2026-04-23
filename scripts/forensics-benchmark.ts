import { detectWatermarkFromSignals } from '@/lib/forensics/detectWatermark'

type Scenario = {
  name: string
  extractedBitstrings: string[]
}

const scenarios: Scenario[] = [
  { name: 'transcode_low', extractedBitstrings: ['a06bf1961122', 'a06bf1963344', 'a06bf1965566'] },
  { name: 'crop_10', extractedBitstrings: ['a06bf1968899', '001122334455', 'a06bf196ff00'] },
  { name: 'blur_noise', extractedBitstrings: ['1234567890ab', 'a06bf1960000', 'ffffeeee1111'] },
]

const knownPayloadRefs = ['payload_demo_aabbccdd', 'payload_other_xxxx']

const report = scenarios.map((s) => ({
  scenario: s.name,
  result: detectWatermarkFromSignals({
    extractedBitstrings: s.extractedBitstrings,
    knownPayloadRefs,
  }),
}))

const thresholds = {
  transcode_low: 0.8,
  crop_10: 0.45,
  blur_noise: 0.3,
}

let passed = true
for (const item of report) {
  const needed = thresholds[item.scenario as keyof typeof thresholds] ?? 0.4
  if (item.result.confidence < needed) passed = false
}

console.log(
  JSON.stringify(
    {
      benchmark: 'markit_forensics',
      gate: passed ? 'pass' : 'fail',
      thresholds,
      report,
    },
    null,
    2,
  ),
)

if (!passed) {
  process.exitCode = 1
}

