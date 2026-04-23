import type { AgentPlan } from '@/lib/agents/orchestrator'
import type { TimelineOperation } from '@/lib/editor/timeline-model'

export function agentPlanToOperations(plan: AgentPlan, trackId = 'main'): TimelineOperation[] {
  return plan.cuts.map((cut) => ({
    op: 'add_clip' as const,
    trackId,
    clip: {
      id: crypto.randomUUID(),
      source: 'primary' as const,
      startSec: cut.startSec,
      endSec: cut.endSec,
      label: cut.rationale,
    },
  }))
}

