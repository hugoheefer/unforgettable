import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Round } from '../app/js/round.js';
import { describeRoom } from '../app/js/room-view.js';
import { LAYOUT, ITEMS, DEFAULT_PLAN } from '../app/js/layout.js';

const firstChoice = { pick: (list) => list[0], shuffle: (list) => [...list] };
const newRound = (streaks = {}) =>
  new Round({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, random: firstChoice, progress: { streaks } });
const spotView = (view, id) => view.spots.find((spot) => spot.id === id);

test('the view shows the room you are in, its spots and the doors you can take', () => {
  const view = describeRoom(newRound());
  assert.equal(view.room.name, 'Hallway');
  assert.deepEqual(view.spots.map((spot) => spot.id), ['hook', 'shelf', 'shoes']);
  assert.deepEqual(view.exits.map((exit) => exit.id), ['living', 'kitchen', 'coat', 'car']);
});

test('while dropping, the items you left on a spot are visible on it', () => {
  const round = newRound();
  round.putDown('shelf');
  assert.deepEqual(spotView(describeRoom(round), 'shelf').seen, ['🔑']);
});

test('while searching, a spot shows its items only after you opened it', () => {
  const round = newRound();
  round.putDown('hook');
  round.walkTo('kitchen');
  round.putDown('counter');
  round.walkTo('hall');
  round.putDown('hook');
  // searching starts in the first other room: the living room; walk to the hallway and look
  round.walkTo('hall');
  assert.deepEqual(spotView(describeRoom(round), 'hook').seen, []);
  round.open('hook');
  assert.deepEqual(spotView(describeRoom(round), 'hook').seen, []); // the found item was taken in hand
});

test('with a short streak the home spot is named and marked', () => {
  const view = describeRoom(newRound());
  assert.equal(spotView(view, 'hook').hint, 'shown');
  assert.match(view.hintText, /Key hook/);
});

test('with a middle streak the home spot is only marked, not named', () => {
  const view = describeRoom(newRound({ keys: 2 }));
  assert.equal(spotView(view, 'hook').hint, 'dimmed');
  assert.equal(view.hintText, '');
});

test('with a long streak nothing is hinted: memory has to do the work', () => {
  const view = describeRoom(newRound({ keys: 4 }));
  assert.equal(spotView(view, 'hook').hint, 'hidden');
  assert.equal(view.hintText, '');
});

test('the home spot is not hinted in the find phase', () => {
  const round = newRound();
  round.putDown('hook');
  round.walkTo('kitchen');
  round.putDown('counter');
  round.walkTo('hall');
  round.putDown('hook');
  assert.equal(round.state().phase, 'find');
  assert.ok(describeRoom(round).spots.every((spot) => spot.hint === 'hidden'));
});
