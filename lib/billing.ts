/** Mirrors Creatix `lib/billing/access.ts` for client-side entitlement checks. */
export const PAID_PLAN_ID = 'cev-paid'
export const LEGACY_PAID_PLAN_IDS = ['venus-pro', 'circe-elite', 'divine-duo'] as const

export function isPaidPlanId(planId: string | null | undefined): boolean {
  if (!planId) return false
  const p = planId.toLowerCase()
  if (p === PAID_PLAN_ID) return true
  return LEGACY_PAID_PLAN_IDS.some((x) => x === p)
}

export function isPaidSubscription(row: {
  plan_id?: string | null
  status?: string | null
} | null): boolean {
  if (!row?.plan_id) return false
  const st = (row.status || '').toLowerCase()
  if (st !== 'active' && st !== 'trialing') return false
  return isPaidPlanId(row.plan_id)
}
