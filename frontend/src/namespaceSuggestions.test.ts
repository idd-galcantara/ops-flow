import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canUseManualNamespace,
  describeNamespaceReach,
  hasExactNamespaceMatch,
  suggestNamespaces,
} from './namespaceSuggestions';
import type { NamespaceInfo } from './types';

const TWO_CLUSTERS = ['cluster-a', 'cluster-b'];

function ns(name: string, clusters: string[] = TWO_CLUSTERS): NamespaceInfo {
  return { name, clusters };
}

test('suggestNamespaces filters by substring, case-insensitively', () => {
  const all = [ns('namespace-a'), ns('namespace-b'), ns('system-namespace')];
  const result = suggestNamespaces(all, 'NAMESPACE-', 2);
  assert.deepEqual(
    result.map((n) => n.name),
    ['namespace-a', 'namespace-b'],
  );
});

test('suggestNamespaces ranks an exact match first', () => {
  const all = [ns('namespace-batch'), ns('namespace-a')];
  const result = suggestNamespaces(all, 'namespace-a', 2);
  assert.equal(result[0].name, 'namespace-a');
});

test('suggestNamespaces ranks prefix matches above mid-string matches', () => {
  // Typing "namespace-" should reach namespace-a before namespace-other.
  const all = [ns('namespace-other'), ns('namespace-a')];
  const result = suggestNamespaces(all, 'namespace-', 2);
  assert.equal(result[0].name, 'namespace-a');
});

test('suggestNamespaces favours namespaces present in every selected cluster', () => {
  const all = [
    ns('namespace-c', ['cluster-a']),
    ns('namespace-d', TWO_CLUSTERS),
  ];
  const result = suggestNamespaces(all, 'namespace', 2);
  assert.equal(result[0].name, 'namespace-d', 'o que existe em ambos vem primeiro');
  assert.equal(result[0].inAllClusters, true);
  assert.equal(result[1].inAllClusters, false);
});

test('suggestNamespaces caps the number of suggestions', () => {
  const all = Array.from({ length: 500 }, (_, i) => ns(`ns-${i}`));
  assert.equal(suggestNamespaces(all, '', 2).length, 40, 'usa o limite padrão');
  assert.equal(suggestNamespaces(all, '', 2, 5).length, 5, 'respeita um limite explícito');
});

test('suggestNamespaces returns everything (capped) for an empty query', () => {
  const all = [ns('a'), ns('b')];
  assert.equal(suggestNamespaces(all, '', 2).length, 2);
  assert.equal(suggestNamespaces(all, '   ', 2).length, 2, 'query só com espaços conta como vazia');
});

test('suggestNamespaces sorts alphabetically when rank ties', () => {
  const all = [ns('zeta'), ns('alpha'), ns('meio')];
  assert.deepEqual(
    suggestNamespaces(all, '', 2).map((n) => n.name),
    ['alpha', 'meio', 'zeta'],
  );
});

test('suggestNamespaces marks nothing as inAllClusters when no cluster is selected', () => {
  const result = suggestNamespaces([ns('x', [])], '', 0);
  assert.equal(result[0].inAllClusters, false);
});

test('hasExactNamespaceMatch only accepts a known namespace', () => {
  const all = [ns('namespace-a')];
  assert.equal(hasExactNamespaceMatch(all, ' namespace-a '), true);
  assert.equal(hasExactNamespaceMatch(all, 'bank'), false);
  assert.equal(hasExactNamespaceMatch(all, 'unknown'), false);
});

test('canUseManualNamespace only enables fallback after empty discovery fails', () => {
  assert.equal(canUseManualNamespace([], true, 'forbidden'), true);
  assert.equal(canUseManualNamespace([ns('known')], true, 'forbidden'), false);
  assert.equal(canUseManualNamespace([], true), false);
  assert.equal(canUseManualNamespace([], false, 'forbidden'), false);
});

test('describeNamespaceReach reports coverage only for multi-cluster selections', () => {
  const suggestion = { ...ns('namespace-a'), inAllClusters: true };
  assert.equal(describeNamespaceReach(suggestion, 2), '2 of 2');
  assert.equal(describeNamespaceReach(suggestion, 1), '', 'nothing to compare with 1 cluster');
});
