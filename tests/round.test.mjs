import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Round } from '../app/js/round.js';

const layout = {
  startRoomId: 'hall',
  places: [
    { id: 'hall', name: 'Hallway', icon: '🚪', exits: ['kitchen'], spots: [{ id: 'hook', name: 'Hook', icon: '🪝' }, { id: 'shelf', name: 'Shelf', icon: '🗄️' }] },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', exits: ['hall', 'bedroom'], spots: [{ id: 'counter', name: 'Counter', icon: '🍽️' }, { id: 'drawer', name: 'Drawer', icon: '🗃️' }] },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', exits: ['kitchen'], spots: [{ id: 'nightstand', name: 'Nightstand', icon: '🕯️' }] },
  ],
};
const items = [
  { id: 'keys', name: 'keys', icon: '🔑', findPrompt: 'You start the car: find your keys!' },
  { id: 'wallet', name: 'wallet', icon: '👛', findPrompt: 'You are at the till: find your wallet!' },
];
const plan = { keys: { placeId: 'hall', spotId: 'hook' }, wallet: { placeId: 'kitchen', spotId: 'drawer' } };
// Always the first choice and the order as given, so every scenario is deterministic.
const firstChoice = { pick: (list) => list[0], shuffle: (list) => [...list] };
const newRound = (options = {}) =>
  new Round({ layout, items, plan, random: firstChoice, progress: { streaks: {} }, ...options });

/** Puts both items on their home spots, using the shortest way. */
function dropAtHome(round) {
  round.putDown('hook');
  round.walkTo('kitchen');
  round.putDown('drawer');
}

test('the game starts in the start room with the first item in hand and some pressure', () => {
  const state = newRound().state();
  assert.equal(state.phase, 'drop');
  assert.equal(state.roomId, 'hall');
  assert.equal(state.holding, 'keys');
  assert.ok(state.pressure.length > 0);
});

test('walking through a door costs one move', () => {
  const round = newRound();
  const before = round.state().movesLeft;
  round.walkTo('kitchen');
  assert.equal(round.state().roomId, 'kitchen');
  assert.equal(round.state().movesLeft, before - 1);
});

test('you cannot walk to a room that has no door from where you are', () => {
  assert.throws(() => newRound().walkTo('bedroom'), /no door/i);
});

test('putting the item on its home spot scores and moves on to the next item', () => {
  const round = newRound();
  round.putDown('hook');
  assert.equal(round.state().holding, 'wallet');
  assert.equal(round.results().find((r) => r.itemId === 'keys').atHome, true);
  assert.equal(round.state().score, 10);
});

test('putting the item on any other spot scores nothing for the habit', () => {
  const round = newRound();
  round.putDown('shelf');
  assert.equal(round.results().find((r) => r.itemId === 'keys').atHome, false);
  assert.equal(round.state().score, 0);
});

test('the player stays in the room where the last item was put down, and the next item has fresh moves', () => {
  const round = newRound();
  round.walkTo('kitchen');
  round.putDown('counter');
  assert.equal(round.state().roomId, 'kitchen');
  assert.equal(round.state().movesLeft, 3);
});

test('when the moves run out the item is left on the first spot of the room you stand in', () => {
  const round = newRound({ budget: 2 });
  round.walkTo('kitchen');
  round.walkTo('hall');
  assert.deepEqual(round.world.whereIs('keys'), { placeId: 'hall', spotId: 'hook' });
  assert.equal(round.results()[0].forced, true);
  assert.match(round.state().notice, /interrupted/i);
});

test('a forced drop that happens to land on the home spot still does not count for the habit', () => {
  const round = newRound({ budget: 2 });
  round.walkTo('kitchen');
  round.walkTo('hall'); // interrupted in the hallway: first spot is the key hook, the planned home
  assert.deepEqual(round.world.whereIs('keys'), plan.keys);
  assert.equal(round.results()[0].atHome, false);
});

test('after the last item you are distracted and end up in another room', () => {
  const round = newRound();
  dropAtHome(round);
  const state = round.state();
  assert.equal(state.phase, 'find');
  assert.notEqual(state.roomId, 'kitchen');
  assert.ok(state.distraction.length > 0);
});

test('the home spot is hinted while the streak is short and hidden when it is long', () => {
  const round = newRound({ progress: { streaks: { keys: 0, wallet: 5 } } });
  assert.equal(round.hintFor('keys'), 'shown');
  assert.equal(round.hintFor('wallet'), 'hidden');
});

test('the find phase asks for the items one at a time with their own prompt', () => {
  const round = newRound();
  dropAtHome(round);
  assert.equal(round.state().findItem, 'keys');
  assert.equal(round.state().findPrompt, 'You start the car: find your keys!');
});

test('opening the spot that holds the item finds it for one move and nine points', () => {
  const round = newRound();
  dropAtHome(round);
  const scoreBefore = round.state().score;
  assert.equal(round.state().roomId, 'hall'); // the distraction (first other room) leaves us where the keys are
  round.open('hook');
  assert.equal(round.state().findItem, 'wallet');
  const found = round.results().find((r) => r.itemId === 'keys');
  assert.equal(found.findCost, 1);
  assert.equal(round.state().score, scoreBefore + 9);
});

test('opening an empty spot costs a move and does not find the item', () => {
  const round = newRound();
  dropAtHome(round);
  const outcome = round.open('shelf');
  assert.equal(outcome.found, false);
  assert.equal(round.state().findItem, 'keys');
});

test('opening the same spot twice costs twice', () => {
  const round = newRound();
  dropAtHome(round);
  round.open('shelf');
  round.open('shelf');
  round.open('hook');
  assert.equal(round.results().find((r) => r.itemId === 'keys').findCost, 3);
});

test('you can only open a spot in the room where you are', () => {
  const round = newRound();
  dropAtHome(round);
  assert.throws(() => round.open('counter'), /not in this room/i);
});

test('an item that is hard to find scores less but never below zero', () => {
  const round = newRound();
  dropAtHome(round);
  for (let i = 0; i < 15; i += 1) round.open('shelf');
  round.open('hook');
  const keys = round.results().find((r) => r.itemId === 'keys');
  assert.equal(keys.findPoints, 0);
});

test('what you have not opened stays unseen in the find phase', () => {
  const round = newRound();
  dropAtHome(round);
  assert.deepEqual(round.seenOn('hook'), []);
  round.open('shelf');
  assert.deepEqual(round.seenOn('shelf'), []);
});

test('the round ends when every item is found, and the streaks follow the placements', () => {
  const round = newRound({ progress: { streaks: { keys: 1, wallet: 1 } } });
  round.putDown('hook'); // keys: home
  round.putDown('shelf'); // wallet: not home
  assert.equal(round.state().roomId, 'kitchen'); // the distraction took us away; both items are in the hallway
  round.walkTo('hall');
  round.open('hook');
  round.open('shelf');
  assert.equal(round.state().phase, 'done');
  assert.deepEqual(round.progress().streaks, { keys: 2, wallet: 0 });
});

test('the distraction never takes you into a coat or a car, only into rooms', () => {
  const withCoat = {
    ...layout,
    places: [
      { id: 'coat', name: 'Coat', icon: '🧥', kind: 'container', exits: ['hall'], spots: [{ id: 'pocket', name: 'Pocket', icon: '🫳' }] },
      ...layout.places.map((place) => (place.id === 'hall' ? { ...place, exits: ['kitchen', 'coat'] } : place)),
    ],
  };
  const round = newRound({ layout: withCoat });
  dropAtHome(round);
  assert.notEqual(round.state().roomId, 'coat');
});
