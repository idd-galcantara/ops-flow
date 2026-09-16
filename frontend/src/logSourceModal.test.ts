import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApplicationLogInventory, defaultSelectionKeys } from './logSourceInventory';
import { applicationKeys, canConfirmLogSelection, hasSingleApplicationKey, modalSelectionCount } from './logSourceModal';
import type { NormalizedPod } from './types';

const pod: NormalizedPod = {
  cluster: 'qa', namespace: 'payments', name: 'api', status: 'Running', ready: '1/1', restarts: 0,
  node: 'node-a', ageSeconds: 1, containers: ['app'], application: { key: 'label:billing', name: 'billing', source: 'label', labelKey: 'app' },
};

test('modal confirmation is blocked for empty, loading, or stale inventory', () => {
  const inventory = buildApplicationLogInventory([pod], pod.application);
  const selected = defaultSelectionKeys(inventory, pod);
  assert.equal(modalSelectionCount(inventory, selected), 1);
  assert.equal(canConfirmLogSelection(inventory, selected, { loading: false, stale: false }), true);
  assert.equal(canConfirmLogSelection(inventory, new Set(), { loading: false, stale: false }), false);
  assert.equal(canConfirmLogSelection(inventory, selected, { loading: true, stale: false }), false);
  assert.equal(canConfirmLogSelection(inventory, selected, { loading: false, stale: true }), false);
});

test('application log flow accepts one application key and blocks mixed identities', () => {
  const sameApplication = [pod, { ...pod, name: 'worker' }];
  const otherApplication = { ...pod, application: { ...pod.application, key: 'label:checkout', name: 'checkout' } };

  assert.deepEqual([...applicationKeys(sameApplication)], ['label:billing']);
  assert.equal(hasSingleApplicationKey(sameApplication), true);
  assert.deepEqual([...applicationKeys([...sameApplication, otherApplication])].sort(), ['label:billing', 'label:checkout']);
  assert.equal(hasSingleApplicationKey([...sameApplication, otherApplication]), false);
});