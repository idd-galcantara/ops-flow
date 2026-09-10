import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { V1Pod } from '@kubernetes/client-node';
import { getPods, safeErrorMessage, type PodLister } from './podsService.js';
import type { Target } from './types.js';

const tb: Target = { cluster: 'kubernetes-qa-tb', namespace: 'bank-overdraft' };
const gt: Target = { cluster: 'kubernetes-qa-gt', namespace: 'bank-overdraft' };

function pod(name: string): V1Pod {
  return { metadata: { name }, spec: { containers: [{ name: 'app' }] } };
}

test('getPods aggregates pods from multiple targets, annotated with origin', async () => {
  const lister: PodLister = async (t) => {
    if (t.cluster === 'kubernetes-qa-tb') return [pod('tb-1'), pod('tb-2')];
    return [pod('gt-1')];
  };
  const { pods, errors } = await getPods([tb, gt], lister);
  assert.equal(errors.length, 0);
  assert.equal(pods.length, 3);
  const tbPods = pods.filter((p) => p.cluster === 'kubernetes-qa-tb');
  const gtPods = pods.filter((p) => p.cluster === 'kubernetes-qa-gt');
  assert.equal(tbPods.length, 2);
  assert.equal(gtPods.length, 1);
  assert.ok(pods.every((p) => p.namespace === 'bank-overdraft'));
});

test('getPods isolates a failing target and keeps the successful ones', async () => {
  const lister: PodLister = async (t) => {
    if (t.cluster === 'kubernetes-qa-gt') throw new Error('cluster unreachable');
    return [pod('tb-1')];
  };
  const { pods, errors } = await getPods([tb, gt], lister);
  assert.equal(pods.length, 1);
  assert.equal(pods[0].cluster, 'kubernetes-qa-tb');
  assert.equal(errors.length, 1);
  assert.deepEqual(errors[0].target, gt);
  assert.match(errors[0].message, /unreachable/);
});

test('getPods returns empty pods and collects all errors when every target fails', async () => {
  const lister: PodLister = async () => {
    throw new Error('boom');
  };
  const { pods, errors } = await getPods([tb, gt], lister);
  assert.equal(pods.length, 0);
  assert.equal(errors.length, 2);
});

test('safeErrorMessage prefers a kubernetes body message', () => {
  const reason = { body: { message: 'namespaces "x" not found' } };
  assert.equal(safeErrorMessage(reason), 'namespaces "x" not found');
});

test('safeErrorMessage surfaces a connection code without leaking internals', () => {
  assert.equal(safeErrorMessage({ code: 'ECONNREFUSED' }), 'Falha de conexão (ECONNREFUSED).');
});

test('safeErrorMessage falls back to a generic message', () => {
  assert.equal(safeErrorMessage(42), 'Falha ao consultar o alvo.');
});
