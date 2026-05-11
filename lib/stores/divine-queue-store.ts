import { create } from 'zustand'
import type { EditorDivineUiAction } from '@/lib/markit-v5/divine-editor-actions'

export type PendingDivineItem = {
  id: string
  action: EditorDivineUiAction
  /** Human-readable summary shown in the confirm banner, e.g. "Split clip at 5.2 s" */
  description: string
  enqueuedAt: number
}

type DivineQueueState = {
  queue: PendingDivineItem[]
  /**
   * Add an action to the queue. Returns the assigned item id.
   * Duplicate action types are not coalesced — the user sees each one.
   */
  enqueue: (action: EditorDivineUiAction, description: string) => string
  /**
   * Remove an item from the queue and return it so the caller can apply it.
   * Returns null if the id is not found (already dismissed or already confirmed).
   */
  confirm: (id: string) => PendingDivineItem | null
  /** Remove without applying. */
  dismiss: (id: string) => void
  /** Flush the entire queue without applying anything. */
  dismissAll: () => void
  /** The first item in the queue (oldest), or null if empty. */
  peek: () => PendingDivineItem | null
}

export const useDivineQueueStore = create<DivineQueueState>()((set, get) => ({
  queue: [],

  enqueue(action, description) {
    const id = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    const item: PendingDivineItem = { id, action, description, enqueuedAt: Date.now() }
    set((s) => ({ queue: [...s.queue, item] }))
    return id
  },

  confirm(id) {
    const item = get().queue.find((i) => i.id === id) ?? null
    if (item) {
      set((s) => ({ queue: s.queue.filter((i) => i.id !== id) }))
    }
    return item
  },

  dismiss(id) {
    set((s) => ({ queue: s.queue.filter((i) => i.id !== id) }))
  },

  dismissAll() {
    set({ queue: [] })
  },

  peek() {
    return get().queue[0] ?? null
  },
}))
