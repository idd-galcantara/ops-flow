import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datetimeLocalToUtc, resolveLogRange } from './logsRange';

test('resolveLogRange calculates presets from subscription time in UTC', () => {
  const now = new Date('2026-09-16T10:00:00.000Z');
  assert.deepEqual(resolveLogRange('5m', now).range, { from: '2026-09-16T09:55:00.000Z' });
  assert.deepEqual(resolveLogRange('24h', now).range, { from: '2026-09-15T10:00:00.000Z' });
  assert.deepEqual(resolveLogRange('all', now).range, {});
});

test('resolveLogRange converts custom local values and rejects an inverted half-open range', () => {
  assert.equal(datetimeLocalToUtc('2026-09-16T10:00'), new Date('2026-09-16T10:00').toISOString());
  const result = resolveLogRange('custom', new Date(), {
    from: '2026-09-16T11:00',
    to: '2026-09-16T10:00',
  });
  assert.equal(result.error, 'Start time must be earlier than end time.');
});

test('custom ranges allow an open ended from or to value', () => {
  assert.deepEqual(resolveLogRange('custom', new Date(), { from: '', to: '' }).range, {});
  assert.equal(resolveLogRange('custom', new Date(), { from: 'invalid', to: '' }).error, 'Choose a valid UTC start date.');
});
