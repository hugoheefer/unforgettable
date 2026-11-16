import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as layoutModule from '../app/js/layout.js';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World } from '../app/js/world.js';

const byId = (id) => THINGS.find((thing) => thing.id === id);

test('the catalogue holds keys, wallet, phone and scissors, each with an icon', () => {
  assert.deepEqual(THINGS.map((thing) => [thing.id, thing.icon]), [['keys', '🔑'], ['wallet', '👛'], ['phone', '📱'], ['scissors', '✂️']]);
});

test('every thing has its own id', () => {
  assert.equal(new Set(THINGS.map((thing) => thing.id)).size, THINGS.length);
});

test('keys, wallet and phone go with you when you leave, scissors stay at home', () => {
  assert.deepEqual(THINGS.filter((thing) => thing.carry).map((thing) => thing.id), ['keys', 'wallet', 'phone']);
});

test('the suggested home of every thing is a spot or pocket that exists', () => {
  const world = new World(LAYOUT);
  for (const thing of THINGS) assert.ok(world.hasLocation(thing.home), thing.id);
});

test('every use takes place in a room that exists, and a thing has at least one use', () => {
  const rooms = LAYOUT.places.map((place) => place.id);
  for (const thing of THINGS) {
    assert.ok(thing.uses.length >= 1, thing.id);
    for (const use of thing.uses) assert.ok(rooms.includes(use.roomId), `${thing.id}/${use.id}`);
  }
});

test('the use ids of one thing are different from each other', () => {
  for (const thing of THINGS) assert.equal(new Set(thing.uses.map((use) => use.id)).size, thing.uses.length, thing.id);
});

test('the keys are used in the shed and at the car', () => {
  assert.deepEqual(byId('keys').uses.map((use) => use.roomId), ['shed', 'car']);
});

test('the default plan is the suggested home of every thing of the catalogue', () => {
  assert.deepEqual(defaultPlan(), {
    keys: { placeId: 'hall', spotId: 'hook' },
    wallet: { garmentId: 'coat', pocketId: 'coat-inside' },
    phone: { placeId: 'kitchen', spotId: 'counter' },
    scissors: { placeId: 'study', spotId: 'desk-drawer' },
  });
});

test('the default plan follows whatever catalogue it is given, so there is one source of truth', () => {
  const other = [{ id: 'umbrella', icon: '☂️', carry: false, home: { placeId: 'hall', spotId: 'umbrella' }, uses: [] }];
  assert.deepEqual(defaultPlan(other), { umbrella: { placeId: 'hall', spotId: 'umbrella' } });
});

test('the layout no longer keeps a second list of things or a plan of its own', () => {
  assert.equal('ITEMS' in layoutModule, false);
  assert.equal('DEFAULT_PLAN' in layoutModule, false);
});
