'use client'

import { useEffect } from 'react'
import OpenReelApp from '@/vendor/openreel/web/App'

export function OpenReelEditorClient() {
  useEffect(() => {
    document.documentElement.classList.add('dark')
    if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#/welcome') {
      window.location.hash = '#/editor'
    }
  }, [])

  return (
    <div className="openreel-markit h-screen w-screen overflow-hidden bg-background text-text-primary">
      <OpenReelApp />
    </div>
  )
}
