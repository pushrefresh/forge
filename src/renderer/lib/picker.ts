import { ipc } from './ipc';
import { useForgeStore } from '../state/store';

/**
 * Arm the in-page picker against the current active tab. Returns once the
 * user clicks an element or presses Escape.
 */
export async function armPicker(): Promise<void> {
  const store = useForgeStore.getState();
  if (store.ui.pickerArmed) return;

  const active = store.tabs.find((t) => t.active);
  if (!active) {
    store.toast('warning', 'no active tab to pick from');
    return;
  }
  if (active.url === 'forge://home') {
    store.toast('warning', 'nothing to pick on the new-tab page');
    return;
  }

  store.setPickerArmed(true);
  try {
    const pick = await ipc().picker.start(active.id);
    if (pick) {
      useForgeStore.getState().addPickedElement(pick);
    }
  } catch (err) {
    useForgeStore
      .getState()
      .toast('error', `picker failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    useForgeStore.getState().setPickerArmed(false);
  }
}

export async function cancelPicker(): Promise<void> {
  await ipc().picker.cancel();
  useForgeStore.getState().setPickerArmed(false);
}
