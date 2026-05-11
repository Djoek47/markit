'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { MediaRow } from '@/db/schema'

type LibraryClientProps = {
  initialItems: MediaRow[]
  userId: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDuration(sec: string | null): string {
  if (!sec) return ''
  const s = parseFloat(sec)
  if (isNaN(s)) return ''
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

const KIND_ICON: Record<string, string> = { video: '▶', image: '◼', audio: '♫' }

export function LibraryClient({ initialItems, userId: _userId }: LibraryClientProps) {
  const router = useRouter()
  const [items] = useState<MediaRow[]>(initialItems)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = query.trim()
    ? items.filter((m) =>
        m.source_path.toLowerCase().includes(query.toLowerCase()) ||
        m.kind.toLowerCase().includes(query.toLowerCase()) ||
        m.codec?.toLowerCase().includes(query.toLowerCase()),
      )
    : items

  const toggleSelect = useCallback((id: string, multi: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (multi) {
        next.has(id) ? next.delete(id) : next.add(id)
      } else {
        if (next.size === 1 && next.has(id)) {
          next.clear()
        } else {
          next.clear()
          next.add(id)
        }
      }
      return next
    })
  }, [])

  const selectAll = () => setSelected(new Set(filtered.map((m) => m.id)))
  const clearAll = () => setSelected(new Set())

  const handleCreateWithAI = () => {
    if (selected.size === 0) return
    const ids = [...selected].join(',')
    startTransition(() => {
      router.push(`/editor?view=edit&from=library&ids=${ids}`)
    })
  }

  return (
    <div
      className="markit-shell flex flex-col min-h-screen"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      {/* Header */}
      <header className="mk-header">
        <div className="mk-h-left">
          <span className="mk-brand">
            Markit <span className="mk-sep">·</span>
          </span>
          <span
            style={{
              fontFamily: 'var(--font-cinzel), serif',
              fontSize: 15,
              fontStyle: 'italic',
              color: 'var(--accent)',
            }}
          >
            Library
          </span>
        </div>

        <div className="mk-h-right">
          <button className="mk-btn" onClick={() => router.push('/editor')}>
            ← Editor
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--sidebar)',
        }}
      >
        {/* Search */}
        <div
          className="mk-lib-search"
          style={{ flex: 1, maxWidth: 380, margin: 0 }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search media…"
            style={{ fontSize: 12, color: 'var(--foreground)' }}
          />
        </div>

        <span
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 9,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
          }}
        >
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </span>

        {filtered.length > 0 && (
          <button className="mk-btn mk-btn-ghost" style={{ fontSize: 11 }} onClick={selectAll}>
            Select all
          </button>
        )}
        {selected.size > 0 && (
          <button className="mk-btn mk-btn-ghost" style={{ fontSize: 11 }} onClick={clearAll}>
            Clear
          </button>
        )}
      </div>

      {/* Grid */}
      <main style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 280,
              gap: 12,
            }}
          >
            <span style={{ fontSize: 32, opacity: 0.3 }}>◼</span>
            <p
              style={{
                fontFamily: 'var(--font-cinzel), serif',
                fontStyle: 'italic',
                color: 'var(--muted-foreground)',
                fontSize: 15,
              }}
            >
              {query ? 'No media matches your search.' : 'No media yet — upload something to get started.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            {filtered.map((item) => {
              const isSelected = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => toggleSelect(item.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--surface-1)',
                    border: isSelected
                      ? '1.5px solid var(--accent)'
                      : '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.12s, background 0.12s',
                    outline: 'none',
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      background: 'linear-gradient(135deg, var(--surface-3), var(--surface-2))',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 22,
                      color: isSelected ? 'var(--accent)' : 'var(--muted-faint)',
                    }}
                  >
                    {KIND_ICON[item.kind] ?? '◼'}
                  </div>

                  {/* Meta */}
                  <div style={{ padding: '8px 10px', flex: 1 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 9,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: isSelected ? 'var(--accent)' : 'var(--muted-foreground)',
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.kind}
                      {item.codec ? ` · ${item.codec}` : ''}
                    </p>

                    <p
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 9,
                        color: 'var(--muted-faint)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {formatBytes(item.source_size_bytes)}
                      {item.duration_sec ? ` · ${formatDuration(item.duration_sec)}` : ''}
                    </p>

                    {item.width && item.height ? (
                      <p
                        style={{
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                          fontSize: 9,
                          color: 'var(--muted-faint)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {item.width}×{item.height}
                      </p>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {/* Floating "Create with AI" bar — appears when items are selected */}
      {selected.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 20px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            boxShadow: 'var(--shadow-soft)',
            zIndex: 50,
            animation: 'mkt-fade-in 0.15s ease',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--muted-foreground)',
            }}
          >
            {selected.size} selected
          </span>

          <button
            className="mk-btn mk-btn-ghost"
            style={{ fontSize: 11 }}
            onClick={clearAll}
          >
            Clear
          </button>

          <button
            className="mk-btn mk-btn-primary"
            style={{ fontSize: 11, gap: 6 }}
            onClick={handleCreateWithAI}
            disabled={isPending}
          >
            {isPending ? 'Opening…' : '✦ Create with AI'}
          </button>
        </div>
      )}
    </div>
  )
}
