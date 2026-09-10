import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksLikeMissingMetricsServer } from './podDetailsService.js';

test('looksLikeMissingMetricsServer detects a 404 from the metrics API', () => {
  // A cluster without metrics-server has no metrics.k8s.io API group at all.
  assert.equal(looksLikeMissingMetricsServer({ code: 404 }), true);
  assert.equal(looksLikeMissingMetricsServer({ statusCode: 404 }), true);
});

test('looksLikeMissingMetricsServer detects a 503 (API present but unreachable)', () => {
  assert.equal(looksLikeMissingMetricsServer({ code: 503 }), true);
});

test('looksLikeMissingMetricsServer detects the discovery error message', () => {
  assert.equal(
    looksLikeMissingMetricsServer({
      body: { message: 'the server could not find the requested resource' },
    }),
    true,
  );
  assert.equal(
    looksLikeMissingMetricsServer({ body: { message: 'no matches for metrics.k8s.io/v1beta1' } }),
    true,
  );
});

test('looksLikeMissingMetricsServer does not swallow a permission failure', () => {
  // 403 means metrics exist but access is denied — a different, real problem the
  // UI should report as its own reason.
  assert.equal(looksLikeMissingMetricsServer({ code: 403, body: { message: 'forbidden' } }), false);
});

test('looksLikeMissingMetricsServer does not swallow a connection failure', () => {
  assert.equal(looksLikeMissingMetricsServer({ code: 'ECONNREFUSED' }), false);
});
