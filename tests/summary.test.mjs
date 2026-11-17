import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVICE, summarize } from '../app/js/summary.js';

const found = (day, thingId, steps, shortest, wasHome = true) => ({ day, thingId, steps, shortest, wasHome });
const put = (day, thingId, steps, atHome = true, left = false) => ({ day, thingId, steps, atHome, left });

/** Day 3 with one cheap find, unless a test says otherwise. */
function summaryOf({ dayNumber = 3, finds = [found(3, 'keys', 1, 1)], puts = [] } = {}) {
  return summarize({ dayNumber, history: { finds, puts } });
}

// ---- what the summary does not give away ----

test('the summary does not say what lies where: no home or away lists, no places', () => {
  assert.deepEqual(Object.keys(summaryOf()).sort(), ['advice', 'finds', 'possible', 'putSteps', 'searched']);
});

// ---- the steps of one day ----

test('the steps searched are the steps of the finds of that day only', () => {
  const finds = [found(2, 'keys', 50, 5), found(3, 'keys', 4, 1), found(3, 'phone', 3, 3), found(4, 'wallet', 60, 2)];
  assert.equal(summaryOf({ finds }).searched, 7);
});

test('the possible steps are the sum of the shortest ways of that day only', () => {
  const finds = [found(2, 'keys', 50, 5), found(3, 'keys', 4, 1), found(3, 'phone', 3, 3), found(4, 'wallet', 60, 2)];
  assert.equal(summaryOf({ finds }).possible, 4);
});

test('the steps spent putting away are the steps of the put-aways of that day only', () => {
  const puts = [put(2, 'keys', 9), put(3, 'keys', 2), put(3, 'phone', 3, false), put(4, 'wallet', 7)];
  assert.equal(summaryOf({ puts }).putSteps, 5);
});

test('a thing that was let go costs no steps of putting away', () => {
  const puts = [put(3, 'keys', 2), put(3, 'scissors', 0, false, true)];
  assert.equal(summaryOf({ puts }).putSteps, 2);
});

test('a day without records has no steps at all', () => {
  const summary = summaryOf({ finds: [], puts: [] });
  assert.deepEqual([summary.searched, summary.possible, summary.putSteps], [0, 0, 0]);
});

// ---- the advice ----

test('the advice table has the three rows of the story, in order', () => {
  assert.deepEqual(ADVICE.map((row) => row.key), ['noSearch', 'costly', 'straight']);
});

test('a day without a find gives the noSearch advice, also when other days had finds', () => {
  assert.equal(summaryOf({ finds: [found(2, 'keys', 30, 1)] }).advice, 'noSearch');
});

test('searching more than twice the possible steps gives the costly advice', () => {
  assert.equal(summaryOf({ finds: [found(3, 'keys', 9, 4)] }).advice, 'costly');
});

test('searching exactly twice the possible steps is not yet costly: it gives the straight advice', () => {
  assert.equal(summaryOf({ finds: [found(3, 'keys', 8, 4)] }).advice, 'straight');
});

test('a cheap day gives the straight advice', () => {
  assert.equal(summaryOf({ finds: [found(3, 'keys', 2, 1)] }).advice, 'straight');
});
