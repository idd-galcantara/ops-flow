import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LOG_LIMITS, MAX_LOG_SOURCES, MAX_LOG_LIMITS, validateHistoryCancel, validateHistoryStart, validateHistoryWindow, validateSubscription } from './logsProtocol.js';

const source = { sourceId: 'one', cluster: 'c', namespace: 'n', pod: 'p', container: 'app' };

test('validateSubscription de-duplicates source tuples and applies defaults', () => {
  const result = validateSubscription({ type: 'subscribe', sources: [source, { ...source, sourceId: 'duplicate' }] });
  assert.ok('subscription' in result);
  if (!('subscription' in result)) return;
  assert.equal(result.subscription.sources.length, 1);
  assert.deepEqual(result.subscription.limits, DEFAULT_LOG_LIMITS);
});

test('validateSubscription rejects invalid limits and clamps over-cap values', () => {
  assert.match(
    ('error' in validateSubscription({ type: 'subscribe', sources: [source], limits: { maxLinesTotal: 0 } })
      ? validateSubscription({ type: 'subscribe', sources: [source], limits: { maxLinesTotal: 0 } }).error
      : ''),
    /finite positive integer/,
  );
  const result = validateSubscription({
    type: 'subscribe',
    sources: [source],
    limits: { maxLinesTotal: 999999, maxBytesTotal: 999999999 },
  });
  assert.ok('subscription' in result);
  if ('subscription' in result) {
    assert.equal(result.subscription.limits.maxLinesTotal, MAX_LOG_LIMITS.maxLinesTotal);
    assert.equal(result.subscription.limits.maxBytesTotal, MAX_LOG_LIMITS.maxBytesTotal);
  }
});

test('validateSubscription rejects invalid ranges and excessive source counts', () => {
  assert.deepEqual(
    validateSubscription({ type: 'subscribe', sources: [source], from: '2026-09-16T02:00:00Z', to: '2026-09-16T01:00:00Z' }),
    { error: 'from must be earlier than to.' },
  );
  const tooMany = Array.from({ length: MAX_LOG_SOURCES + 1 }, (_, index) => ({ ...source, sourceId: String(index), pod: `pod-${index}` }));
  assert.match(('error' in validateSubscription({ type: 'subscribe', sources: tooMany }) ? validateSubscription({ type: 'subscribe', sources: tooMany }).error : ''), /at most/);
});

test('validateSubscription rejects malformed protocol option types', () => {
  assert.match(('error' in validateSubscription({ type: 'subscribe', sources: [source], limits: null }) ? validateSubscription({ type: 'subscribe', sources: [source], limits: null }).error : ''), /limits must be an object/);
  assert.deepEqual(validateSubscription({ type: 'subscribe', sources: [source], follow: 'false' }), { error: 'follow must be a boolean.' });
});

test('validateHistoryStart keeps the range, application, and distinct source tuples', () => {
  const result = validateHistoryStart({
    type: 'history.start',
    requestId: 'history-1',
    generation: 7,
    from: '2026-09-16T01:00:00Z',
    to: '2026-09-16T02:00:00Z',
    sources: [
      { ...source, cluster: 'cluster-a', application: { key: 'app:one', name: 'one', source: 'label' } },
      { ...source, cluster: 'cluster-b', application: { key: 'app:one', name: 'one', source: 'label' } },
    ],
  });
  assert.ok('request' in result);
  if ('request' in result) {
    assert.equal(result.request.sources.length, 2);
    assert.equal(result.request.sources[0].application?.name, 'one');
    assert.equal(result.request.from, '2026-09-16T01:00:00.000Z');
  }
});

test('history validators reject unsafe generations, cursors, and cancel reasons', () => {
  assert.match(('error' in validateHistoryStart({ type: 'history.start', requestId: 'x', generation: 0, sources: [source] }) ? validateHistoryStart({ type: 'history.start', requestId: 'x', generation: 0, sources: [source] }).error : ''), /positive integer/);
  assert.match(('error' in validateHistoryWindow({ type: 'history.window', sessionId: 'not-a-uuid', generation: 1, cursor: { sourceKey: 'x', line: -1 } }) ? validateHistoryWindow({ type: 'history.window', sessionId: 'not-a-uuid', generation: 1, cursor: { sourceKey: 'x', line: -1 } }).error : ''), /sessionId is invalid/);
  assert.match(('error' in validateHistoryCancel({ type: 'history.cancel', sessionId: '00000000-0000-0000-0000-000000000000', generation: 1, reason: 'x'.repeat(129) }) ? validateHistoryCancel({ type: 'history.cancel', sessionId: '00000000-0000-0000-0000-000000000000', generation: 1, reason: 'x'.repeat(129) }).error : ''), /reason is invalid/);
});