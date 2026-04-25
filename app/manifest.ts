import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Markit — Circe et Venus',
    short_name: 'Markit',
    description:
      'Creatix Markit: voice-first video and image editing with Ariadne trace. Same account as circeetvenus.com.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    categories: ['productivity', 'video'],
    lang: 'en',
    dir: 'ltr',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
