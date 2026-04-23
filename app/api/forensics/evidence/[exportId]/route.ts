import { NextRequest, NextResponse } from 'next/server'
import { createEvidencePacket } from '@/lib/forensics/evidence-packet'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const { exportId } = await params
  const creatix = (process.env.NEXT_PUBLIC_CREATIX_APP_URL || 'https://www.circeetvenus.com').replace(/\/$/, '')
  const auth = request.headers.get('authorization')
  const cookie = request.headers.get('cookie')

  const upstream = await fetch(`${creatix}/api/ariadne/evidence/${exportId}?format=packet`, {
    method: 'GET',
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  })
  const data = (await upstream.json().catch(() => null)) as
    | {
        packet?: {
          export?: Record<string, unknown>
          hashes?: { before_sha256?: string; after_sha256?: string; payload_manifest_sha256?: string }
          payload_verification?: { evidence_generated_at?: string }
        }
      }
    | null

  if (!upstream.ok || !data?.packet) {
    return NextResponse.json({ error: 'Could not load evidence packet from Creatix' }, { status: upstream.status || 502 })
  }

  const packet = createEvidencePacket({
    exportId,
    metadata: data.packet.export || {},
    hashes: {
      before: data.packet.hashes?.before_sha256 || null,
      after: data.packet.hashes?.after_sha256 || null,
      manifest: data.packet.hashes?.payload_manifest_sha256 || null,
    },
    detection: {
      matchState: 'unknown',
      confidence: 0,
      payloadCandidates: [],
    },
    timestamps: {
      exportedAt: typeof data.packet.export?.created_at === 'string' ? data.packet.export.created_at : null,
      detectedAt:
        typeof data.packet.payload_verification?.evidence_generated_at === 'string'
          ? data.packet.payload_verification.evidence_generated_at
          : null,
    },
  })

  return NextResponse.json({
    packetFormat: 'markit-forensics-evidence-v1',
    packet,
  })
}

