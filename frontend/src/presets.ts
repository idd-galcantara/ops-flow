import type { Target } from './types';

/** A saved combination of targets, e.g. "QA overdraft = tb + gt". */
export interface Preset {
  id: string;
  name: string;
  targets: Target[];
}

const STORAGE_KEY = 'ops-flow.presets.v1';

/**
 * Presets live in localStorage: ops-flow is a local tool with no backend state,
 * and losing them would only cost a few clicks to rebuild.
 */
export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPreset);
  } catch {
    // Corrupted or unavailable storage must never break the app.
    return [];
  }
}

export function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage full or blocked; presets simply won't persist this session.
  }
}

/** Validates untrusted data coming back from storage. */
function isPreset(value: unknown): value is Preset {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { id?: unknown; name?: unknown; targets?: unknown };
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return false;
  if (!Array.isArray(candidate.targets)) return false;
  return candidate.targets.every(
    (t) =>
      t &&
      typeof t === 'object' &&
      typeof (t as Target).cluster === 'string' &&
      typeof (t as Target).namespace === 'string',
  );
}

/** Builds a preset with a stable, collision-resistant id. */
export function createPreset(name: string, targets: Target[]): Preset {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    targets: targets.map((t) => ({ cluster: t.cluster, namespace: t.namespace })),
  };
}

/** Short human summary, e.g. "2 clusters · bank-overdraft". */
export function describePreset(preset: Preset): string {
  const clusters = new Set(preset.targets.map((t) => t.cluster));
  const namespaces = [...new Set(preset.targets.map((t) => t.namespace))];
  const clusterPart = `${clusters.size} cluster${clusters.size === 1 ? '' : 's'}`;
  const namespacePart =
    namespaces.length === 1 ? namespaces[0] : `${namespaces.length} namespaces`;
  return `${clusterPart} · ${namespacePart}`;
}
