import type { Metadata } from 'next'
import { TracePageClient } from './trace-page-client'

export const metadata: Metadata = {
  title: 'Trace — Markit',
  description:
    'Forensic-trace your video for one recipient. Drop the file, type the name, download a uniquely marked copy.',
}

export default function TracePage() {
  return <TracePageClient />
}
