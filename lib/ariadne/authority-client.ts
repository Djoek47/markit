import { sha256Hex } from './creatix-signing'
import { buildAriadneM2MRequestHeaders, type MarkitEmbedRequest } from './creatix-ariadne-client'

export {
  MarkitCreatixAriadneClient,
  buildAriadneM2MRequestHeaders,
  type MarkitEmbedRequest,
  type MarkitDetectRequest,
} from './creatix-ariadne-client'

/** @deprecated Use `MarkitEmbedRequest` — kept for call sites. */
export type AriadneTraceRequest = MarkitEmbedRequest

/**
 * Build M2M headers for a Creatix Ariadne path. Includes `x-creatix-actor-user-id` when
 * `CREATIX_ACTOR_USER_ID` (or `opts.actorUserId`) is set — required for Creatix service mode.
 */
export function buildServiceHeaders(
  pathname: string,
  method: string,
  bodyText: string,
  opts?: { idempotencyKey?: string; actorUserId?: string },
) {
  return buildAriadneM2MRequestHeaders({
    serviceName: 'markit',
    actorUserId: opts?.actorUserId?.trim() || process.env.CREATIX_ACTOR_USER_ID?.trim() || undefined,
    pathname,
    method,
    bodySha256: sha256Hex(bodyText),
    idempotencyKey: opts?.idempotencyKey,
    json: method.toUpperCase() === 'POST' && bodyText.length > 0,
  })
}

/**
 * Forwards a trace embed to Creatix with v1.1 M2M signing. Set `CREATIX_ACTOR_USER_ID` to the
 * creator’s Supabase user id, and `MARKIT_ARIADNE_SHARED_SECRET` to match Creatix.
 */
export async function sendTraceToCreatix(
  creatixBaseUrl: string,
  request: MarkitEmbedRequest,
  fallbackAuth?: string | null,
) {
  const pathname = '/api/ariadne/embed'
  const { idempotencyKey, ...payload } = request
  const body = JSON.stringify(payload)
  const base = creatixBaseUrl.replace(/\/+$/, '')
  const headers: Record<string, string> = {
    ...buildAriadneM2MRequestHeaders({
      serviceName: 'markit',
      actorUserId: process.env.CREATIX_ACTOR_USER_ID?.trim() || undefined,
      pathname,
      method: 'POST',
      bodySha256: sha256Hex(body),
      idempotencyKey,
      json: true,
    }),
  }
  if (fallbackAuth) headers.Authorization = fallbackAuth
  const res = await fetch(`${base}${pathname}`, { method: 'POST', headers, body })
  const text = await res.text()
  return { status: res.status, text, contentType: res.headers.get('content-type') || 'application/json' }
}
