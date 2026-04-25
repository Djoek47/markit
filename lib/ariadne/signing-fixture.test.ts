import { describe, expect, it } from 'vitest'
import { buildServiceSigningMessage, sha256Hex } from '@/lib/ariadne/creatix-signing'

/**
 * Contract smoke: signing message shape is stable for service-to-service calls.
 */
describe('creatix signing helpers', () => {
  it('sha256Hex is stable for empty string', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('buildServiceSigningMessage includes pathname', () => {
    const msg = buildServiceSigningMessage({
      nonce: 'n1',
      timestamp: '1700000000',
      method: 'POST',
      pathname: '/api/ariadne/embed',
      idempotencyKey: 'id1',
      bodySha256: sha256Hex('{}'),
    })
    expect(msg).toContain('/api/ariadne/embed')
    expect(msg).toContain('POST')
  })
})
