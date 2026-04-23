import type { Metadata } from 'next'
import { Cinzel, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  weight: ['400', '500', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
})

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Markit (Beta) — Circe et Venus',
  description:
    'Beta video editor for vault assets — trim, export, AI assist, Ariadne Trace. Features and behavior may change.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${cinzel.variable} ${jetBrainsMono.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
