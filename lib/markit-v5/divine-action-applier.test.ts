import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyEditorDivineAction, makeDivineApplierContext } from '@/lib/markit-v5/divine-action-applier'
import { useEditorShellStore } from '@/lib/stores/editor-shell-store'

describe('applyEditorDivineAction', () => {
  beforeEach(() => {
    useEditorShellStore.setState({
      density: 'simple',
      mediaContext: 'video',
      playheadSec: 0,
      seekRequest: null,
      exportFormat: 'mp4',
      encoderProfile: 'markit.v1.h264',
    })
  })

  it('sets density and media context', () => {
    const setTab = vi.fn()
    applyEditorDivineAction(
      null,
      { type: 'set_density', density: 'pro' },
      makeDivineApplierContext(setTab),
    )
    expect(useEditorShellStore.getState().density).toBe('pro')
    applyEditorDivineAction(
      null,
      { type: 'set_media_context', context: 'image' },
      makeDivineApplierContext(setTab),
    )
    expect(useEditorShellStore.getState().mediaContext).toBe('image')
  })

  it('focuses inspector tab', () => {
    const setTab = vi.fn()
    applyEditorDivineAction(
      null,
      { type: 'focus_inspector', tab: 'export' },
      makeDivineApplierContext(setTab),
    )
    expect(setTab).toHaveBeenCalledWith('export')
  })
})
