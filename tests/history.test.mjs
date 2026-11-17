import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyHistory, findsOfDay, putsOfDay, recordFind, recordPut, validHistory } from '../app/js/history.js';

const EMPTY = { finds: [], puts: [] };
const found = (day, thingId = 'keys', steps = 1, shortest = 1, wasHome = true) => ({ day, thingId, steps, shortest, wasHome });
const put = (day, thingId = 'keys', steps = 0, atHome = true, left = false) => ({ day, thingId, steps, atHome, left });

// ---- recording ----

test('a find is added to the finds and leaves the put-aways alone', () => {
  const history = recordFind({ finds: [], puts: [put(1)] }, found(1));
  assert.deepEqual(history, { finds: [found(1)], puts: [put(1)] });
});

test('a put-away is added to the put-aways and leaves the finds alone', () => {
  const history = recordPut({ finds: [found(1)], puts: [] }, put(1));
  assert.deepEqual(history, { finds: [found(1)], puts: [put(1)] });
});

test('records are kept in the order they happened, oldest first', () => {
  const history = recordFind(recordFind(EMPTY, found(1, 'keys')), found(1, 'wallet'));
  assert.deepEqual(history.finds.map((record) => record.thingId), ['keys', 'wallet']);
});

test('recording gives a new history and does not change the one it was given', () => {
  const before = { finds: [found(1)], puts: [] };
  const snapshot = JSON.stringify(before);
  const after = recordFind(before, found(2));
  assert.equal(JSON.stringify(before), snapshot);
  assert.deepEqual(after.finds, [found(1), found(2)]);
});

test('with record 301 the oldest find is pushed out', () => {
  let history = EMPTY;
  for (let day = 1; day <= 301; day += 1) history = recordFind(history, found(day));
  assert.equal(history.finds.length, 300);
  assert.equal(history.finds[0].day, 2);
  assert.equal(history.finds.at(-1).day, 301);
});

test('with record 301 the oldest put-away is pushed out', () => {
  let history = EMPTY;
  for (let day = 1; day <= 301; day += 1) history = recordPut(history, put(day));
  assert.equal(history.puts.length, 300);
  assert.equal(history.puts[0].day, 2);
});

test('the finds and the put-aways are limited apart: 300 of each stay', () => {
  let history = EMPTY;
  for (let day = 1; day <= 300; day += 1) history = recordPut(recordFind(history, found(day)), put(day));
  assert.equal(history.finds.length, 300);
  assert.equal(history.puts.length, 300);
});

// ---- the records of one day ----

test('the finds of a day are only the finds of that day', () => {
  const history = { finds: [found(1, 'keys'), found(2, 'wallet'), found(2, 'phone'), found(3, 'keys')], puts: [] };
  assert.deepEqual(findsOfDay(history, 2).map((record) => record.thingId), ['wallet', 'phone']);
});

test('the put-aways of a day are only the put-aways of that day', () => {
  const history = { finds: [], puts: [put(1, 'keys'), put(2, 'wallet'), put(3, 'phone')] };
  assert.deepEqual(putsOfDay(history, 2).map((record) => record.thingId), ['wallet']);
});

test('a day without records gives empty lists', () => {
  assert.deepEqual(findsOfDay(EMPTY, 5), []);
  assert.deepEqual(putsOfDay(EMPTY, 5), []);
});

// ---- loading a history that may be damaged ----

test('a well-formed history is loaded as it is', () => {
  const history = { finds: [found(1), found(2, 'wallet', 4, 3, false)], puts: [put(1), put(2, 'wallet', 2, false), put(2, 'keys', 0, false, true)] };
  assert.deepEqual(validHistory(history), history);
});

test('something that is not a history gives an empty history', () => {
  for (const nonsense of [null, undefined, 'history', 7, [], [found(1)]]) assert.deepEqual(validHistory(nonsense), EMPTY, JSON.stringify(nonsense));
});

test('a list that is missing or not a list is empty, the other list stays', () => {
  assert.deepEqual(validHistory({ finds: 'many', puts: [put(1)] }), { finds: [], puts: [put(1)] });
  assert.deepEqual(validHistory({ finds: [found(1)] }), { finds: [found(1)], puts: [] });
});

test('records that are not objects are dropped, the good ones stay', () => {
  const loaded = validHistory({ finds: [found(1), 'keys', 7, null, [1, 2], found(2)], puts: [null, put(3)] });
  assert.deepEqual(loaded, { finds: [found(1), found(2)], puts: [put(3)] });
});

const BROKEN_FINDS = {
  'no day': (r) => { delete r.day; return r; },
  'a day that is not a whole number': (r) => ({ ...r, day: 1.5 }),
  'a negative day': (r) => ({ ...r, day: -1 }),
  'no steps': (r) => { delete r.steps; return r; },
  'steps that are text': (r) => ({ ...r, steps: '3' }),
  'negative steps': (r) => ({ ...r, steps: -1 }),
  'no shortest way': (r) => { delete r.shortest; return r; },
  'a shortest way of 0': (r) => ({ ...r, shortest: 0 }),
  'a shortest way that is not a number': (r) => ({ ...r, shortest: Infinity }),
  'a thing that is not text': (r) => ({ ...r, thingId: 7 }),
  'a wasHome that is not true or false': (r) => ({ ...r, wasHome: 'yes' }),
};

for (const [name, spoil] of Object.entries(BROKEN_FINDS)) {
  test(`a find with ${name} is dropped on load`, () => {
    assert.deepEqual(validHistory({ finds: [spoil(found(1)), found(2)], puts: [] }).finds, [found(2)]);
  });
}

const BROKEN_PUTS = {
  'no steps': (r) => { delete r.steps; return r; },
  'steps that are not a whole number': (r) => ({ ...r, steps: 0.5 }),
  'an atHome that is not true or false': (r) => ({ ...r, atHome: 1 }),
  'a left that is not true or false': (r) => ({ ...r, left: 'yes' }),
  'no left at all': (r) => { delete r.left; return r; },
  'an old hurry instead of left': (r) => { delete r.left; return { ...r, hurry: false }; },
  'a find where a put-away should be': () => found(1),
};

for (const [name, spoil] of Object.entries(BROKEN_PUTS)) {
  test(`a put-away with ${name} is dropped on load`, () => {
    assert.deepEqual(validHistory({ finds: [], puts: [spoil(put(1)), put(2)] }).puts, [put(2)]);
  });
}

test('a put-away that was let go is a record like any other, with left set', () => {
  const history = recordPut(EMPTY, put(1, 'scissors', 0, false, true));
  assert.deepEqual(putsOfDay(history, 1), [{ day: 1, thingId: 'scissors', steps: 0, atHome: false, left: true }]);
});

test('a loaded history keeps only the last 300 records of each kind', () => {
  const finds = Array.from({ length: 350 }, (_, index) => found(index + 1));
  const loaded = validHistory({ finds, puts: [] });
  assert.equal(loaded.finds.length, 300);
  assert.equal(loaded.finds[0].day, 51);
});

test('a new history is empty, and each call gives a history of its own', () => {
  assert.deepEqual(emptyHistory(), { finds: [], puts: [] });
  assert.notEqual(emptyHistory(), emptyHistory());
});
