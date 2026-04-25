import type { Metadata, Viewport } from 'next'
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
  weight: ['300', '400', '500', '600'],
})

export const dynamic = 'force-dynamic'

const appUrl = process.env.NEXT_PUBLIC_MARKIT_APP_URL || 'http://localhost:3020'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: 'Markit',
  title: {
    default: 'Markit — Creatix Studio · Circe et Venus',
    template: '%s · Markit',
  },
  description:
    'Creatix Markit: voice-first video and image editor for adult creators. Ariadne trace on every export. Same account and branding as circeetvenus.com.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Markit',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
