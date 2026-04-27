import type { Metadata } from 'next'
import { DetectPageClient } from './detect-page-client'

export const metadata: Metadata = {
  title: 'Verify a Leak — Markit',
  description: 'Drop a video. We extract its marker and tell you who it was sent to.',
}

export default function DetectPage() {
  return <DetectPageClient />
}
