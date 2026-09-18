import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendBoundedEvent,
  addHistoryQueryWindow,
  addHistoryWindow,
  createHistoryQueryWindowCache,
  createHistoryWindowCache,
  dedupeSources,
  filterLogRecords,
  historyRecordsFromCache,
  historyInitialWindowRequest,
  historyQueryRecordAt,
  logRecordMatches,
  logFilterValues,
  sourceIdFor,
  sourcesForPods,
} from './logsSession';
import type { HistoryQueryWindowEvent, HistoryWindowEvent, LogEventRecord, LogSource, NormalizedPod } from './types';

const application = { key: 'label:application-b', name: 'application-b', source: 'label' as const, labelKey: 'app' as const };
const pod = (name: string, cluster = 'cluster-a'): NormalizedPod => ({
  cluster,
  namespace: 'namespace-a',
  name,
  status: 'Running',
  ready: '1/1',
  restarts: 0,
  node: 'node-1',
  ageSeconds: 30,
  containers: ['app', 'proxy'],
  application,
});

function record(source: LogSource, message: string, sequence: number): LogEventRecord {
  return { source, event: { type: 'line', sourceId: source.sourceId, sequence, timestamp: null, message, bytes: message.length } };
}

test('sourcesForPods preserves context and de-duplicates only identical tuples', () => {
  const sources = sourcesForPods([pod('api'), pod('api'), pod('api', 'cluster-b')]);
  assert.equal(sources.length, 4);
  assert.equal(sources[0].sourceId, sourceIdFor({ cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' }));
  assert.equal(sources[2].cluster, 'cluster-b');
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
  assert.equal(logRecordMatches(second, 'application-b'), true);
  assert.equal(logRecordMatches(second, 'not present'), false);
});

test('structured filters apply AND semantics and keep source options bounded', () => {
  const sourceA: LogSource = { sourceId: 'cluster-a', cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' };
  const sourceB: LogSource = { sourceId: 'cluster-b', cluster: 'cluster-b', namespace: 'namespace-a', pod: 'api', container: 'app' };
  const records = [record(sourceA, 'Example application started', 1), record(sourceB, 'Example application stopped', 2)];
  assert.equal(filterLogRecords(records, { pod: 'api', container: 'app', cluster: 'cluster-a', namespace: 'namespace-a', text: 'started' }).length, 1);
  assert.deepEqual(logFilterValues([sourceA], records), { pods: ['api'], containers: ['app'], clusters: ['cluster-a', 'cluster-b'], namespaces: ['namespace-a'] });
});

test('history cache rejects stale generations and evicts old windows by count', () => {
  const source: LogSource = { sourceId: 'history-source', cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' };
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
  const source: LogSource = { sourceId: 'history-source', cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' };
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
  const firstSource: LogSource = { sourceId: 'same-name', cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' };
  const secondSource: LogSource = { sourceId: 'same-name', cluster: 'cluster-b', namespace: 'namespace-a', pod: 'api', container: 'app' };
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
  cache = addHistoryWindow(cache, makeWindow('cluster-a-key', firstSource, 'cluster-a line'), identity)!.cache;
  cache = addHistoryWindow(cache, makeWindow('cluster-b-key', secondSource, 'cluster-b line'), identity)!.cache;
  const records = historyRecordsFromCache(cache);
  assert.deepEqual(records.map((record) => record.event.message), ['cluster-a line', 'cluster-b line']);
  assert.deepEqual(records.map((record) => record.event.sourceId), ['cluster-a-key', 'cluster-b-key']);
  assert.equal(records[0].event.sequence, 1);
  assert.equal(records[1].event.sequence, 1);
});

test('history query cache indexes global positions, rejects stale queries, and reopens evicted ranges', () => {
  const source: LogSource = { sourceId: 'history-source', cluster: 'cluster-a', namespace: 'namespace-a', pod: 'api', container: 'app' };
  const identity = { sessionId: 'session', snapshotId: 'snapshot', generation: 7, queryId: 'query-1' };
  const window = (startIndex: number, queryId = identity.queryId): HistoryQueryWindowEvent => ({
    type: 'history.query.window',
    ...identity,
    queryId,
    startIndex,
    endIndex: startIndex + 2,
    records: [
      { sourceKey: 'source-key', source, sequence: startIndex, timestamp: null, message: `line ${startIndex}`, bytes: 7 },
      { sourceKey: 'source-key', source, sequence: startIndex + 1, timestamp: null, message: `line ${startIndex + 1}`, bytes: 7 },
    ],
    hasMoreBefore: startIndex > 0,
    hasMoreAfter: true,
  });
  let cache = createHistoryQueryWindowCache(2, 1024);
  assert.equal(addHistoryQueryWindow(cache, window(0, 'old-query'), identity), undefined);
  cache = addHistoryQueryWindow(cache, window(0), identity)!.cache;
  cache = addHistoryQueryWindow(cache, window(2), identity)!.cache;
  const update = addHistoryQueryWindow(cache, window(4), identity)!;
  assert.deepEqual(update.evictedKeys, ['0:2']);
  assert.equal(historyQueryRecordAt(update.cache, 0), undefined);
  assert.equal(historyQueryRecordAt(update.cache, 2)?.message, 'line 2');
  assert.equal(historyQueryRecordAt(update.cache, 5)?.message, 'line 5');
});
