import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  describeNamespaceReach,
  hasExactNamespaceMatch,
  suggestNamespaces,
} from './namespaceSuggestions';
import type { NamespaceInfo } from './types';

const TWO_CLUSTERS = ['kubernetes-qa-tb', 'kubernetes-qa-gt'];

function ns(name: string, clusters: string[] = TWO_CLUSTERS): NamespaceInfo {
  return { name, clusters };
}

test('suggestNamespaces filters by substring, case-insensitively', () => {
  const all = [ns('bank-overdraft'), ns('bank-payments'), ns('kube-system')];
  const result = suggestNamespaces(all, 'BANK', 2);
  assert.deepEqual(
    result.map((n) => n.name),
    ['bank-overdraft', 'bank-payments'],
  );
});

test('suggestNamespaces ranks an exact match first', () => {
  const all = [ns('bank-overdraft-batch'), ns('bank-overdraft')];
  const result = suggestNamespaces(all, 'bank-overdraft', 2);
  assert.equal(result[0].name, 'bank-overdraft');
});

test('suggestNamespaces ranks prefix matches above mid-string matches', () => {
  // Typing "bank-ov" should reach bank-overdraft before autbank-overdraft.
  const all = [ns('autbank-overdraft'), ns('bank-overdraft')];
  const result = suggestNamespaces(all, 'bank-ov', 2);
  assert.equal(result[0].name, 'bank-overdraft');
});

test('suggestNamespaces favours namespaces present in every selected cluster', () => {
  const all = [
    ns('bank-a', ['kubernetes-qa-tb']),
    ns('bank-b', TWO_CLUSTERS),
  ];
  const result = suggestNamespaces(all, 'bank', 2);
  assert.equal(result[0].name, 'bank-b', 'o que existe em ambos vem primeiro');
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
  const all = [ns('bank-overdraft')];
  assert.equal(hasExactNamespaceMatch(all, ' bank-overdraft '), true);
  assert.equal(hasExactNamespaceMatch(all, 'bank'), false);
  assert.equal(hasExactNamespaceMatch(all, 'unknown'), false);
});

test('describeNamespaceReach reports coverage only for multi-cluster selections', () => {
  const suggestion = { ...ns('bank-overdraft'), inAllClusters: true };
  assert.equal(describeNamespaceReach(suggestion, 2), '2 of 2');
  assert.equal(describeNamespaceReach(suggestion, 1), '', 'nothing to compare with 1 cluster');
});
