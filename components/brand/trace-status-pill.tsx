import type { ReactNode } from 'react'

export type TraceStatus = 'none' | 'pending' | 'ready' | 'error'

type TraceStatusPillProps = {
  status: TraceStatus
  /** Recipient label when status === 'ready' */
  recipientLabel?: string
  /** Short payload ID chip shown alongside 'ready' status */
  payloadId?: string
  className?: string
}

const config: Record<
  TraceStatus,
  { label: string; dot: string; border: string; bg: string; text: string }
> = {
  none: {
    label: 'No trace',
    dot: 'var(--muted-faint)',
    border: 'var(--border)',
    bg: 'var(--surface-2)',
    text: 'var(--muted-foreground)',
  },
  pending: {
    label: 'Embedding…',
    dot: 'var(--accent)',
    border: 'color-mix(in oklch, var(--accent) 45%, transparent)',
    bg: 'var(--accent-soft)',
    text: 'var(--accent)',
  },
  ready: {
    label: 'Traced',
    dot: 'var(--success)',
    border: 'color-mix(in oklch, var(--success) 45%, transparent)',
    bg: 'color-mix(in oklch, var(--success) 10%, transparent)',
    text: 'var(--success)',
  },
  error: {
    label: 'Trace failed',
    dot: 'var(--destructive)',
    border: 'color-mix(in oklch, var(--destructive) 45%, transparent)',
    bg: 'color-mix(in oklch, var(--destructive) 10%, transparent)',
    text: 'var(--destructive)',
  },
}

/**
 * Compact status pill indicating Ariadne trace state on a clip or export.
 * Gold = pending/ready. Green = confirmed. Red = error. Grey = none.
 */
export function TraceStatusPill({
  status,
  recipientLabel,
  payloadId,
  className,
}: TraceStatusPillProps) {
  const c = config[status]
  const displayLabel =
    status === 'ready' && recipientLabel ? `Traced → ${recipientLabel}` : c.label

  return (
    <span
      role="status"
      aria-label={`Trace status: ${displayLabel}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-wider uppercase leading-none ${className ?? ''}`}
      style={{
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.text,
        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
      }}
    >
      {/* Status dot */}
      <span
        className="inline-block rounded-full flex-shrink-0"
        style={{
          width: 5,
          height: 5,
          background: c.dot,
          animation: status === 'pending' ? 'mkt-breathe 1.2s ease-in-out infinite' : 'none',
        }}
        aria-hidden="true"
      />

      {displayLabel}

      {/* Payload ID chip */}
      {status === 'ready' && payloadId && (
        <PayloadChip id={payloadId} />
      )}
    </span>
  )
}

function PayloadChip({ id }: { id: string }) {
  const short = id.length > 8 ? id.slice(0, 8) : id
  return (
    <span
      className="inline-flex items-center rounded px-1"
      style={{
        background: 'color-mix(in oklch, var(--success) 18%, transparent)',
        border: '1px solid color-mix(in oklch, var(--success) 30%, transparent)',
        color: 'var(--success)',
        fontSize: 9,
        letterSpacing: '0.1em',
        fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
      }}
      title={id}
    >
      {short}
    </span>
  )
}
