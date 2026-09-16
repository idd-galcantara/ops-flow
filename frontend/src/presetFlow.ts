import type { Preset } from './presets';

interface PresetApplyStore {
  presets: Pick<Preset, 'id'>[];
  applyPreset: (id: string) => void;
  loadPods: () => Promise<void>;
}

export async function applyPresetAndLoad(
  id: string,
  getStore: () => PresetApplyStore,
  onSettled: () => void,
): Promise<boolean> {
  const store = getStore();
  if (!store.presets.some((preset) => preset.id === id)) return false;

  store.applyPreset(id);
  try {
    await getStore().loadPods();
  } finally {
    onSettled();
  }
  return true;
}