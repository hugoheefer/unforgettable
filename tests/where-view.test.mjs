import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whereEverythingIs } from '../app/js/where-view.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS } from '../app/js/things.js';
import { World } from '../app/js/world.js';
import { TEXTS } from './texts-helper.mjs';
import { PLAN } from './day-helper.mjs';

const KEYS = THINGS.filter((thing) => thing.id === 'keys');

/** The lines of the test view; the things come first, then the coat. */
function linesFor({ world = new World(LAYOUT), hand = [], roomId = null, things = KEYS } = {}) {
  return whereEverythingIs({ layout: LAYOUT, things, world, plan: PLAN, hand, roomId, texts: TEXTS });
}

test('a thing on its home spot is listed with where it lies and that it is home', () => {
  const world = new World(LAYOUT);
  world.put('keys', PLAN.keys);
  assert.equal(linesFor({ world })[0], '🔑 your keys: on the key hook in the hallway ✓ home spot');
});

test('a thing away from its home spot is listed with where it lies, without the home mark', () => {
  const world = new World(LAYOUT);
  world.put('keys', { placeId: 'kitchen', spotId: 'counter' });
  assert.equal(linesFor({ world })[0], '🔑 your keys: on the worktop in the kitchen');
});

test('a thing in a pocket names the pocket', () => {
  const world = new World(LAYOUT);
  world.put('keys', { garmentId: 'coat', pocketId: 'coat-left' });
  assert.equal(linesFor({ world })[0], '🔑 your keys: in the left pocket of your coat');
});

test('a thing the player holds is in their hand', () => {
  assert.equal(linesFor({ hand: ['keys'] })[0], '🔑 your keys: in your hand');
});

test('during a session the first line says where the player stands', () => {
  const world = new World(LAYOUT);
  world.put('keys', PLAN.keys);
  assert.equal(linesFor({ world, roomId: 'kitchen' })[0], 'You are in the kitchen.');
});

test('the coat is listed as worn while the player wears it', () => {
  const world = new World(LAYOUT);
  world.wear('coat');
  assert.deepEqual(linesFor({ world, things: [] }), ['🧥 your coat: you wear it']);
});

test('a coat that was taken off is listed where it lies', () => {
  const world = new World(LAYOUT);
  world.hang('coat', { placeId: 'hall', spotId: 'hook' });
  assert.deepEqual(linesFor({ world, things: [] }), ['🧥 your coat: on the key hook in the hallway']);
});
