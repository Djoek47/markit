/**
 * Mirrors Creatix `lib/billing/premium-divine` for Markit (browser + same Supabase).
 */
import { isPaidPlanId } from '@/lib/billing'

export function hasDivineVoicePremium(row: {
  plan_id?: string | null
  status?: string | null
  divine_voice_premium?: boolean | null
} | null | undefined): boolean {
  if (!row) return false
  if (typeof process !== 'undefined' && isGrantAllPaid() && isPaidPlanId(row.plan_id) && isActiveLike(row)) {
    return true
  }
  const st = (row.status || '').toLowerCase()
  if (st !== 'active' && st !== 'trialing') return false
  if (!isPaidPlanId(row.plan_id)) return false
  return row.divine_voice_premium === true
}

function isGrantAllPaid(): boolean {
  if (typeof process === 'undefined') return false
  return process.env.DIVINE_VOICE_GRANT_ALL_PAID === '1' || process.env.DIVINE_VOICE_GRANT_ALL_PAID === 'true'
}

function isActiveLike(row: { status?: string | null }): boolean {
  const s = (row.status || '').toLowerCase()
  return s === 'active' || s === 'trialing'
}
