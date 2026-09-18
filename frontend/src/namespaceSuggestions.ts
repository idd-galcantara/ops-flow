import type { NamespaceInfo } from './types';

/** Allows a manually entered namespace when discovery is unavailable. */
export function canUseManualNamespace(
  namespaces: NamespaceInfo[],
  namespacesReady: boolean,
  namespacesError?: string,
): boolean {
  return namespacesReady && namespaces.length === 0 && Boolean(namespacesError);
}

/** Suggestions shown at once. Clusters here can hold ~2000 namespaces. */
export const MAX_SUGGESTIONS = 40;

export interface NamespaceSuggestion extends NamespaceInfo {
  /** True when the namespace exists in every selected cluster. */
  inAllClusters: boolean;
}

/** Returns whether the trimmed value names a namespace from the loaded list. */
export function hasExactNamespaceMatch(namespaces: NamespaceInfo[], value: string): boolean {
  const name = value.trim();
  return name.length > 0 && namespaces.some((namespace) => namespace.name === name);
}

/**
 * Filters and ranks namespace suggestions for the typed query.
 *
 * Ranking favours what the user is most likely reaching for:
 * 1. exact match
 * 2. prefix match ("namespace-" -> "namespace-a" before "namespace-other")
 * 3. namespaces present in every selected cluster, since a unified view across
 *    clusters is the whole point of ops-union
 * 4. alphabetical, so the list is stable
 */
export function suggestNamespaces(
  namespaces: NamespaceInfo[],
  query: string,
  selectedClusterCount: number,
  limit = MAX_SUGGESTIONS,
): NamespaceSuggestion[] {
  const needle = query.trim().toLowerCase();

  const matches = needle
    ? namespaces.filter((ns) => ns.name.toLowerCase().includes(needle))
    : namespaces;

  const ranked = matches.map((ns) => {
    const name = ns.name.toLowerCase();
    const inAllClusters = selectedClusterCount > 0 && ns.clusters.length === selectedClusterCount;
    return {
      ns: { ...ns, inAllClusters },
      exact: needle.length > 0 && name === needle ? 0 : 1,
      prefix: needle.length > 0 && name.startsWith(needle) ? 0 : 1,
      breadth: inAllClusters ? 0 : 1,
    };
  });

  ranked.sort(
    (a, b) =>
      a.exact - b.exact ||
      a.prefix - b.prefix ||
      a.breadth - b.breadth ||
      a.ns.name.localeCompare(b.ns.name),
  );

  return ranked.slice(0, limit).map((entry) => entry.ns);
}

/** Short label describing where a namespace exists, e.g. "2 of 2". */
export function describeNamespaceReach(
  suggestion: NamespaceSuggestion,
  selectedClusterCount: number,
): string {
  if (selectedClusterCount <= 1) return '';
  return `${suggestion.clusters.length} of ${selectedClusterCount}`;
}
