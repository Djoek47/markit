// ─── Embed-confirm contract — signed lineage payload sent to Creatix ─────────

import type { TraceLayers, TracePlatform } from './trace-contract'
import type { BrandSnapshot } from './brand-contract'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmbedConfirmLineage = {
  /** Unique job ID assigned by Markit's render pipeline. */
  jobId: string
  /** Semver of the Markit render pipeline used (e.g. "1.0.0"). */
  pipelineVersion: string
  /** Encoder profile key (e.g. "markit.v1.h264"). */
  encoderProfile: string
  /** Source media IDs that were composited for this render. */
  sourceMediaIds: string[]
  /** SHA-256 hex of the rendered output file. */
  renderedSha256: string
  /** Size of the rendered output in bytes. */
  renderedSizeBytes: number
}

export type EmbedConfirmRecipient = {
  /** Display label for this recipient (immutable, not a Creatix user ID). */
  label: string
  platform?: TracePlatform
  platformId?: string
}

export type EmbedConfirmRequest = {
  lineage: EmbedConfirmLineage
  recipient: EmbedConfirmRecipient
  watermarkLayers: TraceLayers
  /** Pre-signed URL where Creatix can download the rendered file for embedding. */
  renderedFileUrl: string
  /** ISO 8601 timestamp after which renderedFileUrl is no longer valid. */
  renderedFileExpiresAt: string
  brand?: BrandSnapshot
}

export type EmbedConfirmSuccess = {
  ok: true
  exportId: string
  payloadId: string
  downloadUrl: string
  contractVersion: string
}

export type EmbedConfirmError = {
  ok: false
  error: { code: string; message: string }
}

export type EmbedConfirmResponse = EmbedConfirmSuccess | EmbedConfirmError

export type EmbedConfirmRequestValid = { ok: true; request: EmbedConfirmRequest }
export type EmbedConfirmRequestInvalid = { ok: false; details: string[] }
export type EmbedConfirmRequestResult = EmbedConfirmRequestValid | EmbedConfirmRequestInvalid

// ─── Validator ────────────────────────────────────────────────────────────────

function validateLineage(v: unknown, issues: string[]): boolean {
  if (v === null || typeof v !== 'object') { issues.push('lineage must be a non-null object'); return false }
  const l = v as Record<string, unknown>
  if (typeof l.jobId !== 'string' || !l.jobId) issues.push('lineage.jobId must be a non-empty string')
  if (typeof l.pipelineVersion !== 'string' || !l.pipelineVersion) issues.push('lineage.pipelineVersion must be a non-empty string')
  if (typeof l.encoderProfile !== 'string' || !l.encoderProfile) issues.push('lineage.encoderProfile must be a non-empty string')
  if (!Array.isArray(l.sourceMediaIds) || (l.sourceMediaIds as unknown[]).some((id) => typeof id !== 'string')) {
    issues.push('lineage.sourceMediaIds must be a string[]')
  }
  if (typeof l.renderedSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(l.renderedSha256)) {
    issues.push('lineage.renderedSha256 must be a 64-char hex string')
  }
  if (typeof l.renderedSizeBytes !== 'number' || !Number.isFinite(l.renderedSizeBytes) || l.renderedSizeBytes <= 0) {
    issues.push('lineage.renderedSizeBytes must be a positive finite number')
  }
  return true
}

function validateRecipient(v: unknown, issues: string[]): boolean {
  if (v === null || typeof v !== 'object') { issues.push('recipient must be a non-null object'); return false }
  const r = v as Record<string, unknown>
  if (typeof r.label !== 'string' || !r.label.trim()) issues.push('recipient.label must be a non-empty string')
  if (r.platform !== undefined) {
    const platforms = ['onlyfans', 'fansly', 'manyvids', 'custom']
    if (!platforms.includes(r.platform as string)) {
      issues.push(`recipient.platform must be one of: ${platforms.join(', ')}`)
    }
  }
  if (r.platformId !== undefined && typeof r.platformId !== 'string') {
    issues.push('recipient.platformId must be a string when present')
  }
  return true
}

function validateTraceLayers(v: unknown, prefix: string, issues: string[]): boolean {
  if (v === null || typeof v !== 'object') { issues.push(`${prefix} must be a non-null object`); return false }
  const l = v as Record<string, unknown>
  if (typeof l.spatialGrid !== 'boolean') issues.push(`${prefix}.spatialGrid must be boolean`)
  if (typeof l.temporalRedundancy !== 'boolean') issues.push(`${prefix}.temporalRedundancy must be boolean`)
  if (typeof l.metadataAppend !== 'boolean') issues.push(`${prefix}.metadataAppend must be boolean`)
  return true
}

export function validateEmbedConfirmRequest(value: unknown): EmbedConfirmRequestResult {
  const issues: string[] = []

  if (value === null || typeof value !== 'object') {
    return { ok: false, details: ['EmbedConfirmRequest must be a non-null object'] }
  }

  const o = value as Record<string, unknown>

  validateLineage(o.lineage, issues)
  validateRecipient(o.recipient, issues)
  validateTraceLayers(o.watermarkLayers, 'watermarkLayers', issues)

  if (typeof o.renderedFileUrl !== 'string' || !o.renderedFileUrl) {
    issues.push('renderedFileUrl must be a non-empty string')
  }
  if (typeof o.renderedFileExpiresAt !== 'string' || !o.renderedFileExpiresAt) {
    issues.push('renderedFileExpiresAt must be a non-empty string')
  }
  // brand is optional; if present it must be an object (full validation deferred to brand-contract)
  if (o.brand !== undefined && (o.brand === null || typeof o.brand !== 'object')) {
    issues.push('brand must be an object when present')
  }

  if (issues.length > 0) return { ok: false, details: issues }

  const l = o.lineage as Record<string, unknown>
  const r = o.recipient as Record<string, unknown>
  const wl = o.watermarkLayers as Record<string, boolean>

  return {
    ok: true,
    request: {
      lineage: {
        jobId: l.jobId as string,
        pipelineVersion: l.pipelineVersion as string,
        encoderProfile: l.encoderProfile as string,
        sourceMediaIds: l.sourceMediaIds as string[],
        renderedSha256: l.renderedSha256 as string,
        renderedSizeBytes: l.renderedSizeBytes as number,
      },
      recipient: {
        label: (r.label as string).trim(),
        ...(r.platform !== undefined ? { platform: r.platform as TracePlatform } : {}),
        ...(typeof r.platformId === 'string' ? { platformId: r.platformId } : {}),
      },
      watermarkLayers: {
        spatialGrid: wl.spatialGrid,
        temporalRedundancy: wl.temporalRedundancy,
        metadataAppend: wl.metadataAppend,
      },
      renderedFileUrl: o.renderedFileUrl as string,
      renderedFileExpiresAt: o.renderedFileExpiresAt as string,
      ...(o.brand !== undefined ? { brand: o.brand as BrandSnapshot } : {}),
    },
  }
}
