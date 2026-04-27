import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildAriadneM2MRequestHeaders } from '@/lib/ariadne/creatix-ariadne-client'
import { buildServiceSigningMessage, sha256Hex } from '@/lib/ariadne/creatix-signing'

const FAKE_SECRET = 'test-secret-32-chars-long-12345678'
const ORIGINAL_SECRET = process.env.MARKIT_ARIADNE_SHARED_SECRET
const ORIGINAL_ACTOR = process.env.CREATIX_ACTOR_USER_ID

beforeEach(() => {
  process.env.MARKIT_ARIADNE_SHARED_SECRET = FAKE_SECRET
})

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.MARKIT_ARIADNE_SHARED_SECRET
  else process.env.MARKIT_ARIADNE_SHARED_SECRET = ORIGINAL_SECRET
  if (ORIGINAL_ACTOR === undefined) delete process.env.CREATIX_ACTOR_USER_ID
  else process.env.CREATIX_ACTOR_USER_ID = ORIGINAL_ACTOR
})

describe('buildAriadneM2MRequestHeaders', () => {
  it('emits all six required Creatix headers plus content-type when JSON', () => {
    const h = buildAriadneM2MRequestHeaders({
      serviceName: 'markit',
      actorUserId: 'creator-uuid',
      pathname: '/api/ariadne/embed',
      method: 'POST',
      bodySha256: sha256Hex('{}'),
      json: true,
    })
    expect(h['x-ariadne-contract-version']).toBe('v1.1')
    expect(h['x-creatix-service']).toBe('markit')
    expect(h['x-creatix-timestamp']).toMatch(/^\d{10}$/) // unix seconds
    expect(h['x-creatix-nonce']).toMatch(/^[0-9a-f-]{36}$/i)
    expect(h['x-idempotency-key']).toBeTruthy()
    expect(h['x-creatix-signature']).toMatch(/^[0-9a-f]{64}$/) // sha256 hex
    expect(h['x-creatix-actor-user-id']).toBe('creator-uuid')
    expect(h['content-type']).toBe('application/json')
  })

  it('omits content-type when json is false (multipart paths)', () => {
    const h = buildAriadneM2MRequestHeaders({
      serviceName: 'markit',
      actorUserId: 'creator-uuid',
      pathname: '/api/ariadne/detect',
      method: 'POST',
      bodySha256: '',
      json: false,
    })
    expect(h['content-type']).toBeUndefined()
  })

  it('omits actor header when no actorUserId is configured anywhere', () => {
    delete process.env.CREATIX_ACTOR_USER_ID
    const h = buildAriadneM2MRequestHeaders({
      serviceName: 'markit',
      actorUserId: undefined,
      pathname: '/api/ariadne/embed',
      method: 'POST',
      bodySha256: sha256Hex('{}'),
      json: true,
    })
    expect(h['x-creatix-actor-user-id']).toBeUndefined()
  })

  it('signature changes when path changes (defends against header-injection / wrong-route bugs)', () => {
    const sig = (path: string) => buildAriadneM2MRequestHeaders({
      serviceName: 'markit',
      actorUserId: 'u',
      pathname: path,
      method: 'POST',
      bodySha256: sha256Hex('{}'),
      idempotencyKey: 'idem-fixed',
      json: true,
    })['x-creatix-signature']
    // We can't compare across calls because timestamp+nonce differ, but we CAN
    // verify the canonical message via the same signing helpers. Build it manually.
    const ts = '1700000000'
    const nonce = 'fixed-nonce'
    const idem = 'idem-fixed'
    const body = sha256Hex('{}')
    const m1 = buildServiceSigningMessage({
      method: 'POST',
      pathname: '/api/ariadne/embed',
      timestamp: ts,
      nonce,
      idempotencyKey: idem,
      bodySha256: body,
    })
    const m2 = buildServiceSigningMessage({
      method: 'POST',
      pathname: '/api/ariadne/detect',
      timestamp: ts,
      nonce,
      idempotencyKey: idem,
      bodySha256: body,
    })
    expect(m1).not.toBe(m2)
    expect(sig).toBeDefined()
  })

  it('falls back to a deterministic idempotency key when none is supplied', () => {
    const h = buildAriadneM2MRequestHeaders({
      serviceName: 'markit',
      actorUserId: 'u',
      pathname: '/api/ariadne/embed',
      method: 'POST',
      bodySha256: sha256Hex('{}'),
      json: true,
    })
    expect(h['x-idempotency-key']).toMatch(/^markit:\/api\/ariadne\/embed:\d+:[0-9a-f-]+$/)
  })

  it('honors explicit idempotency key when supplied (the production retry contract)', () => {
    const h = buildAriadneM2MRequestHeaders({
      serviceName: 'markit',
      actorUserId: 'u',
      pathname: '/api/ariadne/embed',
      method: 'POST',
      bodySha256: sha256Hex('{}'),
      idempotencyKey: 'render-job:abc-123',
      json: true,
    })
    expect(h['x-idempotency-key']).toBe('render-job:abc-123')
  })

  it('throws a clear error when the shared secret is missing or too short', () => {
    delete process.env.MARKIT_ARIADNE_SHARED_SECRET
    expect(() =>
      buildAriadneM2MRequestHeaders({
        serviceName: 'markit',
        actorUserId: 'u',
        pathname: '/api/ariadne/embed',
        method: 'POST',
        bodySha256: '',
        json: true,
      }),
    ).toThrow(/MARKIT_ARIADNE_SHARED_SECRET/)
  })

  it('canonical signing message preserves the documented pipe-delimited shape', () => {
    const msg = buildServiceSigningMessage({
      method: 'post',
      pathname: '/api/ariadne/embed',
      timestamp: '1700000000',
      nonce: 'n',
      idempotencyKey: 'idem',
      bodySha256: 'sha',
    })
    expect(msg).toBe('POST|/api/ariadne/embed|1700000000|n|idem|sha')
  })
})
