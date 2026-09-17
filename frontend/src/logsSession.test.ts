import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendBoundedEvent,
  addHistoryWindow,
  createHistoryWindowCache,
  dedupeSources,
  filterLogRecords,
  historyRecordsFromCache,
  historyInitialWindowRequest,
  logRecordMatches,
  logFilterValues,
  sourceIdFor,
  sourcesForPods,
} from './logsSession';
import type { HistoryWindowEvent, LogEventRecord, LogSource, NormalizedPod } from './types';

const application = { key: 'label:billing', name: 'billing', source: 'label' as const, labelKey: 'app' as const };
const pod = (name: string, cluster = 'qa'): NormalizedPod => ({
  cluster,
  namespace: 'payments',
  name,
  status: 'Running',
  ready: '1/1',
  restarts: 0,
  node: 'node-a',
  ageSeconds: 30,
  containers: ['app', 'proxy'],
  application,
});

function record(source: LogSource, message: string, sequence: number): LogEventRecord {
  return { source, event: { type: 'line', sourceId: source.sourceId, sequence, timestamp: null, message, bytes: message.length } };
}

test('sourcesForPods preserves context and de-duplicates only identical tuples', () => {
  const sources = sourcesForPods([pod('api'), pod('api'), pod('api', 'prod')]);
  assert.equal(sources.length, 4);
  assert.equal(sources[0].sourceId, sourceIdFor({ cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' }));
  assert.equal(sources[2].cluster, 'prod');
});

test('dedupeSources keeps the first metadata for a source tuple', () => {
  const source: LogSource = { sourceId: 'first', cluster: 'c', namespace: 'n', pod: 'p', container: 'app' };
  assert.deepEqual(dedupeSources([source, { ...source, sourceId: 'second' }]), [source]);
});

test('appendBoundedEvent discards oldest records and structured filtering searches source fields', () => {
  const source: LogSource = { sourceId: 's', cluster: 'c', namespace: 'n', pod: 'p', container: 'app', application };
  const first = record(source, 'first', 1);
  const second = record(source, 'second', 2);
  assert.deepEqual(appendBoundedEvent([first], second, 1), [second]);
  assert.equal(logRecordMatches(second, 'billing'), true);
  assert.equal(logRecordMatches(second, 'not present'), false);
});

test('structured filters apply AND semantics and keep source options bounded', () => {
  const qaSource: LogSource = { sourceId: 'qa', cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' };
  const prodSource: LogSource = { sourceId: 'prod', cluster: 'prod', namespace: 'payments', pod: 'api', container: 'app' };
  const records = [record(qaSource, 'Billing started', 1), record(prodSource, 'Billing stopped', 2)];
  assert.equal(filterLogRecords(records, { pod: 'api', container: 'app', cluster: 'qa', namespace: 'payments', text: 'started' }).length, 1);
  assert.deepEqual(logFilterValues([qaSource], records), { pods: ['api'], containers: ['app'], clusters: ['prod', 'qa'], namespaces: ['payments'] });
});

test('history cache rejects stale generations and evicts old windows by count', () => {
  const source: LogSource = { sourceId: 'history-source', cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' };
  const identity = { sessionId: 'session', snapshotId: 'snapshot', generation: 7 };
  const window = (startLine: number): HistoryWindowEvent => ({
    type: 'history.window',
    ...identity,
    sourceKey: 'source-key',
    source,
    startLine,
    endLine: startLine + 1,
    records: [{ sourceKey: 'source-key', source, sequence: startLine + 1, timestamp: null, message: `line ${startLine}`, bytes: 7 }],
    hasMoreBefore: startLine > 0,
    hasMoreAfter: true,
  });
  let cache = createHistoryWindowCache(2, 1024);
  assert.equal(addHistoryWindow(cache, { ...window(0), generation: 6 }, identity), undefined);
  cache = addHistoryWindow(cache, window(0), identity)!.cache;
  cache = addHistoryWindow(cache, window(1), identity)!.cache;
  const update = addHistoryWindow(cache, window(2), identity)!;
  assert.deepEqual(update.evictedKeys, ['source-key:0']);
  assert.deepEqual(historyRecordsFromCache(update.cache).map((record) => record.event.message), ['line 1', 'line 2']);
});

test('history starts each source at the first captured record', () => {
  assert.deepEqual(historyInitialWindowRequest('source-key'), { sourceKey: 'source-key', line: 0, direction: 'forward' });
});

test('history cache evicts from the opposite edge of the requested direction', () => {
  const source: LogSource = { sourceId: 'history-source', cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' };
  const identity = { sessionId: 'session', snapshotId: 'snapshot', generation: 7 };
  const window = (startLine: number): HistoryWindowEvent => ({
    type: 'history.window',
    ...identity,
    sourceKey: 'source-key',
    source,
    startLine,
    endLine: startLine + 1,
    records: [{ sourceKey: 'source-key', source, sequence: startLine + 1, timestamp: null, message: `line ${startLine}`, bytes: 7 }],
    hasMoreBefore: startLine > 0,
    hasMoreAfter: true,
  });
  let cache = createHistoryWindowCache(2, 1024);
  cache = addHistoryWindow(cache, window(1), identity)!.cache;
  cache = addHistoryWindow(cache, window(2), identity)!.cache;
  const update = addHistoryWindow(cache, window(0), identity, 'backward');
  assert.ok(update);
  assert.deepEqual(update.cache.windows.map((item) => item.startLine).sort((left, right) => left - right), [0, 1]);
});

test('history cache merges short windows from duplicate source IDs by exact source key', () => {
  const firstSource: LogSource = { sourceId: 'same-name', cluster: 'qa', namespace: 'payments', pod: 'api', container: 'app' };
  const secondSource: LogSource = { sourceId: 'same-name', cluster: 'prod', namespace: 'payments', pod: 'api', container: 'app' };
  const identity = { sessionId: 'session', snapshotId: 'snapshot', generation: 7 };
  const makeWindow = (sourceKey: string, source: LogSource, message: string): HistoryWindowEvent => ({
    type: 'history.window',
    ...identity,
    sourceKey,
    source,
    startLine: 0,
    endLine: 1,
    records: [{ sourceKey, source, sequence: 1, timestamp: null, message, bytes: message.length }],
    hasMoreBefore: false,
    hasMoreAfter: true,
  });
  let cache = createHistoryWindowCache();
  cache = addHistoryWindow(cache, makeWindow('qa-key', firstSource, 'qa line'), identity)!.cache;
  cache = addHistoryWindow(cache, makeWindow('prod-key', secondSource, 'prod line'), identity)!.cache;
  const records = historyRecordsFromCache(cache);
  assert.deepEqual(records.map((record) => record.event.message), ['prod line', 'qa line']);
  assert.deepEqual(records.map((record) => record.event.sourceId), ['prod-key', 'qa-key']);
  assert.equal(records[0].event.sequence, 1);
  assert.equal(records[1].event.sequence, 1);
});
