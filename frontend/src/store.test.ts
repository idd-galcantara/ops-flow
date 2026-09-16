import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreset } from './presets';
import { useOpsFlowStore } from './store';

test('appendImportedPresets persists fresh presets without changing view state', () => {
  const original = useOpsFlowStore.getState();
  const existing = createPreset('existing', [{ cluster: 'c1', namespace: 'n1' }]);
  useOpsFlowStore.setState({
    presets: [existing],
    targets: [{ cluster: 'c2', namespace: 'n2' }],
    pods: [{
      cluster: 'c2',
      namespace: 'n2',
      name: 'pod',
      status: 'Running',
      ready: '1/1',
      restarts: 0,
      node: 'node',
      ageSeconds: 10,
      containers: ['app'],
    }],
    grouping: 'cluster',
    filter: 'pod',
    refreshSeconds: 30,
    activePresetId: existing.id,
    activePresetDirty: true,
  });

  try {
    useOpsFlowStore.getState().appendImportedPresets([{
      name: 'imported',
      description: 'from file',
      targets: [{ cluster: 'c3', namespace: 'n3' }],
    }]);
    const state = useOpsFlowStore.getState();
    assert.equal(state.presets.length, 2);
    assert.notEqual(state.presets[1].id, '');
    assert.equal(state.presets[1].lastUsedAt, undefined);
    assert.deepEqual(state.targets, [{ cluster: 'c2', namespace: 'n2' }]);
    assert.equal(state.pods[0].name, 'pod');
    assert.equal(state.grouping, 'cluster');
    assert.equal(state.filter, 'pod');
    assert.equal(state.refreshSeconds, 30);
    assert.equal(state.activePresetId, existing.id);
    assert.equal(state.activePresetDirty, true);
  } finally {
    useOpsFlowStore.setState(original);
  }
});

test('clearPresets persists an empty library and preserves current view state', () => {
  const original = useOpsFlowStore.getState();
  const active = createPreset('active', [{ cluster: 'c1', namespace: 'n1' }]);
  useOpsFlowStore.setState({
    presets: [active],
    targets: [{ cluster: 'c1', namespace: 'n1' }],
    pods: [{
      cluster: 'c1',
      namespace: 'n1',
      name: 'pod',
      status: 'Running',
      ready: '1/1',
      restarts: 0,
      node: 'node',
      ageSeconds: 10,
      containers: ['app'],
    }],
    grouping: 'flat',
    filter: 'running',
    refreshSeconds: 60,
    activePresetId: active.id,
    activePresetDirty: true,
  });

  try {
    useOpsFlowStore.getState().clearPresets();
    const state = useOpsFlowStore.getState();
    assert.deepEqual(state.presets, []);
    assert.equal(state.activePresetId, null);
    assert.equal(state.activePresetDirty, false);
    assert.deepEqual(state.targets, [{ cluster: 'c1', namespace: 'n1' }]);
    assert.equal(state.pods[0].name, 'pod');
    assert.equal(state.grouping, 'flat');
    assert.equal(state.filter, 'running');
    assert.equal(state.refreshSeconds, 60);
  } finally {
    useOpsFlowStore.setState(original);
  }
});