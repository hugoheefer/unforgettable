import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRandomSource } from '../app/js/random-source.js';

test('picking gives an element of the list, chosen by the number generator', () => {
  assert.equal(createRandomSource(() => 0).pick(['a', 'b', 'c']), 'a');
  assert.equal(createRandomSource(() => 0.99).pick(['a', 'b', 'c']), 'c');
});

test('shuffling keeps every element exactly once and leaves the original list alone', () => {
  const original = ['a', 'b', 'c', 'd'];
  const shuffled = createRandomSource(() => 0.5).shuffle(original);
  assert.deepEqual([...shuffled].sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(original, ['a', 'b', 'c', 'd']);
});

test('shuffling can change the order', () => {
  const shuffled = createRandomSource(() => 0).shuffle(['a', 'b', 'c']);
  assert.notDeepEqual(shuffled, ['a', 'b', 'c']);
});

test('a chance of one half comes true below one half and not at or above it', () => {
  assert.equal(createRandomSource(() => 0.49).chance(0.5), true);
  assert.equal(createRandomSource(() => 0.5).chance(0.5), false);
});

test('a chance of nothing never comes true and a chance of one always does', () => {
  assert.equal(createRandomSource(() => 0).chance(0), false);
  assert.equal(createRandomSource(() => 0.999).chance(1), true);
});
