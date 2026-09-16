import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLogLineParser, parseLogLine, parseTimestampedLine } from './logsService.js';

test('parseTimestampedLine removes the Kubernetes timestamp and normalizes UTC', () => {
  assert.deepEqual(parseTimestampedLine('2026-09-16T10:00:00.123456Z cafe'), {
    timestamp: '2026-09-16T10:00:00.123Z',
    message: 'cafe',
  });
});

test('parseLogLine includes from and excludes to', () => {
  const range = { from: '2026-09-16T10:00:00.000Z', to: '2026-09-16T11:00:00.000Z' };
  assert.equal(parseLogLine('2026-09-16T10:00:00Z first', range).kind, 'emit');
  assert.equal(parseLogLine('2026-09-16T10:59:59.999Z last', range).kind, 'emit');
  assert.equal(parseLogLine('2026-09-16T11:00:00Z boundary', range).kind, 'to-reached');
});

test('parseLogLine preserves unparseable lines only without a time boundary', () => {
  assert.deepEqual(parseLogLine('legacy message'), {
    kind: 'emit',
    record: { timestamp: null, message: 'legacy message', bytes: 15 },
  });
  assert.deepEqual(parseLogLine('legacy message', { from: '2026-09-16T10:00:00Z' }), { kind: 'drop' });
});

test('createLogLineParser retains partial lines and split UTF-8 characters', () => {
  const parser = createLogLineParser();
  const input = Buffer.from('2026-09-16T10:00:00Z café\nnext');
  const split = input.indexOf(0xc3) + 1;
  assert.deepEqual(parser.push(input.subarray(0, split)), []);
  assert.deepEqual(parser.push(input.subarray(split)), ['2026-09-16T10:00:00Z café']);
  assert.deepEqual(parser.end(), ['next']);
});