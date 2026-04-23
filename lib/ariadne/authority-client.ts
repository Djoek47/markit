import { createHmac, createHash, randomUUID } from 'crypto'

export type AriadneTraceRequest = {
  contentId: string
  recipientKey: string
  source: 'vault_standalone' | 'frame_export' | 'message_send' | 'mass_dm'
  lineage?: { jobId?: string; pipelineVersion?: string; encoderProfile?: string }
}

function sharedSecret(): string {
  return process.env.MARKIT_ARIADNE_SHARED_SECRET || ''
}

function signServiceMessage(parts: string[]): string {
  return createHmac('sha256', sharedSecret()).update(parts.join('|')).digest('hex')
}

function bodySha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function buildServiceHeaders(pathname: string, method: string, bodyText: string) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const nonce = randomUUID()
  const idempotencyKey = `markit:${pathname}:${timestamp}:${nonce}`
  const message = [method.toUpperCase(), pathname, timestamp, nonce, idempotencyKey, bodySha256(bodyText)]
  const signature = signServiceMessage(message)
  return {
    'x-ariadne-contract-version': 'v1.1',
    'x-creatix-service': 'markit',
    'x-creatix-timestamp': timestamp,
    'x-creatix-nonce': nonce,
    'x-idempotency-key': idempotencyKey,
    'x-creatix-signature': signature,
  }
}

export async function sendTraceToCreatix(
  creatixBaseUrl: string,
  request: AriadneTraceRequest,
  fallbackAuth?: string | null,
) {
  const pathname = '/api/ariadne/embed'
  const body = JSON.stringify(request)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...buildServiceHeaders(pathname, 'POST', body),
  }
  if (fallbackAuth) headers.Authorization = fallbackAuth
  const res = await fetch(`${creatixBaseUrl}${pathname}`, {
    method: 'POST',
    headers,
    body,
  })
  const text = await res.text()
  return { status: res.status, text, contentType: res.headers.get('content-type') || 'application/json' }
}

