import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADVICE, summarize } from '../app/js/summary.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { pocket, spot, worldWith } from './day-helper.mjs';

const found = (day, thingId, steps, shortest, wasHome = true) => ({ day, thingId, steps, shortest, wasHome });
const put = (day, thingId, steps, atHome = true) => ({ day, thingId, steps, atHome, hurry: false });

const AT_HOME = {
  keys: spot('hall', 'hook'),
  wallet: pocket('coat', 'coat-inside'),
  phone: spot('kitchen', 'counter'),
  scissors: spot('study', 'desk-drawer'),
};

/** Day 3 with one cheap find, everything home, unless a test says otherwise. */
function summaryOf({ dayNumber = 3, finds = [found(3, 'keys', 1, 1)], puts = [], placed = {} } = {}) {
  return summarize({ dayNumber, history: { finds, puts }, world: worldWith({ ...AT_HOME, ...placed }), plan: defaultPlan(), things: THINGS });
}

// ---- where the things are tonight ----

test('with everything on its home spot, all things are home and none is elsewhere', () => {
  const { home, away } = summaryOf();
  assert.deepEqual(home, ['keys', 'wallet', 'phone', 'scissors']);
  assert.deepEqual(away, []);
});

test('a thing on another spot is elsewhere, with the place where it lies', () => {
  const { home, away } = summaryOf({ placed: { phone: spot('garden', 'garden-table') } });
  assert.deepEqual(home, ['keys', 'wallet', 'scissors']);
  assert.deepEqual(away, [{ thingId: 'phone', location: spot('garden', 'garden-table') }]);
});

test('a thing in the wrong pocket is elsewhere, and its place is the pocket', () => {
  const { away } = summaryOf({ placed: { wallet: pocket('coat', 'coat-left') } });
  assert.deepEqual(away, [{ thingId: 'wallet', location: pocket('coat', 'coat-left') }]);
});

test('things elsewhere come in the order of the catalogue', () => {
  const { away } = summaryOf({ placed: { scissors: spot('study', 'desk'), keys: spot('hall', 'console') } });
  assert.deepEqual(away.map((entry) => entry.thingId), ['keys', 'scissors']);
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

test('a day without records has no steps at all', () => {
  const summary = summaryOf({ finds: [], puts: [] });
  assert.deepEqual([summary.searched, summary.possible, summary.putSteps], [0, 0, 0]);
});

// ---- the advice ----

test('the advice table has the four rows of the story, in order', () => {
  assert.deepEqual(ADVICE.map((row) => row.key), ['noSearch', 'costly', 'allHome', 'someAway']);
});

test('a day without a find gives the noSearch advice, also when things are elsewhere and other days had finds', () => {
  const summary = summaryOf({ finds: [found(2, 'keys', 30, 1)], placed: { phone: spot('garden', 'garden-table') } });
  assert.equal(summary.advice, 'noSearch');
});

test('searching more than twice the possible steps gives the costly advice, even when everything is home', () => {
  assert.equal(summaryOf({ finds: [found(3, 'keys', 9, 4)] }).advice, 'costly');
});

test('searching exactly twice the possible steps is not yet costly', () => {
  assert.equal(summaryOf({ finds: [found(3, 'keys', 8, 4)] }).advice, 'allHome');
});

test('a cheap day with everything on its home spot gives the allHome advice', () => {
  assert.equal(summaryOf({ finds: [found(3, 'keys', 2, 1)] }).advice, 'allHome');
});

test('a cheap day with a thing elsewhere gives the someAway advice', () => {
  assert.equal(summaryOf({ placed: { phone: spot('garden', 'garden-table') } }).advice, 'someAway');
});

test('costly wins over someAway too: the first row that fits is the advice', () => {
  const summary = summaryOf({ finds: [found(3, 'keys', 9, 4)], placed: { phone: spot('garden', 'garden-table') } });
  assert.equal(summary.advice, 'costly');
});
