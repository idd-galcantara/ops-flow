import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StructuredLogCallbacks, StructuredLogLine } from './kube/logsService.js';
import { validateSubscription } from './logsProtocol.js';
import { startLogSubscription, type SubscriptionStreamFactory } from './logsSubscription.js';
import type { AggregateLogEvent } from './logsTypes.js';

const source = (sourceId: string, pod = sourceId) => ({ sourceId, cluster: 'cluster', namespace: 'namespace', pod, container: 'app' });

function subscription(overrides: Record<string, unknown> = {}) {
  const result = validateSubscription({ type: 'subscribe', sources: [source('a'), source('b')], follow: false, ...overrides });
  assert.ok('subscription' in result);
  if (!('subscription' in result)) throw new Error(result.error);
  return result.subscription;
}

test('startLogSubscription interleaves lines and isolates source errors', async () => {
  const callbacks = new Map<string, StructuredLogCallbacks>();
  const factory: SubscriptionStreamFactory = (options, sourceCallbacks) => {
    callbacks.set(options.pod, sourceCallbacks);
    return { stop: () => undefined };
  };
  const events: AggregateLogEvent[] = [];
  const running = startLogSubscription(subscription(), (event) => events.push(event), factory);
  const first: StructuredLogLine = { timestamp: '2026-09-16T10:00:00.000Z', message: 'one', bytes: 4 };
  callbacks.get('a')?.onLine(first);
  callbacks.get('b')?.onError('not found');
  callbacks.get('a')?.onEnd('eof');
  await running.completion;

  assert.deepEqual(events.filter((event) => event.type === 'line').map((event) => event.sourceId), ['a']);
  assert.equal(events.filter((event) => event.type === 'sourceError').length, 1);
  assert.equal(events.at(-1)?.type, 'summary');
  assert.equal((events.at(-1) as Extract<AggregateLogEvent, { type: 'summary' }>).reason, 'completed');
});

test('startLogSubscription stops every source before an aggregate byte limit is exceeded', async () => {
  const callbacks: StructuredLogCallbacks[] = [];
  let stopped = 0;
  const factory: SubscriptionStreamFactory = (_options, sourceCallbacks) => {
    callbacks.push(sourceCallbacks);
    return { stop: () => { stopped += 1; } };
  };
  const events: AggregateLogEvent[] = [];
  const running = startLogSubscription(
    subscription({ limits: { maxBytesTotal: 5 }}),
    (event) => events.push(event),
    factory,
  );
  callbacks[0].onLine({ timestamp: null, message: '1234', bytes: 5 });
  callbacks[1].onLine({ timestamp: null, message: 'x', bytes: 2 });
  await running.completion;

  assert.equal(stopped, 2);
  assert.equal((events.at(-1) as Extract<AggregateLogEvent, { type: 'summary' }>).reason, 'aggregate-limit');
  assert.equal(events.filter((event) => event.type === 'line').length, 1);
});

test('cancel stops handles created before and during disconnect', async () => {
  const stops: string[] = [];
  const factory: SubscriptionStreamFactory = (options) => ({ stop: () => stops.push(options.pod) });
  const running = startLogSubscription(subscription(), () => undefined, factory);
  running.cancel();
  await running.completion;
  assert.deepEqual(stops.sort(), ['a', 'b']);
});

test('source startup errors are sanitized and remain source-scoped', async () => {
  const events: AggregateLogEvent[] = [];
  const running = startLogSubscription(
    subscription({ sources: [source('a')] }),
    (event) => events.push(event),
    () => {
      throw { code: 500, message: 'HTTP-Code: 500\nMessage: Error\nBody: secret\nHeaders: authorization' };
    },
  );
  await running.completion;
  const error = events.find((event) => event.type === 'sourceError');
  assert.equal(error?.type, 'sourceError');
  if (error?.type === 'sourceError') {
    assert.ok(!error.message.includes('secret'));
    assert.ok(!error.message.includes('authorization'));
  }
});