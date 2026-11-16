import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../app/js/world.js';

const layout = {
  places: [
    { id: 'hall', name: 'Hallway', icon: '🚪', spots: [{ id: 'hook', name: 'Hook', icon: '🪝' }, { id: 'shelf', name: 'Shelf', icon: '🗄️' }], exits: ['kitchen'] },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', spots: [{ id: 'counter', name: 'Counter', icon: '🍽️' }], exits: ['hall', 'bedroom'] },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', spots: [{ id: 'nightstand', name: 'Nightstand', icon: '🕯️' }], exits: ['kitchen'] },
  ],
};

test('an item that is put down is found on that spot', () => {
  const world = new World(layout);
  world.put('keys', { placeId: 'hall', spotId: 'hook' });
  assert.deepEqual(world.whereIs('keys'), { placeId: 'hall', spotId: 'hook' });
  assert.deepEqual(world.itemsOn({ placeId: 'hall', spotId: 'hook' }), ['keys']);
});

test('an item is in one place only: putting it down again moves it', () => {
  const world = new World(layout);
  world.put('keys', { placeId: 'hall', spotId: 'hook' });
  world.put('keys', { placeId: 'kitchen', spotId: 'counter' });
  assert.deepEqual(world.itemsOn({ placeId: 'hall', spotId: 'hook' }), []);
  assert.deepEqual(world.whereIs('keys'), { placeId: 'kitchen', spotId: 'counter' });
});

test('an item that was never put down is nowhere', () => {
  assert.equal(new World(layout).whereIs('keys'), null);
});

test('taking an item removes it from its spot', () => {
  const world = new World(layout);
  world.put('keys', { placeId: 'hall', spotId: 'hook' });
  world.take('keys');
  assert.equal(world.whereIs('keys'), null);
  assert.deepEqual(world.itemsOn({ placeId: 'hall', spotId: 'hook' }), []);
});

test('putting an item on a spot that does not exist is refused', () => {
  const world = new World(layout);
  assert.throws(() => world.put('keys', { placeId: 'hall', spotId: 'sofa' }), /unknown spot/i);
  assert.throws(() => world.put('keys', { placeId: 'garden', spotId: 'hook' }), /unknown spot/i);
});

test('the exits of a room are the rooms you can walk to from it', () => {
  assert.deepEqual(new World(layout).exitsOf('kitchen'), ['hall', 'bedroom']);
});

test('walking to the room you are in costs nothing, a neighbour one step, two rooms away two steps', () => {
  const world = new World(layout);
  assert.equal(world.stepsBetween('hall', 'hall'), 0);
  assert.equal(world.stepsBetween('hall', 'kitchen'), 1);
  assert.equal(world.stepsBetween('hall', 'bedroom'), 2);
});

test('a room nobody can walk to has no distance', () => {
  const lonely = { places: [...layout.places, { id: 'attic', name: 'Attic', icon: '🏚️', spots: [], exits: [] }] };
  assert.equal(new World(lonely).stepsBetween('hall', 'attic'), Infinity);
});
