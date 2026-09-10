import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlightSegments } from './textHighlight';

/** Compact view of the segments, for readable assertions. */
function shape(text: string, query: string): [string, boolean][] {
  return highlightSegments(text, query).map((s) => [s.text, s.match]);
}

test('highlightSegments returns the whole text unmatched for an empty query', () => {
  assert.deepEqual(shape('uma linha de log', ''), [['uma linha de log', false]]);
  assert.deepEqual(shape('uma linha de log', '   '), [['uma linha de log', false]]);
});

test('highlightSegments marks a single occurrence', () => {
  assert.deepEqual(shape('2026 INFO pronto', 'INFO'), [
    ['2026 ', false],
    ['INFO', true],
    [' pronto', false],
  ]);
});

test('highlightSegments marks every occurrence', () => {
  assert.deepEqual(shape('INFO a INFO b', 'INFO'), [
    ['INFO', true],
    [' a ', false],
    ['INFO', true],
    [' b', false],
  ]);
});

test('highlightSegments matches case-insensitively but preserves original casing', () => {
  assert.deepEqual(shape('Info and INFO', 'info'), [
    ['Info', true],
    [' and ', false],
    ['INFO', true],
  ]);
});

test('highlightSegments handles a match at the start and at the end', () => {
  assert.deepEqual(shape('INFO', 'INFO'), [['INFO', true]]);
  assert.deepEqual(shape('x INFO', 'INFO'), [
    ['x ', false],
    ['INFO', true],
  ]);
});

test('highlightSegments treats regex metacharacters literally', () => {
  // A RegExp-based implementation would throw or mis-match on these.
  assert.deepEqual(shape('valor (200 OK)', '(200'), [
    ['valor ', false],
    ['(200', true],
    [' OK)', false],
  ]);
  assert.deepEqual(shape('a.b.c', '.'), [
    ['a', false],
    ['.', true],
    ['b', false],
    ['.', true],
    ['c', false],
  ]);
  assert.deepEqual(shape('custo * 2', '*'), [
    ['custo ', false],
    ['*', true],
    [' 2', false],
  ]);
});

test('highlightSegments returns no matches when the term is absent', () => {
  assert.deepEqual(shape('nada aqui', 'ERROR'), [['nada aqui', false]]);
});

test('highlightSegments handles overlapping-looking terms without infinite loops', () => {
  assert.deepEqual(shape('aaaa', 'aa'), [
    ['aa', true],
    ['aa', true],
  ]);
});

test('highlightSegments ignores surrounding whitespace in the query', () => {
  assert.deepEqual(shape('2026 INFO pronto', '  INFO  '), [
    ['2026 ', false],
    ['INFO', true],
    [' pronto', false],
  ]);
});
