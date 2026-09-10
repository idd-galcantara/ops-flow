import type { Target } from './types.js';

/**
 * Validates and narrows an unknown request body into a clean Target[].
 * Kept standalone so both the route handler and unit tests can use it.
 */
export function parseTargets(body: unknown): { targets: Target[] } | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid body: expected an object with "targets".' };
  }
  const raw = (body as { targets?: unknown }).targets;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: '"targets" must be a non-empty list of { cluster, namespace }.' };
  }

  const targets: Target[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { error: 'Each target must be an object { cluster, namespace }.' };
    }
    const { cluster, namespace } = item as { cluster?: unknown; namespace?: unknown };
    if (typeof cluster !== 'string' || !cluster.trim()) {
      return { error: 'Each target needs a "cluster" (non-empty string).' };
    }
    if (typeof namespace !== 'string' || !namespace.trim()) {
      return { error: 'Each target needs a "namespace" (non-empty string).' };
    }
    targets.push({ cluster: cluster.trim(), namespace: namespace.trim() });
  }

  return { targets };
}
