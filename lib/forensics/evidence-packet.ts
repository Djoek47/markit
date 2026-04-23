export type EvidencePacket = {
  exportId: string
  generatedAt: string
  metadata: Record<string, unknown>
  hashes: {
    before?: string | null
    after?: string | null
    manifest?: string | null
  }
  detection: {
    matchState: string
    confidence: number
    payloadCandidates: Array<{ payloadRef: string; score: number }>
  }
  timestamps: {
    detectedAt?: string | null
    exportedAt?: string | null
  }
}

export function createEvidencePacket(input: {
  exportId: string
  metadata: Record<string, unknown>
  hashes: EvidencePacket['hashes']
  detection: EvidencePacket['detection']
  timestamps: EvidencePacket['timestamps']
}): EvidencePacket {
  return {
    exportId: input.exportId,
    generatedAt: new Date().toISOString(),
    metadata: input.metadata,
    hashes: input.hashes,
    detection: input.detection,
    timestamps: input.timestamps,
  }
}

