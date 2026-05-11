import { beforeEach, describe, expect, it } from 'vitest'
import { useDivineQueueStore } from './divine-queue-store'

beforeEach(() => {
  useDivineQueueStore.setState({ queue: [] })
})

describe('divine-queue-store', () => {
  it('starts empty', () => {
    expect(useDivineQueueStore.getState().queue).toHaveLength(0)
    expect(useDivineQueueStore.getState().peek()).toBeNull()
  })

  it('enqueue adds item and returns id', () => {
    const id = useDivineQueueStore
      .getState()
      .enqueue({ type: 'split_segment', splitAtSec: 5 }, 'Split at 5s')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    const q = useDivineQueueStore.getState().queue
    expect(q).toHaveLength(1)
    expect(q[0].id).toBe(id)
    expect(q[0].description).toBe('Split at 5s')
  })

  it('peek returns the first item (FIFO)', () => {
    useDivineQueueStore.getState().enqueue({ type: 'split_segment', splitAtSec: 1 }, 'First')
    useDivineQueueStore.getState().enqueue({ type: 'split_segment', splitAtSec: 2 }, 'Second')
    const top = useDivineQueueStore.getState().peek()
    expect(top?.description).toBe('First')
  })

  it('confirm removes item and returns it', () => {
    const id = useDivineQueueStore
      .getState()
      .enqueue({ type: 'remove_segment', segmentId: 'abc' }, 'Remove clip')
    const confirmed = useDivineQueueStore.getState().confirm(id)
    expect(confirmed?.id).toBe(id)
    expect(useDivineQueueStore.getState().queue).toHaveLength(0)
  })

  it('confirm returns null for unknown id', () => {
    expect(useDivineQueueStore.getState().confirm('does-not-exist')).toBeNull()
  })

  it('dismiss removes item without returning it', () => {
    const id = useDivineQueueStore
      .getState()
      .enqueue({ type: 'noop' }, 'Noop')
    useDivineQueueStore.getState().dismiss(id)
    expect(useDivineQueueStore.getState().queue).toHaveLength(0)
  })

  it('dismissAll clears the entire queue', () => {
    useDivineQueueStore.getState().enqueue({ type: 'noop' }, 'A')
    useDivineQueueStore.getState().enqueue({ type: 'noop' }, 'B')
    useDivineQueueStore.getState().enqueue({ type: 'noop' }, 'C')
    useDivineQueueStore.getState().dismissAll()
    expect(useDivineQueueStore.getState().queue).toHaveLength(0)
    expect(useDivineQueueStore.getState().peek()).toBeNull()
  })

  it('preserves FIFO order across multiple enqueues', () => {
    const ids = ['a', 'b', 'c'].map((label, i) =>
      useDivineQueueStore.getState().enqueue({ type: 'seek_playhead', sec: i }, label),
    )
    const q = useDivineQueueStore.getState().queue
    expect(q.map((item) => item.description)).toEqual(['a', 'b', 'c'])
    expect(q.map((item) => item.id)).toEqual(ids)
  })

  it('confirm on an already-confirmed id is a no-op (idempotent)', () => {
    const id = useDivineQueueStore.getState().enqueue({ type: 'noop' }, 'test')
    useDivineQueueStore.getState().confirm(id)
    expect(useDivineQueueStore.getState().confirm(id)).toBeNull()
    expect(useDivineQueueStore.getState().queue).toHaveLength(0)
  })
})
