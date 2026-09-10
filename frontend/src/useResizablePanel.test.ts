import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampWidth, readStoredWidth } from './useResizablePanel';

test('clampWidth keeps a width inside the allowed range', () => {
  assert.equal(clampWidth(500, 320, 900), 500);
  assert.equal(clampWidth(100, 320, 900), 320, 'clamps below the minimum');
  assert.equal(clampWidth(2000, 320, 900), 900, 'clamps above the maximum');
  assert.equal(clampWidth(320, 320, 900), 320, 'boundaries are allowed');
  assert.equal(clampWidth(900, 320, 900), 900);
});

test('readStoredWidth returns a valid stored width', () => {
  assert.equal(readStoredWidth('540', 420, 320, 900), 540);
});

test('readStoredWidth falls back when nothing is stored', () => {
  assert.equal(readStoredWidth(null, 420, 320, 900), 420);
});

test('readStoredWidth falls back on unparseable values', () => {
  assert.equal(readStoredWidth('abc', 420, 320, 900), 420);
  assert.equal(readStoredWidth('', 420, 320, 900), 420);
  assert.equal(readStoredWidth('0', 420, 320, 900), 420);
  assert.equal(readStoredWidth('-50', 420, 320, 900), 420);
});

test('readStoredWidth clamps a stored width that is out of range', () => {
  // A width persisted on a much wider monitor must not break a smaller screen.
  assert.equal(readStoredWidth('5000', 420, 320, 900), 900);
  assert.equal(readStoredWidth('50', 420, 320, 900), 320);
});
