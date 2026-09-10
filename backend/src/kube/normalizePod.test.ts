import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { V1Pod } from '@kubernetes/client-node';
import { normalizePod } from './normalizePod.js';
import type { Target } from './types.js';

const target: Target = { cluster: 'kubernetes-qa-tb', namespace: 'bank-overdraft' };

test('normalizePod annotates origin cluster and namespace', () => {
  const pod: V1Pod = { metadata: { name: 'api-1' } };
  const result = normalizePod(pod, target);
  assert.equal(result.cluster, 'kubernetes-qa-tb');
  assert.equal(result.namespace, 'bank-overdraft');
  assert.equal(result.name, 'api-1');
});

test('normalizePod maps ready, restarts and node', () => {
  const pod: V1Pod = {
    metadata: { name: 'api-1' },
    spec: {
      nodeName: 'node-a',
      containers: [{ name: 'app' }, { name: 'sidecar' }],
    },
    status: {
      phase: 'Running',
      containerStatuses: [
        { name: 'app', ready: true, restartCount: 2, image: 'x', imageID: '' },
        { name: 'sidecar', ready: false, restartCount: 1, image: 'y', imageID: '' },
      ],
    },
  };
  const result = normalizePod(pod, target);
  assert.equal(result.ready, '1/2');
  assert.equal(result.restarts, 3);
  assert.equal(result.node, 'node-a');
  assert.equal(result.status, 'Running');
  assert.deepEqual(result.containers, ['app', 'sidecar']);
});

test('normalizePod surfaces waiting reason over phase (e.g. CrashLoopBackOff)', () => {
  const pod: V1Pod = {
    metadata: { name: 'broken' },
    spec: { containers: [{ name: 'app' }] },
    status: {
      phase: 'Running',
      containerStatuses: [
        {
          name: 'app',
          ready: false,
          restartCount: 5,
          image: 'x',
          imageID: '',
          state: { waiting: { reason: 'CrashLoopBackOff' } },
        },
      ],
    },
  };
  const result = normalizePod(pod, target);
  assert.equal(result.status, 'CrashLoopBackOff');
});

test('normalizePod reports Terminating when deletionTimestamp is set', () => {
  const pod: V1Pod = {
    metadata: { name: 'going', deletionTimestamp: new Date() },
    status: { phase: 'Running' },
  };
  assert.equal(normalizePod(pod, target).status, 'Terminating');
});

test('normalizePod computes age in seconds from a fixed now', () => {
  const now = new Date('2026-01-01T00:10:00Z').getTime();
  const pod: V1Pod = {
    metadata: { name: 'aged', creationTimestamp: new Date('2026-01-01T00:00:00Z') },
  };
  assert.equal(normalizePod(pod, target, now).ageSeconds, 600);
});

test('normalizePod is resilient to missing fields', () => {
  const result = normalizePod({}, target);
  assert.equal(result.name, '(sem nome)');
  assert.equal(result.ready, '0/0');
  assert.equal(result.restarts, 0);
  assert.equal(result.node, '');
  assert.deepEqual(result.containers, []);
});

test('normalizePod counts native sidecars (Istio) in ready, like kubectl', () => {
  // istio-proxy is injected as an init container with restartPolicy: Always.
  const pod: V1Pod = {
    metadata: { name: 'with-istio' },
    spec: {
      containers: [{ name: 'app' }],
      initContainers: [
        { name: 'istio-validation' },
        { name: 'istio-proxy', restartPolicy: 'Always' },
      ],
    },
    status: {
      phase: 'Running',
      initContainerStatuses: [
        { name: 'istio-validation', ready: false, restartCount: 0, image: 'i', imageID: '' },
        { name: 'istio-proxy', ready: true, restartCount: 1, image: 'p', imageID: '' },
      ],
      containerStatuses: [{ name: 'app', ready: true, restartCount: 2, image: 'a', imageID: '' }],
    },
  };
  const result = normalizePod(pod, target);
  assert.equal(result.ready, '2/2', 'conta o sidecar nativo, ignora o init comum');
  assert.equal(result.restarts, 3, 'soma restarts do app e do sidecar');
  assert.deepEqual(result.containers, ['app', 'istio-proxy']);
});

test('normalizePod ignores plain init containers in ready', () => {
  const pod: V1Pod = {
    metadata: { name: 'with-init' },
    spec: {
      containers: [{ name: 'app' }],
      initContainers: [{ name: 'migrate' }],
    },
    status: {
      phase: 'Running',
      initContainerStatuses: [
        { name: 'migrate', ready: false, restartCount: 0, image: 'm', imageID: '' },
      ],
      containerStatuses: [{ name: 'app', ready: true, restartCount: 0, image: 'a', imageID: '' }],
    },
  };
  const result = normalizePod(pod, target);
  assert.equal(result.ready, '1/1');
  assert.deepEqual(result.containers, ['app']);
});
