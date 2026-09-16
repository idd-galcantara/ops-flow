import type { Target } from './types';

/** A saved combination of targets, e.g. "QA overdraft = tb + gt". */
export interface Preset {
  id: string;
  name: string;
  description?: string;
  targets: Target[];
  lastUsedAt?: number;
}

const STORAGE_KEY = 'ops-union.presets.v1';

/** Loads the web fallback. Desktop hydration uses the Electron data directory. */
export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePreset).filter((preset): preset is Preset => preset !== null);
  } catch {
    // Corrupted or unavailable storage must never break the app.
    return [];
  }
}

export function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage full or blocked; the desktop store can still persist independently.
  }

  if (typeof window !== 'undefined' && window.opsFlowDesktop) {
    void window.opsFlowDesktop.savePresets(presets).catch(() => undefined);
  }
}

/** Loads the stable desktop store, falling back to localStorage in web mode. */
export async function loadPersistentPresets(): Promise<Preset[]> {
  if (typeof window !== 'undefined' && window.opsFlowDesktop) {
    try {
      const presets = await window.opsFlowDesktop.loadPresets();
      return presets.map(normalizePreset).filter((preset): preset is Preset => preset !== null);
    } catch {
      // A missing or unreadable desktop store should not break the UI.
    }
  }
  return loadPresets();
}

/** Validates untrusted data coming back from storage. */
function isPreset(value: unknown): value is Preset {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    targets?: unknown;
    lastUsedAt?: unknown;
  };
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return false;
  if (candidate.description !== undefined && typeof candidate.description !== 'string') return false;
  if (!Array.isArray(candidate.targets)) return false;
  return candidate.targets.every(
    (t) =>
      t &&
      typeof t === 'object' &&
      typeof (t as Target).cluster === 'string' &&
      typeof (t as Target).namespace === 'string',
  );
}

function normalizePreset(value: unknown): Preset | null {
  if (!isPreset(value)) return null;
  if (value.lastUsedAt === undefined || isValidUsageTimestamp(value.lastUsedAt)) return value;
  const { lastUsedAt: _ignored, ...legacyPreset } = value;
  return legacyPreset;
}

function isValidUsageTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Builds a preset with a stable, collision-resistant id. */
export function createPreset(name: string, targets: Target[], description = ''): Preset {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    ...(description.trim() ? { description: description.trim() } : {}),
    targets: targets.map((t) => ({ cluster: t.cluster, namespace: t.namespace })),
  };
}

/** Short human summary, e.g. "2 clusters · bank-overdraft". */
export function describePreset(preset: Preset): string {
  const clusters = new Set(preset.targets.map((t) => t.cluster));
  const namespaces = [...new Set(preset.targets.map((t) => t.namespace))];
  const clusterPart = `${clusters.size} cluster${clusters.size === 1 ? '' : 's'}`;
  const namespacePart = namespaces.length === 1 ? namespaces[0] : `${namespaces.length} namespaces`;
  return `${clusterPart} · ${namespacePart}`;
}

/** Orders recent presets first while preserving the original order for ties. */
export function orderPresetsByRecentUse(presets: Preset[]): Preset[] {
  return presets
    .map((preset, index) => ({ preset, index }))
    .sort((left, right) => {
      const leftUsage = left.preset.lastUsedAt ?? -Infinity;
      const rightUsage = right.preset.lastUsedAt ?? -Infinity;
      return rightUsage - leftUsage || left.index - right.index;
    })
    .map(({ preset }) => preset);
}

/** Returns a new preset collection with one valid preset marked as recently used. */
export function markPresetUsed(
  presets: Preset[],
  id: string,
  lastUsedAt = Date.now(),
): Preset[] {
  if (!isValidUsageTimestamp(lastUsedAt) || !presets.some((preset) => preset.id === id)) {
    return presets;
  }
  return presets.map((preset) =>
    preset.id === id ? { ...preset, lastUsedAt } : preset,
  );
}
