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

test('nothing says which things go with you: the openers say what must be on the person', () => {
  for (const thing of THINGS) assert.equal('carry' in thing, false, thing.id);
});

test('the suggested home of every thing is a spot or pocket that exists', () => {
  const world = new World(LAYOUT);
  for (const thing of THINGS) assert.ok(world.hasLocation(thing.home), thing.id);
});

test('the catalogue has no uses any more: the chains say how a thing is used', () => {
  for (const thing of THINGS) assert.equal('uses' in thing, false, thing.id);
});

test('the default plan is the suggested home of every thing of the catalogue: keys in the coat, scissors in the kitchen drawer', () => {
  assert.deepEqual(defaultPlan(), {
    keys: { garmentId: 'coat', pocketId: 'coat-right' },
    wallet: { garmentId: 'coat', pocketId: 'coat-inside' },
    phone: { placeId: 'kitchen', spotId: 'counter' },
    scissors: { placeId: 'kitchen', spotId: 'drawer' },
  });
});

test('the default plan follows whatever catalogue it is given, so there is one source of truth', () => {
  const other = [{ id: 'umbrella', icon: '☂️', home: { placeId: 'hall', spotId: 'umbrella' } }];
  assert.deepEqual(defaultPlan(other), { umbrella: { placeId: 'hall', spotId: 'umbrella' } });
});

test('the layout no longer keeps a second list of things or a plan of its own', () => {
  assert.equal('ITEMS' in layoutModule, false);
  assert.equal('DEFAULT_PLAN' in layoutModule, false);
});
