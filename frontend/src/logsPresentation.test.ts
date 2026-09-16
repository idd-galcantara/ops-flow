import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LOG_DISPLAY_STATE, logRecordKey, setWrapLines } from './logsPresentation';
import type { LogEventRecord } from './types';

const record: LogEventRecord = {
  source: { sourceId: 'source-a', cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' },
  event: { type: 'line', sourceId: 'source-a', sequence: 7, timestamp: null, message: 'ready', bytes: 5 },
};

test('display state defaults to no-wrap and toggles without changing grouping', () => {
  assert.equal(DEFAULT_LOG_DISPLAY_STATE.wrapLines, false);
  const wrapped = setWrapLines(DEFAULT_LOG_DISPLAY_STATE, true);
  assert.deepEqual(wrapped, { grouping: 'application', wrapLines: true });
  assert.deepEqual(setWrapLines(wrapped, true), wrapped);
  assert.deepEqual(setWrapLines(wrapped, false), DEFAULT_LOG_DISPLAY_STATE);
});

test('virtualized log rows use a stable source and sequence key', () => {
  assert.equal(logRecordKey(record), 'source-a:7');
  assert.equal(logRecordKey({ ...record, event: { ...record.event, message: 'changed' } }), 'source-a:7');
  assert.notEqual(logRecordKey({ ...record, event: { ...record.event, sequence: 8 } }), logRecordKey(record));
});