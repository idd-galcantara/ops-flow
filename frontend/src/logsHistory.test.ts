import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serializeHistoryCancel, serializeHistoryQueryStart, serializeHistoryQueryWindow, serializeHistoryStart, serializeHistoryWindow } from './api';
import type { LogSource } from './types';

const source: LogSource = {
  sourceId: 'cluster-a/namespace-a/api/app',
  cluster: 'cluster-a',
  namespace: 'namespace-a',
  pod: 'api',
  container: 'app',
};

test('history start preserves range and exact source scope', () => {
  assert.deepEqual(JSON.parse(serializeHistoryStart({
    requestId: 'history-1',
    generation: 3,
    from: '2026-09-16T10:00:00.000Z',
    to: '2026-09-16T11:00:00.000Z',
    sources: [source],
  })), {
    type: 'history.start',
    requestId: 'history-1',
    generation: 3,
    from: '2026-09-16T10:00:00.000Z',
    to: '2026-09-16T11:00:00.000Z',
    sources: [source],
  });
});

test('history window and cancellation messages carry the session generation', () => {
  assert.deepEqual(JSON.parse(serializeHistoryWindow({ sessionId: 'session', generation: 9, sourceKey: 'source-key', line: 500, direction: 'backward', limit: 500 })), {
    type: 'history.window',
    sessionId: 'session',
    generation: 9,
    cursor: { sourceKey: 'source-key', line: 500 },
    direction: 'backward',
    limit: 500,
  });
  assert.deepEqual(JSON.parse(serializeHistoryCancel({ sessionId: 'session', generation: 9, reason: 'user-cancelled' })), {
    type: 'history.cancel',
    sessionId: 'session',
    generation: 9,
    reason: 'user-cancelled',
  });
});

test('history query messages use session identity, filters, and global offsets', () => {
  assert.deepEqual(JSON.parse(serializeHistoryQueryStart({
    sessionId: 'session',
    generation: 9,
    filters: { pod: 'api', container: 'app', cluster: 'cluster-a', namespace: 'namespace-a', text: 'started' },
  })), {
    type: 'history.query.start',
    sessionId: 'session',
    generation: 9,
    filters: { pod: 'api', container: 'app', cluster: 'cluster-a', namespace: 'namespace-a', text: 'started' },
  });
  assert.deepEqual(JSON.parse(serializeHistoryQueryWindow({ sessionId: 'session', generation: 9, queryId: 'query-1', offset: 1_000, limit: 500 })), {
    type: 'history.query.window',
    sessionId: 'session',
    generation: 9,
    queryId: 'query-1',
    offset: 1_000,
    direction: 'forward',
    limit: 500,
  });
});