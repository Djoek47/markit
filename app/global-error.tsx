'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
        <pre style={{ fontSize: 12, opacity: 0.8 }}>{error.message}</pre>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  )
}
