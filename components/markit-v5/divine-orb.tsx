import type { ReactNode } from 'react'

type DivineOrbProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
}

const sizePx = { sm: 12, md: 20, lg: 40 }

/**
 * Pulsing orb accent for Divine UI; colors come from CSS variables only.
 */
export function DivineOrb({ className, size = 'md', children }: DivineOrbProps) {
  const px = sizePx[size]
  return (
    <div
      className={`divine-orb relative inline-flex items-center justify-center rounded-full ${className ?? ''}`}
      style={{
        width: px,
        height: px,
        background:
          'radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 55%, white), color-mix(in oklch, var(--circe) 40%, var(--background)))',
        boxShadow: '0 0 12px color-mix(in oklch, var(--primary) 35%, transparent)',
        animation: 'mkt-orb-pulse 2.4s ease-in-out infinite',
      }}
    >
      {children}
    </div>
  )
}
