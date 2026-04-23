import { createHmac } from 'crypto'

export function buildOpaquePayloadId(input: { userId: string; recipientKey: string; contentId: string; secret: string }) {
  return createHmac('sha256', input.secret)
    .update(`${input.userId}|${input.recipientKey}|${input.contentId}`, 'utf8')
    .digest('hex')
}

export function buildAriadnePayloadMapRow(input: {
  userId: string
  recipientKey: string
  contentId: string
  source: 'vault_standalone' | 'frame_export' | 'message_send' | 'mass_dm'
}) {
  const secret = process.env.MARKIT_ARIADNE_SHARED_SECRET || process.env.FRAME_EXPORT_SECRET || 'markit-dev-secret'
  const payloadId = buildOpaquePayloadId({
    userId: input.userId,
    recipientKey: input.recipientKey,
    contentId: input.contentId,
    secret,
  })
  return {
    payloadId,
    source: input.source,
    contentId: input.contentId,
    // keep identity authority external (Creatix)
    recipientOpaqueRef: payloadId.slice(0, 24),
  }
}

