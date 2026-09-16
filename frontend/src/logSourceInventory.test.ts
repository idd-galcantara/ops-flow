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

test('selects primary/unknown defaults across every consulted context and falls back to sidecars', () => {
  const inventory = buildApplicationLogInventory([
    pod('api', 'qa'),
    pod('proxy-only', 'qa', identity, ['envoy', 'linkerd-proxy']),
    pod('api', 'prod'),
  ], identity);
  const keys = defaultSelectionKeys(inventory);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'api', container: 'istio-proxy' })), false);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'proxy-only', container: 'envoy' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'prod', namespace: 'payments', pod: 'api', container: 'app' })), true);
});

test('limits defaults to exact consulted context tuples and preserves repeated names', () => {
  const consulted: Target[] = [{ cluster: 'qa', namespace: 'payments' }, { cluster: 'prod', namespace: 'payments' }];
  const inventory = buildApplicationLogInventory([
    pod('api', 'qa'),
    pod('api', 'prod'),
    pod('api', 'unconsulted'),
  ], identity, [], undefined, consulted);
  const keys = defaultSelectionKeys(inventory);

  assert.deepEqual(inventory.consultedContexts, consulted);
  assert.deepEqual(inventory.contexts.map(inventoryContextKey).sort(), [inventoryContextKey(consulted[0]), inventoryContextKey(consulted[1])].sort());
  assert.equal(keys.has(inventorySourceKey({ cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'prod', namespace: 'payments', pod: 'api', container: 'app' })), true);
  assert.equal(keys.has(inventorySourceKey({ cluster: 'unconsulted', namespace: 'payments', pod: 'api', container: 'app' })), false);
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

test('applies global and contextual sidecar actions without crossing contexts', () => {
  const inventory = buildApplicationLogInventory([pod('api', 'qa'), pod('api', 'prod')], identity, [], undefined, [
    { cluster: 'qa', namespace: 'payments' },
    { cluster: 'prod', namespace: 'payments' },
  ]);
  const initial = defaultSelectionKeys(inventory);
  const allSidecars = sidecarSourceKeys(inventory);
  const qaSidecars = sidecarSourceKeys(inventory, { cluster: 'qa', namespace: 'payments' });
  const withQa = applySidecarAction(inventory, initial, { cluster: 'qa', namespace: 'payments' }, true);
  const withoutAll = applySidecarAction(inventory, withQa, 'application', false);

  assert.equal(allSidecars.length, 2);
  assert.equal(qaSidecars.length, 1);
  assert.equal(withQa.has(qaSidecars[0]), true);
  assert.equal(withQa.has(allSidecars.find((key) => !qaSidecars.includes(key)) ?? ''), false);
  assert.deepEqual([...withoutAll], [...initial]);
});