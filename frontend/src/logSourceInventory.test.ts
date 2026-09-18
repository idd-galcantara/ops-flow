import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildApplicationLogInventory,
  applySidecarAction,
  classifyContainer,
  defaultSelectionKeys,
  inventoryContextKey,
  inventorySourceKey,
  reconcileSelectionKeys,
  selectionFromKeys,
  selectionToLogSources,
  sidecarSourceKeys,
} from './logSourceInventory';
import type { ApplicationIdentity, NormalizedPod, Target } from './types';

const identity: ApplicationIdentity = { key: 'label:application-b', name: 'application-b', source: 'label', labelKey: 'app' };
const pod = (name: string, cluster: string, app = identity, containers = ['app', 'istio-proxy']): NormalizedPod => ({
  cluster,
  namespace: 'namespace-a',
  name,
  status: 'Running',
  ready: '1/2',
  restarts: 0,
  node: 'node-1',
  ageSeconds: 1,
  containers,
  application: app,
});

test('groups by application key and preserves repeated pod names per context', () => {
  const inventory = buildApplicationLogInventory([
    pod('api', 'cluster-a'),
    pod('api', 'cluster-b'),
    pod('api', 'other', { ...identity, key: 'label:other', name: 'application-b' }),
  ], identity);
  assert.deepEqual(inventory.contexts.map((context) => `${context.cluster}/${context.namespace}`), ['cluster-a/namespace-a', 'cluster-b/namespace-a']);
  assert.equal(inventory.contexts[0].pods[0].pod, 'api');
});

test('selects primary/unknown defaults across every consulted context and falls back to sidecars', () => {
  const inventory = buildApplicationLogInventory([
    pod('api', 'cluster-a'),
    pod('proxy-only', 'cluster-a', identity, ['envoy', 'linkerd-proxy']),
    pod('api', 'cluster-b'),
  ], identity);
  const keys = defaultSelectionKeys(inventory);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'istio-proxy' })), false);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'cluster-a', namespace: 'namespace-a', pod: 'proxy-only', container: 'envoy' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'cluster-b', namespace: 'namespace-a', pod: 'api', container: 'app' })), true);
});

test('limits defaults to exact consulted context tuples and preserves repeated names', () => {
  const consulted: Target[] = [{ cluster: 'cluster-a', namespace: 'namespace-a' }, { cluster: 'cluster-b', namespace: 'namespace-a' }];
  const inventory = buildApplicationLogInventory([
    pod('api', 'cluster-a'),
    pod('api', 'cluster-b'),
    pod('api', 'unconsulted'),
  ], identity, [], undefined, consulted);
  const keys = defaultSelectionKeys(inventory);

  assert.deepEqual(inventory.consultedContexts, consulted);
  assert.deepEqual(inventory.contexts.map(inventoryContextKey).sort(), [inventoryContextKey(consulted[0]), inventoryContextKey(consulted[1])].sort());
  assert.equal(keys.has(inventorySourceKey({ cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'cluster-b', namespace: 'namespace-a', pod: 'api', container: 'app' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'unconsulted', namespace: 'namespace-a', pod: 'api', container: 'app' })), false);
});

test('classifies known indicators, supports explicit roles, and deduplicates exact tuples', () => {
  assert.equal(classifyContainer('istio-proxy').role, 'sidecar');
  assert.equal(classifyContainer('pod-worker-a', 'primary').role, 'primary');
  const inventory = buildApplicationLogInventory([pod('api', 'cluster-a'), pod('api', 'cluster-a')], identity);
  const all = new Set(inventory.contexts[0].pods[0].containers.map((container) => inventorySourceKey({ cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: container.container })));
  const selections = selectionFromKeys(inventory, all);
  assert.equal(selectionToLogSources([...selections, ...selections]).length, selections.length);
});

test('reconciles pending selections against the refreshed inventory', () => {
  const inventory = buildApplicationLogInventory([pod('api', 'cluster-a')], identity);
  const valid = inventorySourceKey({ cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' });
  const removed = inventorySourceKey({ cluster: 'cluster-a', namespace: 'namespace-a', pod: 'gone', container: 'app' });

  assert.deepEqual([...reconcileSelectionKeys(inventory, new Set([valid, removed]))], [valid]);
});

test('applies global and contextual sidecar actions without crossing contexts', () => {
  const inventory = buildApplicationLogInventory([pod('api', 'cluster-a'), pod('api', 'cluster-b')], identity, [], undefined, [
    { cluster: 'cluster-a', namespace: 'namespace-a' },
    { cluster: 'cluster-b', namespace: 'namespace-a' },
  ]);
  const initial = defaultSelectionKeys(inventory);
  const allSidecars = sidecarSourceKeys(inventory);
  const clusterASidecars = sidecarSourceKeys(inventory, { cluster: 'cluster-a', namespace: 'namespace-a' });
  const withClusterA = applySidecarAction(inventory, initial, { cluster: 'cluster-a', namespace: 'namespace-a' }, true);
  const withoutAll = applySidecarAction(inventory, withClusterA, 'application', false);

  assert.equal(allSidecars.length, 2);
  assert.equal(clusterASidecars.length, 1);
  assert.equal(withClusterA.has(clusterASidecars[0]), true);
  assert.equal(withClusterA.has(allSidecars.find((key) => !clusterASidecars.includes(key)) ?? ''), false);
  assert.deepEqual([...withoutAll], [...initial]);
});