import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { V1Pod } from '@kubernetes/client-node';
import { MAX_TAIL_LINES, normalizeTailLines } from './logsService.js';
import { errorStatusCode, getPods, safeErrorMessage, type PodLister } from './podsService.js';
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

test('safeErrorMessage parses a Status message from a raw JSON body string', () => {
  const reason = {
    code: 404,
    body: JSON.stringify({ kind: 'Status', message: 'pods "abc" not found', reason: 'NotFound' }),
  };
  assert.equal(safeErrorMessage(reason), 'pods "abc" not found');
});

test('safeErrorMessage never leaks the ApiException dump with body and headers', () => {
  const reason = {
    code: 500,
    message:
      'HTTP-Code: 500\nMessage: Unknown API Status Code!\nBody: "{}"\nHeaders: {"authorization":"Bearer secret-token"}',
  };
  const message = safeErrorMessage(reason);
  assert.ok(!message.includes('secret-token'), 'não vaza headers');
  assert.ok(!message.includes('Headers'), 'não inclui o dump');
  assert.equal(message, 'A API do cluster respondeu 500.');
});

test('safeErrorMessage keeps a useful reason line from a log request failure', () => {
  // Shape observed when streaming logs for a container that does not exist.
  const reason = {
    code: 400,
    message:
      'HTTP-Code: 400\nMessage: Error occurred in log request\nBody: undefined\nHeaders: {"audit-id":"abc"}',
  };
  const message = safeErrorMessage(reason);
  assert.ok(!message.includes('audit-id'), 'não vaza headers');
  assert.equal(message, 'A API do cluster respondeu 400. Error occurred in log request');
});

test('normalizeTailLines clamps to a sane range', () => {
  assert.equal(normalizeTailLines('100'), 100);
  assert.equal(normalizeTailLines(undefined), 500, 'usa o padrão');
  assert.equal(normalizeTailLines('0'), 500, 'valores inválidos caem no padrão');
  assert.equal(normalizeTailLines('-5'), 500);
  assert.equal(normalizeTailLines('999999'), MAX_TAIL_LINES, 'limita o teto');
  assert.equal(normalizeTailLines('12.7'), 12, 'trunca fracionários');
});

test('errorStatusCode extracts a numeric HTTP status', () => {
  assert.equal(errorStatusCode({ code: 404 }), 404);
  assert.equal(errorStatusCode({ code: 'ECONNREFUSED' }), undefined);
  assert.equal(errorStatusCode(new Error('x')), undefined);
});

test('safeErrorMessage surfaces a connection code without leaking internals', () => {
  assert.equal(safeErrorMessage({ code: 'ECONNREFUSED' }), 'Falha de conexão (ECONNREFUSED).');
});

test('safeErrorMessage falls back to a generic message', () => {
  assert.equal(safeErrorMessage(42), 'Falha ao consultar o alvo.');
});
