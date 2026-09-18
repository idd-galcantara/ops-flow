import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveLogRange } from './logsRange';
import {
  DEFAULT_LOG_SEARCH_VALUES,
  canAcceptSearchActivation,
  commitLogSearch,
  createLogSearchActivation,
  createLogSearchOperationSnapshot,
  historySearchOperationComplete,
  localFilterSearchValues,
  logSearchOperationComplete,
  searchHasPendingChanges,
  searchOperationKind,
  searchValuesEqual,
  transportSearchValues,
  transportSearchValuesEqual,
} from './logsSearch';

const fields = ['mode', 'period', 'customFrom', 'customTo', 'follow', 'filters'] as const;
const filterFields = ['pod', 'container', 'cluster', 'namespace', 'text'] as const;

test('search state keeps every editable value pending until an atomic commit', () => {
  const state = { draft: { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters } }, applied: { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters } } };
  for (const field of fields) {
    const draft = { ...state.draft, filters: { ...state.draft.filters } };
    if (field === 'mode') draft.mode = 'history';
    if (field === 'period') draft.period = '15m';
    if (field === 'customFrom') draft.customFrom = '2026-09-16T10:00';
    if (field === 'customTo') draft.customTo = '2026-09-16T11:00';
    if (field === 'follow') draft.follow = false;
    if (field === 'filters') draft.filters.pod = 'api';
    assert.equal(searchHasPendingChanges({ ...state, draft }), true, field);
    assert.equal(searchValuesEqual(state.applied, DEFAULT_LOG_SEARCH_VALUES), true, field);
  }

  const committed = commitLogSearch({ ...state, draft: { ...state.draft, period: '15m', follow: false, filters: { ...state.draft.filters, pod: 'api', text: 'started' } } });
  assert.deepEqual(committed.draft, committed.applied);
  assert.equal(searchHasPendingChanges(committed), false);
  committed.draft.filters.text = 'changed after commit';
  assert.equal(committed.applied.filters.text, 'started');
});

test('transport projection excludes local filters and filter projection excludes transport values', () => {
  const values = { ...DEFAULT_LOG_SEARCH_VALUES, period: 'custom' as const, customFrom: '2026-09-16T10:00', follow: false, filters: { pod: 'api', container: 'app', cluster: 'qa', namespace: 'payments', text: 'ready' } };
  assert.deepEqual(transportSearchValues(values), { mode: 'live', period: 'custom', customFrom: '2026-09-16T10:00', customTo: '', follow: false });
  assert.deepEqual(localFilterSearchValues(values), values.filters);
  assert.deepEqual(Object.keys(transportSearchValues(values)).sort(), ['customFrom', 'customTo', 'follow', 'mode', 'period']);
  assert.equal(transportSearchValuesEqual(values, { ...values, filters: { ...values.filters, text: 'other' } }), true);
  for (const field of filterFields) {
    const changed = { ...values, filters: { ...values.filters, [field]: field === 'text' ? 'other' : 'different' } };
    assert.equal(transportSearchValuesEqual(values, changed), true, field);
  }
});

test('search activation distinguishes local confirmation from transport and equal-value repeat', () => {
  const applied = { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters } };
  assert.equal(searchOperationKind({ draft: { ...applied, filters: { ...applied.filters, text: 'ready' } }, applied }), 'local');
  assert.equal(searchOperationKind({ draft: { ...applied, period: '5m' }, applied }), 'live');
  assert.equal(searchOperationKind({ draft: { ...applied, mode: 'history' }, applied }), 'history');
  assert.equal(searchOperationKind({ draft: { ...applied, filters: { ...applied.filters } }, applied }), 'live');
  assert.equal(searchOperationKind({ draft: { ...applied, mode: 'history', filters: { ...applied.filters } }, applied: { ...applied, mode: 'history' } }), 'history');
});

test('activation acceptance blocks duplicates while busy and preserves the local/transport matrix', () => {
  assert.equal(canAcceptSearchActivation(false, 1), true);
  assert.equal(canAcceptSearchActivation(true, 1), false);
  assert.equal(canAcceptSearchActivation(false, 0), false);
  assert.equal(searchOperationKind({ draft: { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters, pod: 'api' } }, applied: DEFAULT_LOG_SEARCH_VALUES }), 'local');
  assert.equal(searchOperationKind({ draft: { ...DEFAULT_LOG_SEARCH_VALUES, period: '5m' }, applied: DEFAULT_LOG_SEARCH_VALUES }), 'live');
});

test('history busy completion waits for both initial result boundary events', () => {
  assert.equal(historySearchOperationComplete(false, false), false);
  assert.equal(historySearchOperationComplete(true, false), false);
  assert.equal(historySearchOperationComplete(false, true), false);
  assert.equal(historySearchOperationComplete(true, true), true);
});

