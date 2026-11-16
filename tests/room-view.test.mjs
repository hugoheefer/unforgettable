import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Round } from '../app/js/round.js';
import { describeRoom } from '../app/js/room-view.js';
import { LAYOUT, ITEMS, DEFAULT_PLAN } from '../app/js/layout.js';
import { TEXTS } from './texts-helper.mjs';

const firstChoice = { pick: (list) => list[0], shuffle: (list) => [...list] };
const newRound = (streaks = {}) =>
  new Round({ layout: LAYOUT, items: ITEMS, plan: DEFAULT_PLAN, random: firstChoice, progress: { streaks }, texts: TEXTS });
const describe = (round) => describeRoom(round, TEXTS);
const tile = (tiles, id) => tiles.find((entry) => entry.id === id);

/** Puts every item in the coat's left pocket, so the search starts at once. */
function dropEverythingInTheLeftPocket(round) {
  for (let i = 0; i < ITEMS.length; i += 1) round.putInPocket('coat', 'coat-left');
}

test('the view shows the room you are in, its spots and the doors you can take', () => {
  const view = describe(newRound());
  assert.equal(view.room.name, 'Hallway');
  assert.ok(view.spots.some((spot) => spot.id === 'hook'));
  assert.deepEqual(view.exits.map((exit) => exit.id), ['living', 'kitchen', 'toilet', 'landing', 'garden']);
});

test('the view shows what you wear, with its pockets', () => {
  const view = describe(newRound());
  assert.deepEqual(view.worn.map((garment) => garment.id), ['coat', 'trousers']);
  assert.deepEqual(tile(view.worn, 'coat').pockets.map((pocket) => pocket.id), ['coat-left', 'coat-right', 'coat-inside']);
});

test('only a coat that can come off, and only while dropping, offers to be taken off', () => {
  const view = describe(newRound());
  assert.equal(tile(view.worn, 'coat').canTakeOff, true);
  assert.equal(tile(view.worn, 'trousers').canTakeOff, false);
});

test('a coat that hangs in this room is shown there with its pockets, and can be put on', () => {
  const round = newRound();
  round.takeOff('coat', 'coat-hooks');
  const view = describe(round);
  assert.deepEqual(view.worn.map((garment) => garment.id), ['trousers']);
  assert.equal(tile(view.hanging, 'coat').onSpot, 'coat-hooks');
  assert.equal(tile(view.hanging, 'coat').pockets.length, 3);
  assert.equal(tile(view.hanging, 'coat').canPutOn, true);
});

test('a coat that hangs in another room is not shown here', () => {
  const round = newRound();
  round.takeOff('coat', 'coat-hooks');
  round.walkTo('kitchen');
  assert.deepEqual(describe(round).hanging, []);
});

test('while dropping, the items you left on a spot or in a pocket are visible there', () => {
  const round = newRound();
  round.putDown('shoes');
  round.putInPocket('coat', 'coat-right');
  const view = describe(round);
  assert.deepEqual(tile(view.spots, 'shoes').seen, ['🔑']);
  assert.deepEqual(tile(tile(view.worn, 'coat').pockets, 'coat-right').seen, ['👛']);
});

test('while searching, a pocket shows its items only after you opened it', () => {
  const round = newRound();
  round.putInPocket('coat', 'coat-left'); // keys, the first thing to find
  for (let i = 0; i < 3; i += 1) round.putInPocket('coat', 'coat-right'); // the rest
  const pocket = () => tile(tile(describe(round).worn, 'coat').pockets, 'coat-right');
  assert.deepEqual(pocket().seen, []);
  round.openPocket('coat', 'coat-right');
  assert.deepEqual(pocket().seen, ['👛', '📱', '✂️']);
});

test('with a short streak the home spot is named and marked', () => {
  const view = describe(newRound());
  assert.equal(tile(view.spots, 'hook').hint, 'shown');
  assert.match(view.hintText, /Key hook/);
});

test('a home pocket of a garment within reach is marked, and named in the hint', () => {
  const round = newRound({ keys: 5 });
  round.putDown('hook'); // keys done, now the wallet, whose home is the inside pocket of the coat
  const view = describe(round);
  assert.equal(tile(tile(view.worn, 'coat').pockets, 'coat-inside').hint, 'shown');
  assert.match(view.hintText, /Inside pocket \(Coat\)/);
});

test('with a middle streak the home spot is only marked, not named', () => {
  const view = describe(newRound({ keys: 2 }));
  assert.equal(tile(view.spots, 'hook').hint, 'dimmed');
  assert.equal(view.hintText, '');
});

test('with a long streak nothing is hinted: memory has to do the work', () => {
  const view = describe(newRound({ keys: 4 }));
  assert.equal(tile(view.spots, 'hook').hint, 'hidden');
  assert.equal(view.hintText, '');
});

test('nothing is hinted in the find phase', () => {
  const round = newRound();
  dropEverythingInTheLeftPocket(round);
  const view = describe(round);
  assert.ok(view.spots.every((spot) => spot.hint === 'hidden'));
  assert.equal(view.hintText, '');
});

test('while dropping the instruction says what to do with the item in hand', () => {
  const view = describe(newRound());
  assert.match(view.instruction, /Put your 🔑 keys down/);
  assert.match(view.instruction, /tap a spot or a pocket/);
  assert.equal(view.verb, 'Put here');
});

test('while searching the instruction says what to find and how', () => {
  const round = newRound();
  dropEverythingInTheLeftPocket(round);
  const view = describe(round);
  assert.match(view.instruction, /Find your 🔑 keys/);
  assert.equal(view.verb, 'Look here');
});
