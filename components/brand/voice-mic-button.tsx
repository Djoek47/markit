'use client'

import { forwardRef } from 'react'

type VoiceMicButtonProps = {
  /** Whether the microphone is actively recording */
  isListening: boolean
  /** Whether a voice response is being processed */
  isProcessing?: boolean
  onClick: () => void
  disabled?: boolean
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  'aria-label'?: string
}

const sizeMap = {
  sm: { outer: 32, icon: 12 },
  md: { outer: 44, icon: 16 },
  lg: { outer: 56, icon: 20 },
}

/**
 * Voice mic button for the Markit divine voice panel.
 * Idle: gold ring. Listening: pulsing gold ring + animated wave bars.
 * Processing: spinning circe-purple ring.
 */
export const VoiceMicButton = forwardRef<HTMLButtonElement, VoiceMicButtonProps>(
  function VoiceMicButton(
    {
      isListening,
      isProcessing = false,
      onClick,
      disabled = false,
      size = 'md',
      className,
      'aria-label': ariaLabel,
    },
    ref,
  ) {
    const { outer, icon } = sizeMap[size]

    const state = isProcessing ? 'processing' : isListening ? 'listening' : 'idle'

    const borderStyle =
      state === 'processing'
        ? '2px solid var(--circe)'
        : state === 'listening'
          ? '2px solid var(--accent)'
          : '2px solid var(--border)'

    const bgStyle =
      state === 'listening'
        ? 'radial-gradient(circle at 35% 35%, var(--accent-strong), var(--accent) 65%)'
        : state === 'processing'
          ? 'radial-gradient(circle at 35% 35%, var(--circe-light), var(--circe) 65%)'
          : 'var(--surface-2)'

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel ?? (isListening ? 'Stop listening' : 'Start voice command')}
        aria-pressed={isListening}
        className={`relative inline-flex items-center justify-center rounded-full transition-all duration-200 ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-110 active:scale-95'
        } ${className ?? ''}`}
        style={{
          width: outer,
          height: outer,
          border: borderStyle,
          background: bgStyle,
          boxShadow:
            state === 'listening'
              ? '0 0 20px color-mix(in oklch, var(--accent) 40%, transparent)'
              : state === 'processing'
                ? '0 0 16px color-mix(in oklch, var(--circe) 30%, transparent)'
                : 'none',
          animation:
            state === 'listening'
              ? 'mk-orb-pulse 2s ease-in-out infinite'
              : state === 'processing'
                ? 'mk-slow-spin 1.2s linear infinite'
                : 'none',
        }}
      >
        {/* Mic icon */}
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke={state === 'idle' ? 'var(--muted-foreground)' : 'var(--accent-foreground)'}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="2" width="6" height="11" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>

        {/* Outer pulse ring (listening only) */}
        {state === 'listening' && (
          <span
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              border: '1.5px solid color-mix(in oklch, var(--accent) 50%, transparent)',
              animation: 'mk-orb-pulse 1.8s ease-out infinite',
            }}
          />
        )}
      </button>
    )
  },
)
