import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPreset,
  describePreset,
  loadPersistentPresets,
  loadPresets,
  markPresetUsed,
  orderPresetsByRecentUse,
  savePresets,
} from './presets';

/** Minimal localStorage stub so the module can be exercised under node:test. */
function installStorage(initial: Record<string, string> = {}): void {
  const store = new Map(Object.entries(initial));
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
}

const STORAGE_KEY = 'ops-union.presets.v1';

test('createPreset trims the name and copies the targets', () => {
  const preset = createPreset('  QA overdraft  ', [
    { cluster: 'kubernetes-qa-tb', namespace: 'bank-overdraft' },
  ], '  Shared QA investigation  ');
  assert.equal(preset.name, 'QA overdraft');
  assert.equal(preset.description, 'Shared QA investigation');
  assert.equal(preset.targets.length, 1);
  assert.ok(preset.id.length > 0);
});

test('createPreset gives distinct ids to presets made in the same tick', () => {
  const a = createPreset('a', []);
  const b = createPreset('b', []);
  assert.notEqual(a.id, b.id);
});

test('savePresets and loadPresets round-trip', () => {
  installStorage();
  const preset = createPreset('QA overdraft', [
    { cluster: 'kubernetes-qa-tb', namespace: 'bank-overdraft' },
    { cluster: 'kubernetes-qa-gt', namespace: 'bank-overdraft' },
  ]);
  savePresets([preset]);
  const loaded = loadPresets();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'QA overdraft');
  assert.equal(loaded[0].targets.length, 2);
});

test('savePresets and loadPresets preserve recent usage metadata', () => {
  installStorage();
  const preset = createPreset('QA overdraft', [
    { cluster: 'kubernetes-qa-tb', namespace: 'bank-overdraft' },
  ]);

  savePresets(markPresetUsed([preset], preset.id, 4321));

  assert.equal(loadPresets()[0].lastUsedAt, 4321);
});

test('loadPresets returns empty for missing storage entry', () => {
  installStorage();
  assert.deepEqual(loadPresets(), []);
});

test('loadPresets survives corrupted JSON without throwing', () => {
  installStorage({ [STORAGE_KEY]: '{not json' });
  assert.deepEqual(loadPresets(), []);
});

test('loadPresets discards entries with the wrong shape', () => {
  installStorage({
    [STORAGE_KEY]: JSON.stringify([
      { id: 'ok', name: 'valido', targets: [{ cluster: 'c', namespace: 'n' }] },
      { id: 'sem-targets', name: 'invalido' },
      { name: 'sem-id', targets: [] },
      { id: 'targets-ruins', name: 'x', targets: [{ cluster: 1, namespace: 'n' }] },
      'nem-objeto',
    ]),
  });
  const loaded = loadPresets();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'ok');
});

test('loadPresets returns empty when the stored value is not an array', () => {
  installStorage({ [STORAGE_KEY]: JSON.stringify({ nope: true }) });
  assert.deepEqual(loadPresets(), []);
});

test('loadPresets keeps legacy presets and removes invalid usage metadata', () => {
  installStorage({
    [STORAGE_KEY]: JSON.stringify([
      { id: 'legacy', name: 'legacy', targets: [{ cluster: 'c', namespace: 'n' }] },
      {
        id: 'invalid-time',
        name: 'invalid-time',
        targets: [{ cluster: 'c', namespace: 'n' }],
        lastUsedAt: 'yesterday',
      },
    ]),
  });

  assert.deepEqual(loadPresets(), [
    { id: 'legacy', name: 'legacy', targets: [{ cluster: 'c', namespace: 'n' }] },
    { id: 'invalid-time', name: 'invalid-time', targets: [{ cluster: 'c', namespace: 'n' }] },
  ]);
});

test('loadPersistentPresets uses the desktop store when available', async () => {
  const preset = createPreset('desktop', [{ cluster: 'c1', namespace: 'n1' }]);
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    opsFlowDesktop: {
      loadPresets: async () => [preset],
      savePresets: async () => undefined,
    },
  };

  try {
    assert.deepEqual(await loadPersistentPresets(), [preset]);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = previousWindow;
  }
});

test('describePreset summarizes clusters and namespaces', () => {
  const sameNamespace = createPreset('qa', [
    { cluster: 'kubernetes-qa-tb', namespace: 'bank-overdraft' },
    { cluster: 'kubernetes-qa-gt', namespace: 'bank-overdraft' },
  ]);
  assert.equal(describePreset(sameNamespace), '2 clusters · bank-overdraft');

  const single = createPreset('one', [{ cluster: 'c1', namespace: 'ns' }]);
  assert.equal(describePreset(single), '1 cluster · ns');

  const manyNamespaces = createPreset('multi', [
    { cluster: 'c1', namespace: 'ns-a' },
    { cluster: 'c1', namespace: 'ns-b' },
  ]);
  assert.equal(describePreset(manyNamespaces), '1 cluster · 2 namespaces');
});

test('orderPresetsByRecentUse puts recent presets first and preserves ties', () => {
  const presets = [
    createPreset('never', [{ cluster: 'c1', namespace: 'n1' }]),
    { ...createPreset('older', [{ cluster: 'c2', namespace: 'n2' }]), lastUsedAt: 100 },
    { ...createPreset('same-a', [{ cluster: 'c3', namespace: 'n3' }]), lastUsedAt: 200 },
    { ...createPreset('same-b', [{ cluster: 'c4', namespace: 'n4' }]), lastUsedAt: 200 },
    { ...createPreset('recent', [{ cluster: 'c5', namespace: 'n5' }]), lastUsedAt: 300 },
  ];

  assert.deepEqual(
    orderPresetsByRecentUse(presets).map((preset) => preset.name),
    ['recent', 'same-a', 'same-b', 'older', 'never'],
  );
});

test('markPresetUsed updates only the selected preset with the supplied timestamp', () => {
  const presets = [
    createPreset('first', [{ cluster: 'c1', namespace: 'n1' }]),
    createPreset('second', [{ cluster: 'c2', namespace: 'n2' }]),
  ];

  assert.deepEqual(markPresetUsed(presets, presets[1].id, 1234), [
    presets[0],
    { ...presets[1], lastUsedAt: 1234 },
  ]);
  assert.equal(markPresetUsed(presets, 'missing', 1234), presets);
});