test('operation snapshots isolate candidate values, activation range, and source tuples', () => {
  const values = { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters, text: 'ready' } };
  const source = { sourceId: 'source', cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app', application: { key: 'app', name: 'api', source: 'pod' as const } };
  const snapshot = createLogSearchOperationSnapshot(values, { from: '2026-09-16T09:55:00.000Z' }, [source], 4);

  values.filters.text = 'changed';
  source.application!.name = 'changed';

  assert.equal(snapshot.requestId, 4);
  assert.equal(snapshot.values.filters.text, 'ready');
  assert.equal(snapshot.range.from, '2026-09-16T09:55:00.000Z');
  assert.equal(snapshot.sources[0].application?.name, 'api');
});

test('relative ranges are resolved into each activation snapshot at its own instant', () => {
  const values = { ...DEFAULT_LOG_SEARCH_VALUES, period: '5m' as const, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters } };
  const first = createLogSearchOperationSnapshot(values, resolveLogRange(values.period, new Date('2026-09-16T10:00:00.000Z')).range ?? {}, [], 1);
  const second = createLogSearchOperationSnapshot(values, resolveLogRange(values.period, new Date('2026-09-16T10:05:00.000Z')).range ?? {}, [], 2);
  assert.notEqual(first.range.from, second.range.from);
  assert.equal(first.range.from, '2026-09-16T09:55:00.000Z');
  assert.equal(second.range.from, '2026-09-16T10:00:00.000Z');
});

test('activation helper models repeats, local confirmation, transport replacement, and immutable snapshots', () => {
  const source = { sourceId: 'source', cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app', application: { key: 'app', name: 'api', source: 'pod' as const } };
  const applied = { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters } };
  const now = new Date('2026-09-16T10:00:00.000Z');

  const liveRepeat = createLogSearchActivation({ draft: applied, applied }, { isBusy: false, sources: [source], now, requestId: 1 });
  assert.equal(liveRepeat.accepted, true);
  if (!liveRepeat.accepted) return;
  assert.equal(liveRepeat.kind, 'live');
  assert.equal(liveRepeat.startsTransport, true);

  const history = { ...applied, mode: 'history' as const };
  const historyRepeat = createLogSearchActivation({ draft: history, applied: history }, { isBusy: false, sources: [source], now, requestId: 2 });
  assert.equal(historyRepeat.accepted, true);
  if (!historyRepeat.accepted) return;
  assert.equal(historyRepeat.kind, 'history');
  assert.equal(historyRepeat.startsTransport, true);

  const local = createLogSearchActivation({ draft: { ...applied, filters: { ...applied.filters, text: 'ready' } }, applied }, { isBusy: false, sources: [source], now, requestId: 3 });
  assert.equal(local.accepted, true);
  if (!local.accepted) return;
  assert.equal(local.kind, 'local');
  assert.equal(local.startsTransport, false);

  const transport = createLogSearchActivation({ draft: { ...applied, period: '5m' as const }, applied }, { isBusy: false, sources: [source], now, requestId: 4 });
  assert.equal(transport.accepted, true);
  if (!transport.accepted) return;
  assert.equal(transport.startsTransport, true);
  assert.equal(transport.snapshot.range.from, '2026-09-16T09:55:00.000Z');

  const busy = createLogSearchActivation({ draft: { ...applied, period: '5m' as const }, applied }, { isBusy: true, sources: [source], now, requestId: 5 });
  assert.deepEqual(busy, { accepted: false, reason: 'busy' });

  const candidate = { ...applied, filters: { ...applied.filters, text: 'candidate' } };
  const immutable = createLogSearchActivation({ draft: candidate, applied }, { isBusy: false, sources: [source], now, requestId: 6 });
  assert.equal(immutable.accepted, true);
  if (!immutable.accepted) return;
  candidate.filters.text = 'edited after activation';
  source.application!.name = 'edited after activation';
  assert.equal(immutable.snapshot.values.filters.text, 'candidate');
  assert.equal(immutable.snapshot.sources[0].application?.name, 'api');
});

test('activation helper rejects invalid custom ranges and keeps History completion independent from local confirmation', () => {
  const values = { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters } };
  const source = { sourceId: 'source', cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' };
  const invalid = createLogSearchActivation({ draft: { ...values, period: 'custom' as const, customFrom: 'not-a-date' }, applied: values }, { isBusy: false, sources: [source], requestId: 7 });
  assert.deepEqual(invalid, { accepted: false, reason: 'invalid-range', error: 'Choose a valid UTC start date.' });

  const local = createLogSearchActivation({ draft: { ...values, filters: { ...values.filters, text: 'ready' } }, applied: values }, { isBusy: false, sources: [source], requestId: 8 });
  assert.equal(local.accepted, true);
  if (!local.accepted) return;
  assert.equal(local.startsTransport, false);
  assert.equal(logSearchOperationComplete(local.kind, false, false), true);
  assert.equal(logSearchOperationComplete('history', true, false), false);
  assert.equal(logSearchOperationComplete('history', false, true), false);
  assert.equal(logSearchOperationComplete('history', true, true), true);
});