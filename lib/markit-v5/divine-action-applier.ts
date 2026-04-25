import type { EditorDivineUiAction } from './divine-editor-actions'
import { useEditorShellStore } from '@/lib/stores/editor-shell-store'

type InspectorTab = 'clip' | 'crop' | 'trim' | 'export' | 'trace'

export type DivineApplierContext = {
  setInspectorTab: (t: InspectorTab) => void
}

/**
 * Apply a Divine action by mutating the editor shell Zustand store only.
 * Call `applyDivineSideEffects` after this for any React state (e.g. inspector tab) from context.
 */
export function applyEditorDivineAction(
  _state: unknown,
  action: EditorDivineUiAction,
  _ctx: DivineApplierContext,
): void {
  const store = useEditorShellStore.getState()
  switch (action.type) {
    case 'seek_playhead':
      store.requestSeek(action.sec)
      return
    case 'set_density':
      store.setDensity(action.density)
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.density = action.density
      }
      return
    case 'set_media_context':
      store.setMediaContext(action.context)
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.mediaContext = action.context
      }
      return
    case 'focus_inspector':
      _ctx.setInspectorTab(action.tab)
      return
    case 'noop':
    default:
      return
  }
}

/** Map Markit v2 tab setter to a minimal prop bag for tests / Storybook. */
export function makeDivineApplierContext(
  setTab: (t: InspectorTab) => void,
): DivineApplierContext {
  return { setInspectorTab: setTab }
}

export type { InspectorTab }