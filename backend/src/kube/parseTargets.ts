import type { Target } from './types.js';

/**
 * Validates and narrows an unknown request body into a clean Target[].
 * Kept standalone so both the route handler and unit tests can use it.
 */
export function parseTargets(body: unknown): { targets: Target[] } | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Corpo inválido: esperado um objeto com "targets".' };
  }
  const raw = (body as { targets?: unknown }).targets;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: '"targets" deve ser uma lista não vazia de { cluster, namespace }.' };
  }

  const targets: Target[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { error: 'Cada target deve ser um objeto { cluster, namespace }.' };
    }
    const { cluster, namespace } = item as { cluster?: unknown; namespace?: unknown };
    if (typeof cluster !== 'string' || !cluster.trim()) {
      return { error: 'Cada target precisa de um "cluster" (string não vazia).' };
    }
    if (typeof namespace !== 'string' || !namespace.trim()) {
      return { error: 'Cada target precisa de um "namespace" (string não vazia).' };
    }
    targets.push({ cluster: cluster.trim(), namespace: namespace.trim() });
  }

  return { targets };
}
