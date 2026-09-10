import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatCpu,
  formatMemory,
  parseCpuToCores,
  parseMemoryToBytes,
  usageRatio,
} from './k8sUnits';

test('parseCpuToCores understands the suffixes the metrics API returns', () => {
  assert.equal(parseCpuToCores('1'), 1);
  assert.equal(parseCpuToCores('500m'), 0.5);
  assert.equal(parseCpuToCores('1000000u'), 1);
  assert.equal(parseCpuToCores('1000000000n'), 1);
  assert.equal(parseCpuToCores('invalido'), null);
});

test('formatCpu renders millicores like kubectl top', () => {
  // Real value observed on kubernetes-qa-tb; kubectl top showed 18m.
  assert.equal(formatCpu('17071271n'), '17m');
  assert.equal(formatCpu('316755n'), '0.32m');
  assert.equal(formatCpu('500m'), '500m');
  assert.equal(formatCpu('2'), '2.00 cores');
  assert.equal(formatCpu('0'), '0');
});

test('parseMemoryToBytes handles binary and decimal suffixes', () => {
  assert.equal(parseMemoryToBytes('1Ki'), 1024);
  assert.equal(parseMemoryToBytes('1Mi'), 1024 ** 2);
  assert.equal(parseMemoryToBytes('1Gi'), 1024 ** 3);
  assert.equal(parseMemoryToBytes('1000'), 1000);
  assert.equal(parseMemoryToBytes('nao-numero'), null);
});

test('formatMemory picks the nearest binary unit', () => {
  // Real value observed; kubectl top showed 99Mi.
  assert.equal(formatMemory('101696Ki'), '99.3Mi');
  assert.equal(formatMemory('73648Ki'), '71.9Mi');
  assert.equal(formatMemory('1024Ki'), '1.0Mi');
  assert.equal(formatMemory('0'), '0');
});

test('formatCpu and formatMemory pass unknown values through unchanged', () => {
  assert.equal(formatCpu('weird'), 'weird');
  assert.equal(formatMemory('weird'), 'weird');
});

test('usageRatio compares usage against a limit', () => {
  assert.equal(usageRatio('500m', '1', 'cpu'), 0.5);
  assert.equal(usageRatio('512Mi', '1Gi', 'memory'), 0.5);
});

test('usageRatio returns null when a limit is absent or unparseable', () => {
  assert.equal(usageRatio('500m', undefined, 'cpu'), null);
  assert.equal(usageRatio('500m', 'nonsense', 'cpu'), null);
  assert.equal(usageRatio('500m', '0', 'cpu'), null);
});
