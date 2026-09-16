import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendBoundedEvent,
  dedupeSources,
  filterLogRecords,
  logRecordMatches,
  logFilterValues,
  sourceIdFor,
  sourcesForPods,
} from './logsSession';
import type { LogEventRecord, LogSource, NormalizedPod } from './types';

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
