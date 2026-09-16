import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyPresetAndLoad } from './presetFlow';

function createStore(loadPods: () => Promise<void>) {
  const events: string[] = [];
  return {
    events,
    store: {
      presets: [{ id: 'qa' }],
      applyPreset: (id: string) => events.push(`apply:${id}`),
      loadPods: async () => {
        events.push('load:start');
        await loadPods();
        events.push('load:end');
      },
    },
  };
}

test('applyPresetAndLoad applies before loading and settles after the query', async () => {
  const { events, store } = createStore(async () => undefined);
  let settled = false;

  const applied = await applyPresetAndLoad('qa', () => store, () => {
    events.push('settled');
    settled = true;
  });

  assert.equal(applied, true);
  assert.deepEqual(events, ['apply:qa', 'load:start', 'load:end', 'settled']);
  assert.equal(settled, true);
});

test('applyPresetAndLoad settles after a request-level rejection', async () => {
  const { events, store } = createStore(async () => {
    throw new Error('request failed');
  });

  await assert.rejects(
    applyPresetAndLoad('qa', () => store, () => events.push('settled')),
    /request failed/,
  );
  assert.deepEqual(events, ['apply:qa', 'load:start', 'settled']);
});

test('applyPresetAndLoad ignores an unknown preset without side effects', async () => {
  const { events, store } = createStore(async () => undefined);
  const applied = await applyPresetAndLoad('missing', () => store, () => events.push('settled'));

  assert.equal(applied, false);
  assert.deepEqual(events, []);
});