import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNamespaces, parseClusters, type NamespaceLister } from './namespacesService.js';

test('getNamespaces merges namespaces and records where each one exists', async () => {
  const lister: NamespaceLister = async (cluster) =>
    cluster === 'qa-tb' ? ['bank-overdraft', 'kube-system'] : ['bank-overdraft', 'bank-payments'];

  const { namespaces, errors } = await getNamespaces(['qa-tb', 'qa-gt'], lister);

  assert.equal(errors.length, 0);
  assert.deepEqual(
    namespaces.map((n) => [n.name, n.clusters]),
    [
      ['bank-overdraft', ['qa-gt', 'qa-tb']],
      ['bank-payments', ['qa-gt']],
      ['kube-system', ['qa-tb']],
    ],
    'ordenado por nome, com os clusters de cada namespace',
  );
});

test('getNamespaces isolates a failing cluster and keeps the others', async () => {
  const lister: NamespaceLister = async (cluster) => {
    if (cluster === 'quebrado') throw new Error('cluster unreachable');
    return ['bank-overdraft'];
  };

  const { namespaces, errors } = await getNamespaces(['qa-tb', 'quebrado'], lister);

  assert.equal(namespaces.length, 1);
  assert.deepEqual(namespaces[0].clusters, ['qa-tb']);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].cluster, 'quebrado');
  assert.match(errors[0].message, /unreachable/);
});

test('getNamespaces deduplicates the requested clusters', async () => {
  const seen: string[] = [];
  const lister: NamespaceLister = async (cluster) => {
    seen.push(cluster);
    return ['ns'];
  };

  await getNamespaces(['qa-tb', 'qa-tb', ' qa-tb '], lister);

  assert.deepEqual(seen, ['qa-tb'], 'consulta cada cluster uma única vez');
});

test('getNamespaces returns empty for an empty cluster list', async () => {
  const result = await getNamespaces([], async () => ['ns']);
  assert.deepEqual(result, { namespaces: [], errors: [] });
});

test('parseClusters accepts a valid list and trims names', () => {
  const result = parseClusters({ clusters: [' kubernetes-qa-tb ', 'kubernetes-qa-gt'] });
  assert.ok('clusters' in result);
  if ('clusters' in result) {
    assert.deepEqual(result.clusters, ['kubernetes-qa-tb', 'kubernetes-qa-gt']);
  }
});

test('parseClusters rejects invalid bodies', () => {
  assert.ok('error' in parseClusters(null));
  assert.ok('error' in parseClusters({}));
  assert.ok('error' in parseClusters({ clusters: [] }));
  assert.ok('error' in parseClusters({ clusters: [''] }));
  assert.ok('error' in parseClusters({ clusters: [123] }));
});
