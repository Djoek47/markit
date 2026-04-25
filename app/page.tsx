import type { Metadata } from 'next'
import { MarkitHomePage } from '@/components/marketing/markit-home'

export const metadata: Metadata = {
  title: 'Markit — Creatix Studio',
  description:
    'Creatix Markit: voice-first video and image editor. Ariadne trace on exports. One account with Circe et Venus — vault, CRM, and DMs on the main app.',
  openGraph: {
    title: 'Markit — Creatix Studio',
    description: 'Voice-first editor with Ariadne trace. Same Circe et Venus account as the main app.',
  },
}

export default function Home() {
  return <MarkitHomePage />
}
