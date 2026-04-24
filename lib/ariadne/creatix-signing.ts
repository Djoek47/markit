/**
 * HMAC + SHA-256 signing for M2M Ariadne calls — must match Creatix
 * `lib/ariadne/service-auth.ts` (v1.1 contract).
 */
import { createHash, createHmac } from 'crypto'

export const ARIADNE_CONTRACT_VERSION = 'v1.1'

function getServiceSecret(): string {
  const secret = process.env.MARKIT_ARIADNE_SHARED_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('MARKIT_ARIADNE_SHARED_SECRET must be configured (min 16 chars)')
  }
  return secret
}

export function sha256Hex(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function buildServiceSigningMessage(input: {
  method: string
  pathname: string
  timestamp: string
  nonce: string
  idempotencyKey: string
  bodySha256: string
}): string {
  return [
    input.method.toUpperCase(),
    input.pathname,
    input.timestamp,
    input.nonce,
    input.idempotencyKey,
    input.bodySha256,
  ].join('|')
}

export function signServiceMessage(message: string): string {
  return createHmac('sha256', getServiceSecret()).update(message).digest('hex')
}
