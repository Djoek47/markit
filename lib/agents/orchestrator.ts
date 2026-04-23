export type CreativeBrief = {
  objective: string
  tone?: string
  targetDurationSec?: number
  style?: string
  platform?: 'of' | 'fansly' | 'generic'
}

export type AgentCutSuggestion = {
  startSec: number
  endSec: number
  rationale: string
  intensity: 'soft' | 'medium' | 'high'
}

export type AgentPlan = {
  summary: string
  hook: string
  body: string
  cta: string
  cuts: AgentCutSuggestion[]
}

/**
 * Multi-agent style orchestration collapsed into deterministic local planner.
 * This keeps behavior predictable while providing narrative-level output.
 */
export function orchestrateBrief(brief: CreativeBrief, durationSec: number): AgentPlan {
  const d = Math.max(8, Math.min(durationSec || brief.targetDurationSec || 30, 180))
  const third = d / 3
  const cuts: AgentCutSuggestion[] = [
    { startSec: 0, endSec: third, rationale: 'Hook opener', intensity: 'high' },
    { startSec: third, endSec: 2 * third, rationale: 'Body pacing', intensity: 'medium' },
    { startSec: 2 * third, endSec: d, rationale: 'CTA close', intensity: 'soft' },
  ]
  return {
    summary: `Build a ${Math.round(d)}s ${brief.tone || 'confident'} narrative for ${brief.platform || 'generic'} audience.`,
    hook: 'Open with highest tension shot and immediate emotional anchor.',
    body: 'Maintain rhythm with quick contrast cuts and clear progression.',
    cta: 'Close with a direct invitation to continue in DM/PPV flow.',
    cuts,
  }
}

