import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Round } from '../app/js/round.js';
import { TEXTS } from './texts-helper.mjs';

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
  new Round({ layout, items, plan, random: firstChoice, progress: { streaks: {} }, texts: TEXTS, ...options });

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

// ---- garments: a coat you wear or hang up, with pockets ----
const garmentLayout = {
  ...layout,
  garments: [
    { id: 'coat', name: 'Coat', icon: '🧥', startsWorn: true, removable: true, pockets: [{ id: 'left', name: 'Left pocket', icon: '🫳' }, { id: 'right', name: 'Right pocket', icon: '🫴' }] },
    { id: 'trousers', name: 'Trousers', icon: '👖', startsWorn: true, removable: false, pockets: [{ id: 'front', name: 'Front pocket', icon: '🫳' }] },
  ],
};
const pocketPlan = { keys: { garmentId: 'coat', pocketId: 'right' }, wallet: { placeId: 'bedroom', spotId: 'nightstand' } };
const lastChoice = { pick: (list) => list[list.length - 1], shuffle: (list) => [...list] };
const coatRound = (options = {}) => newRound({ layout: garmentLayout, plan: pocketPlan, ...options });

test('an item put in a pocket of the coat you wear counts when that pocket is its home', () => {
  const round = coatRound();
  round.putInPocket('coat', 'right');
  assert.equal(round.results()[0].atHome, true);
  assert.deepEqual(round.world.whereIs('keys'), { garmentId: 'coat', pocketId: 'right' });
});

test('putting an item in another pocket of the coat does not count for the habit', () => {
  const round = coatRound();
  round.putInPocket('coat', 'left');
  assert.equal(round.results()[0].atHome, false);
});

test('taking the coat off hangs it on a spot in this room and costs a move', () => {
  const round = coatRound();
  round.takeOff('coat', 'hook');
  assert.equal(round.world.isWorn('coat'), false);
  assert.deepEqual(round.world.garmentsOn({ placeId: 'hall', spotId: 'hook' }), ['coat']);
  assert.equal(round.state().movesLeft, 2);
});

test('a garment that cannot be taken off stays on', () => {
  assert.throws(() => coatRound().takeOff('trousers', 'hook'), /cannot be taken off/i);
});

test('you can only take off what you wear, and hang it on a spot of the room you are in', () => {
  const round = coatRound();
  round.takeOff('coat', 'hook');
  assert.throws(() => round.takeOff('coat', 'shelf'), /not wearing/i);
  assert.throws(() => coatRound().takeOff('coat', 'counter'), /not in this room/i);
});

test('you can put the coat on again when it hangs in the room you are in', () => {
  const round = coatRound();
  round.takeOff('coat', 'hook');
  round.putOn('coat');
  assert.equal(round.world.isWorn('coat'), true);
});

test('you cannot put on a coat that hangs in another room', () => {
  const round = coatRound();
  round.takeOff('coat', 'hook');
  round.walkTo('kitchen');
  assert.throws(() => round.putOn('coat'), /not in this room/i);
});

test('a pocket of a coat that hangs in another room is out of reach', () => {
  const round = coatRound();
  round.takeOff('coat', 'hook');
  round.walkTo('kitchen');
  assert.throws(() => round.putInPocket('coat', 'right'), /out of reach/i);
});

test('a pocket of a coat that hangs in this room can be used', () => {
  const round = coatRound();
  round.takeOff('coat', 'hook');
  round.putInPocket('coat', 'right');
  assert.equal(round.results()[0].atHome, true);
});

test('taking the coat off when the moves run out leaves the item on the first spot of the room', () => {
  const round = coatRound({ budget: 1 });
  round.takeOff('coat', 'hook');
  assert.equal(round.results()[0].forced, true);
});

/** Keys in the coat pocket and the coat on the hook, wallet in the bedroom; the distraction ends in the kitchen. */
function hangCoatWithKeysAndLeaveWallet() {
  const round = coatRound({ random: lastChoice });
  round.takeOff('coat', 'hook');
  round.putInPocket('coat', 'right');
  round.walkTo('kitchen');
  round.walkTo('bedroom');
  round.putDown('nightstand');
  assert.equal(round.state().roomId, 'kitchen');
  return round;
}

test('keys in the pocket of a hanging coat are found by going to the coat and opening the pocket', () => {
  const round = hangCoatWithKeysAndLeaveWallet();
  assert.throws(() => round.openPocket('coat', 'right'), /out of reach/i);
  round.walkTo('hall');
  const outcome = round.openPocket('coat', 'right');
  assert.equal(outcome.found, true);
  assert.equal(round.results()[0].findCost, 2);
});

test('a pocket of the coat you wear can be opened in any room, for one move', () => {
  const round = coatRound({ random: lastChoice });
  round.putInPocket('coat', 'left');
  round.walkTo('kitchen');
  round.putDown('drawer');
  assert.equal(round.state().phase, 'find');
  const outcome = round.openPocket('coat', 'left');
  assert.equal(outcome.found, true);
  assert.equal(round.results()[0].findCost, 1);
});

test('what is in a pocket stays unseen until you open that pocket', () => {
  const round = coatRound({ random: lastChoice });
  round.putInPocket('coat', 'left');
  round.walkTo('kitchen');
  round.putDown('drawer');
  assert.deepEqual(round.seenAt({ garmentId: 'coat', pocketId: 'left' }), []);
});

test('while dropping you see what you left in a pocket you can reach', () => {
  const round = coatRound();
  round.putInPocket('coat', 'left');
  assert.deepEqual(round.seenAt({ garmentId: 'coat', pocketId: 'left' }), ['keys']);
});

test('every refused move carries a code, so the flow can tell it in the language of the player', () => {
  const coatLayout = { ...layout, garments: [{ id: 'coat', icon: '🧥', startsWorn: true, removable: true, pockets: [{ id: 'right', icon: '🫴' }] }, { id: 'belt', icon: '🥋', startsWorn: true, removable: false, pockets: [] }] };
  const make = () => newRound({ layout: coatLayout });
  const codeOf = (action) => { try { action(); } catch (error) { return error.code; } return undefined; };
  assert.equal(codeOf(() => make().walkTo('bedroom')), 'no-door');
  assert.equal(codeOf(() => make().takeOff('belt', 'hook')), 'not-removable');
  assert.equal(codeOf(() => { const r = make(); r.takeOff('coat', 'hook'); r.takeOff('coat', 'hook'); }), 'not-worn');
  assert.equal(codeOf(() => make().takeOff('coat', 'counter')), 'spot-not-here');
  assert.equal(codeOf(() => make().putOn('coat')), 'garment-not-here');
  assert.equal(codeOf(() => { const r = make(); r.takeOff('coat', 'hook'); r.walkTo('kitchen'); r.putInPocket('coat', 'right'); }), 'out-of-reach');
});
