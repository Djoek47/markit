import Image from 'next/image'
import type { ReactNode } from 'react'

type BrandSealProps = {
  className?: string
  size?: number
  alt?: string
  children?: ReactNode
}

const DEFAULT_SRC = '/brand/cev-seal.svg'

/**
 * CEV seal for nav and marketing — uses token-driven chrome; asset is shared SVG in `public/brand/`.
 */
export function BrandSeal({ className, size = 36, alt = 'Circe et Venus', children }: BrandSealProps) {
  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden rounded-full border bg-white shadow-md ${className ?? ''}`}
      style={{ borderColor: 'var(--border)', width: size, height: size, boxShadow: '0 0 24px color-mix(in oklch, var(--primary) 20%, transparent)' }}
    >
      <Image src={DEFAULT_SRC} alt={alt} width={size} height={size} className="h-full w-full object-contain p-0.5" />
      {children}
    </div>
  )
}
