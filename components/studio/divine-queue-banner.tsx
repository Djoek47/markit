'use client'

import { DivineOrb } from '@/components/markit-v5/divine-orb'
import { useDivineQueueStore } from '@/lib/stores/divine-queue-store'
import type { EditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'

type Props = {
  /** Called with the confirmed action when the user clicks Apply. */
  onApply: (action: EditorDivineUiAction) => void
  /** Optional extra className for the container (e.g. for positioning). */
  className?: string
  style?: React.CSSProperties
}

/**
 * Confirm/dismiss banner for the top-most pending divine queue item.
 * Renders nothing when the queue is empty.
 */
export function DivineQueueBanner({ onApply, className, style }: Props) {
  const divineQueue = useDivineQueueStore((s) => s.queue)
  const divineConfirm = useDivineQueueStore((s) => s.confirm)
  const divineDismiss = useDivineQueueStore((s) => s.dismiss)

  const topItem = divineQueue[0] ?? null
  const extraCount = Math.max(0, divineQueue.length - 1)

  if (!topItem) return null

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
        ...style,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          fontSize: 12,
          color: 'var(--muted-foreground)',
        }}
      >
        <DivineOrb size="sm" />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--foreground)' }}>{topItem.description}</span>
          {extraCount > 0 ? (
            <span
              style={{
                marginLeft: 8,
                borderRadius: 999,
                background: 'var(--border)',
                padding: '2px 6px',
                fontSize: 10,
                color: 'var(--muted-foreground)',
              }}
            >
              +{extraCount} more
            </span>
          ) : null}
        </span>
      </span>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          className="mk-btn mk-btn-primary"
          onClick={() => {
            const item = divineConfirm(topItem.id)
            if (item) onApply(item.action)
          }}
        >
          Apply
        </button>
        <button
          type="button"
          className="mk-btn"
          onClick={() => divineDismiss(topItem.id)}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
