import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildApplicationLogInventory,
  classifyContainer,
  defaultSelectionKeys,
  inventorySourceKey,
  reconcileSelectionKeys,
  selectionFromKeys,
  selectionToLogSources,
} from './logSourceInventory';
import type { ApplicationIdentity, NormalizedPod } from './types';

const identity: ApplicationIdentity = { key: 'label:billing', name: 'billing', source: 'label', labelKey: 'app' };
const pod = (name: string, cluster: string, app = identity, containers = ['app', 'istio-proxy']): NormalizedPod => ({
  cluster,
  namespace: 'payments',
  name,
  status: 'Running',
  ready: '1/2',
  restarts: 0,
  node: 'node-a',
  ageSeconds: 1,
  containers,
  application: app,
});

test('groups by application key and preserves repeated pod names per context', () => {
  const inventory = buildApplicationLogInventory([
    pod('api', 'qa'),
    pod('api', 'prod'),
    pod('api', 'other', { ...identity, key: 'label:other', name: 'billing' }),
  ], identity);
  assert.deepEqual(inventory.contexts.map((context) => `${context.cluster}/${context.namespace}`), ['prod/payments', 'qa/payments']);
  assert.equal(inventory.contexts[0].pods[0].pod, 'api');
});

test('selects primary/unknown defaults only in the originating context and falls back to sidecars', () => {
  const inventory = buildApplicationLogInventory([
    pod('api', 'qa'),
    pod('proxy-only', 'qa', identity, ['envoy', 'linkerd-proxy']),
    pod('api', 'prod'),
  ], identity);
  const keys = defaultSelectionKeys(inventory, { cluster: 'qa', namespace: 'payments' });
  assert.equal(keys.has(inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'api', container: 'istio-proxy' })), false);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'proxy-only', container: 'envoy' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'prod', namespace: 'payments', pod: 'api', container: 'app' })), false);
});

test('classifies known indicators, supports explicit roles, and deduplicates exact tuples', () => {
  assert.equal(classifyContainer('istio-proxy').role, 'sidecar');
  assert.equal(classifyContainer('worker', 'primary').role, 'primary');
  const inventory = buildApplicationLogInventory([pod('api', 'qa'), pod('api', 'qa')], identity);
  const all = new Set(inventory.contexts[0].pods[0].containers.map((container) => inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'api', container: container.container })));
  const selections = selectionFromKeys(inventory, all);
  assert.equal(selectionToLogSources([...selections, ...selections]).length, selections.length);
});

test('reconciles pending selections against the refreshed inventory', () => {
  const inventory = buildApplicationLogInventory([pod('api', 'qa')], identity);
  const valid = inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' });
  const removed = inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'gone', container: 'app' });

  assert.deepEqual([...reconcileSelectionKeys(inventory, new Set([valid, removed]))], [valid]);
});