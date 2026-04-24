import type { Metadata } from 'next'
import { MarkitHomePage } from '@/components/marketing/markit-home'

export const metadata: Metadata = {
  title: 'Markit — The Divine Editor · Circe et Venus',
  description:
    'A voice-first video and image editor for adult creators. Edit by speaking. Trace every export. Survive every leak.',
  openGraph: {
    title: 'Markit — The Divine Editor',
    description: 'Voice-first editor with Ariadne trace. Part of Circe et Venus.',
  },
}

export default function Home() {
  return <MarkitHomePage />
}
