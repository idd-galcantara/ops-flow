import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApplicationLogInventory, defaultSelectionKeys } from './logSourceInventory';
import { applicationKeys, canConfirmLogSelection, hasSingleApplicationKey, modalSelectionCount } from './logSourceModal';
import type { NormalizedPod } from './types';

const pod: NormalizedPod = {
  cluster: 'cluster-a', namespace: 'namespace-a', name: 'api', status: 'Running', ready: '1/1', restarts: 0,
  node: 'node-1', ageSeconds: 1, containers: ['app'], application: { key: 'label:application-b', name: 'application-b', source: 'label', labelKey: 'app' },
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
  const sameApplication = [pod, { ...pod, name: 'pod-worker-a' }];
  const otherApplication = { ...pod, application: { ...pod.application, key: 'label:application-c', name: 'application-c' } };

  assert.deepEqual([...applicationKeys(sameApplication)], ['label:application-b']);
  assert.equal(hasSingleApplicationKey(sameApplication), true);
  assert.deepEqual([...applicationKeys([...sameApplication, otherApplication])].sort(), ['label:application-b', 'label:application-c']);
  assert.equal(hasSingleApplicationKey([...sameApplication, otherApplication]), false);
});