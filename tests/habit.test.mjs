import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hintLevel, recordPlacement, streakOf } from '../app/js/habit.js';

test('an item never placed has no streak', () => {
  assert.equal(streakOf({ streaks: {} }, 'keys'), 0);
});

test('putting an item on its home spot lengthens its streak', () => {
  let progress = { streaks: {} };
  progress = recordPlacement(progress, 'keys', true);
  progress = recordPlacement(progress, 'keys', true);
  assert.equal(streakOf(progress, 'keys'), 2);
});

test('putting an item anywhere else breaks its streak', () => {
  let progress = { streaks: { keys: 3 } };
  progress = recordPlacement(progress, 'keys', false);
  assert.equal(streakOf(progress, 'keys'), 0);
});

test('one item breaking its streak leaves the other items alone', () => {
  const progress = recordPlacement({ streaks: { keys: 3, wallet: 2 } }, 'keys', false);
  assert.equal(streakOf(progress, 'wallet'), 2);
});

test('recording a placement does not change the progress it was given', () => {
  const before = { streaks: { keys: 1 } };
  recordPlacement(before, 'keys', true);
  assert.deepEqual(before, { streaks: { keys: 1 } });
});

test('the home-spot hint fades as the streak grows', () => {
  assert.equal(hintLevel(0), 'shown');
  assert.equal(hintLevel(1), 'shown');
  assert.equal(hintLevel(2), 'dimmed');
  assert.equal(hintLevel(3), 'dimmed');
  assert.equal(hintLevel(4), 'hidden');
  assert.equal(hintLevel(20), 'hidden');
});
