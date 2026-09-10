import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFullCaChain, readSystemRoots, resetSystemRootsCache } from './caChain.js';

const CERT_A = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----';
const CERT_B = '-----BEGIN CERTIFICATE-----\nBBBB\n-----END CERTIFICATE-----';

test('buildFullCaChain appends system roots to the kubeconfig CA', () => {
  const chain = buildFullCaChain(CERT_A, CERT_B);
  assert.ok(chain.includes('AAAA'), 'mantém a CA do kubeconfig');
  assert.ok(chain.includes('BBBB'), 'inclui as roots do sistema');
  assert.equal((chain.match(/BEGIN CERTIFICATE/g) ?? []).length, 2);
});

test('buildFullCaChain returns the kubeconfig CA unchanged when no system roots exist', () => {
  assert.equal(buildFullCaChain(CERT_A, null), CERT_A);
});

test('buildFullCaChain separates certificates with a newline', () => {
  const chain = buildFullCaChain(`${CERT_A}\n`, CERT_B);
  assert.ok(!chain.includes('-----END CERTIFICATE----------BEGIN CERTIFICATE-----'));
});

test('readSystemRoots returns null when no bundle path is readable', () => {
  resetSystemRootsCache();
  const result = readSystemRoots(['/nonexistent/ca-a.crt', '/nonexistent/ca-b.crt']);
  assert.equal(result, null);
  resetSystemRootsCache();
});
