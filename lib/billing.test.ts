import { describe, expect, it } from 'vitest'
import { isMarkitEditorEntitled, isPaidSubscription } from '@/lib/billing'

describe('isMarkitEditorEntitled', () => {
  it('allows past_due for paid plan ids', () => {
    expect(
      isMarkitEditorEntitled({ plan_id: 'cev-paid', status: 'past_due' }),
    ).toBe(true)
    expect(isPaidSubscription({ plan_id: 'cev-paid', status: 'past_due' })).toBe(false)
  })

  it('rejects trial plan', () => {
    expect(isMarkitEditorEntitled({ plan_id: 'divine-trial', status: 'active' })).toBe(false)
  })
})
