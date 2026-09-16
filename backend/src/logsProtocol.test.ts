import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LOG_LIMITS, MAX_LOG_SOURCES, MAX_LOG_LIMITS, validateSubscription } from './logsProtocol.js';

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