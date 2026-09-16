import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_LOG_SEARCH_VALUES,
  commitLogSearch,
  localFilterSearchValues,
  searchHasPendingChanges,
  searchValuesEqual,
  transportSearchValues,
  transportSearchValuesEqual,
} from './logsSearch';

const fields = ['period', 'customFrom', 'customTo', 'follow', 'filters'] as const;
const filterFields = ['pod', 'container', 'cluster', 'namespace', 'text'] as const;

test('search state keeps every editable value pending until an atomic commit', () => {
  const state = { draft: { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters } }, applied: { ...DEFAULT_LOG_SEARCH_VALUES, filters: { ...DEFAULT_LOG_SEARCH_VALUES.filters } } };
  for (const field of fields) {
    const draft = { ...state.draft, filters: { ...state.draft.filters } };
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
  assert.deepEqual(transportSearchValues(values), { period: 'custom', customFrom: '2026-09-16T10:00', customTo: '', follow: false });
  assert.deepEqual(localFilterSearchValues(values), values.filters);
  assert.deepEqual(Object.keys(transportSearchValues(values)).sort(), ['customFrom', 'customTo', 'follow', 'period']);
  assert.equal(transportSearchValuesEqual(values, { ...values, filters: { ...values.filters, text: 'other' } }), true);
  for (const field of filterFields) {
    const changed = { ...values, filters: { ...values.filters, [field]: field === 'text' ? 'other' : 'different' } };
    assert.equal(transportSearchValuesEqual(values, changed), true, field);
  }
});