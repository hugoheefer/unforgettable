import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, locationKey, parseLocationKey } from '../app/js/world.js';

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

const withCoat = {
  ...layout,
  garments: [
    { id: 'coat', name: 'Coat', icon: '🧥', startsWorn: true, pockets: [{ id: 'left', name: 'Left pocket', icon: '🫳' }, { id: 'right', name: 'Right pocket', icon: '🫴' }] },
    { id: 'jacket', name: 'Jacket', icon: '🧥', startsAt: { placeId: 'bedroom', spotId: 'nightstand' }, pockets: [{ id: 'inner', name: 'Inner pocket', icon: '🧷' }] },
  ],
};

test('an item that is put in a pocket is found in that pocket', () => {
  const world = new World(withCoat);
  world.put('keys', { garmentId: 'coat', pocketId: 'right' });
  assert.deepEqual(world.whereIs('keys'), { garmentId: 'coat', pocketId: 'right' });
  assert.deepEqual(world.itemsOn({ garmentId: 'coat', pocketId: 'right' }), ['keys']);
});

test('putting an item in a pocket that does not exist is refused', () => {
  const world = new World(withCoat);
  assert.throws(() => world.put('keys', { garmentId: 'coat', pocketId: 'secret' }), /unknown spot or pocket/i);
  assert.throws(() => world.put('keys', { garmentId: 'cape', pocketId: 'left' }), /unknown spot or pocket/i);
});

test('a garment starts worn or lies where it was said to lie', () => {
  const world = new World(withCoat);
  assert.equal(world.isWorn('coat'), true);
  assert.equal(world.isWorn('jacket'), false);
  assert.deepEqual(world.garmentsOn({ placeId: 'bedroom', spotId: 'nightstand' }), ['jacket']);
});

test('hanging a worn garment on a spot puts it there and it is no longer worn', () => {
  const world = new World(withCoat);
  world.hang('coat', { placeId: 'hall', spotId: 'hook' });
  assert.equal(world.isWorn('coat'), false);
  assert.deepEqual(world.garmentsOn({ placeId: 'hall', spotId: 'hook' }), ['coat']);
});

test('hanging a garment on a spot that does not exist is refused', () => {
  assert.throws(() => new World(withCoat).hang('coat', { placeId: 'hall', spotId: 'sofa' }), /unknown spot or pocket/i);
});

test('the things in a pocket stay in the pocket when the garment is moved', () => {
  const world = new World(withCoat);
  world.put('keys', { garmentId: 'coat', pocketId: 'left' });
  world.hang('coat', { placeId: 'kitchen', spotId: 'counter' });
  assert.deepEqual(world.whereIs('keys'), { garmentId: 'coat', pocketId: 'left' });
});

test('putting a hanging garment on makes it worn and takes it off its spot', () => {
  const world = new World(withCoat);
  world.wear('jacket');
  assert.equal(world.isWorn('jacket'), true);
  assert.deepEqual(world.garmentsOn({ placeId: 'bedroom', spotId: 'nightstand' }), []);
});

test('the worn garments are listed', () => {
  assert.deepEqual(new World(withCoat).wornGarments(), ['coat']);
});

test('a location is valid when it is a real spot or a real pocket', () => {
  const world = new World(withCoat);
  assert.equal(world.hasLocation({ placeId: 'hall', spotId: 'hook' }), true);
  assert.equal(world.hasLocation({ garmentId: 'coat', pocketId: 'left' }), true);
  assert.equal(world.hasLocation({ placeId: 'hall', spotId: 'left' }), false);
  assert.equal(world.hasLocation({}), false);
});

test('something that is not a location at all is not a valid location', () => {
  const world = new World(withCoat);
  for (const nonsense of ['hook', 7, null, undefined]) assert.equal(world.hasLocation(nonsense), false, String(nonsense));
});

test('a worn garment is in no room, a hanging one is in the room of its spot', () => {
  const world = new World(withCoat);
  assert.equal(world.garmentRoom('coat'), null);
  assert.equal(world.garmentRoom('jacket'), 'bedroom');
});

test('a location survives being turned into a key and back, for spots and for pockets', () => {
  for (const location of [{ placeId: 'hall', spotId: 'hook' }, { garmentId: 'coat', pocketId: 'left' }])
    assert.deepEqual(parseLocationKey(locationKey(location)), location);
});

test('the spot of a hanging garment is known, and a worn garment has none', () => {
  const world = new World(withCoat);
  assert.deepEqual(world.garmentSpot('jacket'), { placeId: 'bedroom', spotId: 'nightstand' });
  assert.equal(world.garmentSpot('coat'), null);
});

// Story 1: the world persists

function furnishedWorld() {
  const world = new World(withCoat);
  world.put('keys', { placeId: 'hall', spotId: 'hook' });
  world.put('wallet', { garmentId: 'coat', pocketId: 'right' });
  world.hang('coat', { placeId: 'kitchen', spotId: 'counter' });
  return world;
}

test('a restored world answers where things are and where garments are like the original', () => {
  const original = furnishedWorld();
  const restored = World.restore(withCoat, original.snapshot());
  assert.deepEqual(restored.whereIs('keys'), { placeId: 'hall', spotId: 'hook' });
  assert.deepEqual(restored.whereIs('wallet'), { garmentId: 'coat', pocketId: 'right' });
  assert.deepEqual(restored.itemsOn({ placeId: 'hall', spotId: 'hook' }), ['keys']);
  assert.deepEqual(restored.garmentsOn({ placeId: 'kitchen', spotId: 'counter' }), ['coat']);
  assert.equal(restored.isWorn('coat'), false);
  assert.equal(restored.isWorn('jacket'), false);
});

test('a restored world keeps a garment that is still worn', () => {
  const restored = World.restore(withCoat, new World(withCoat).snapshot());
  assert.equal(restored.isWorn('coat'), true);
});

test('the snapshot of a world survives being written as JSON and read back', () => {
  const snapshot = furnishedWorld().snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
  assert.deepEqual(World.restore(withCoat, JSON.parse(JSON.stringify(snapshot))).snapshot(), snapshot);
});

test('a snapshot lists the things and the garments in the shape of the save', () => {
  assert.deepEqual(furnishedWorld().snapshot(), {
    things: { keys: { placeId: 'hall', spotId: 'hook' }, wallet: { garmentId: 'coat', pocketId: 'right' } },
    garments: { coat: { placeId: 'kitchen', spotId: 'counter' }, jacket: { placeId: 'bedroom', spotId: 'nightstand' } },
  });
});

test('a snapshot is not changed by moves made in the world it came from afterwards', () => {
  const world = furnishedWorld();
  const snapshot = world.snapshot();
  world.put('keys', { placeId: 'kitchen', spotId: 'counter' });
  world.wear('coat');
  assert.deepEqual(snapshot.things.keys, { placeId: 'hall', spotId: 'hook' });
  assert.deepEqual(snapshot.garments.coat, { placeId: 'kitchen', spotId: 'counter' });
});

test('a restored world is not changed by moves made in the world the snapshot came from', () => {
  const world = furnishedWorld();
  const restored = World.restore(withCoat, world.snapshot());
  world.hang('jacket', { placeId: 'hall', spotId: 'hook' });
  assert.deepEqual(restored.garmentSpot('jacket'), { placeId: 'bedroom', spotId: 'nightstand' });
});

test('a snapshot with a spot that does not exist loses only that thing', () => {
  const snapshot = { things: { keys: { placeId: 'hall', spotId: 'sofa' }, phone: { placeId: 'kitchen', spotId: 'counter' } }, garments: {} };
  const restored = World.restore(withCoat, snapshot);
  assert.equal(restored.whereIs('keys'), null);
  assert.deepEqual(restored.whereIs('phone'), { placeId: 'kitchen', spotId: 'counter' });
});

test('a snapshot with a pocket that does not exist loses only that thing', () => {
  const snapshot = { things: { keys: { garmentId: 'coat', pocketId: 'secret' }, phone: { garmentId: 'coat', pocketId: 'left' } }, garments: {} };
  const restored = World.restore(withCoat, snapshot);
  assert.equal(restored.whereIs('keys'), null);
  assert.deepEqual(restored.whereIs('phone'), { garmentId: 'coat', pocketId: 'left' });
});

test('a thing whose location is not an object is dropped', () => {
  const restored = World.restore(withCoat, { things: { keys: 'hall/hook', wallet: null, phone: 7 }, garments: {} });
  for (const id of ['keys', 'wallet', 'phone']) assert.equal(restored.whereIs(id), null, id);
});

test('a garment that is not in the layout is dropped', () => {
  const restored = World.restore(withCoat, { things: {}, garments: { cape: 'worn' } });
  assert.deepEqual(restored.snapshot().garments, new World(withCoat).snapshot().garments);
});

test('a garment on a spot that does not exist stays in its starting state', () => {
  const restored = World.restore(withCoat, { things: {}, garments: { coat: { placeId: 'hall', spotId: 'sofa' }, jacket: { placeId: 'attic', spotId: 'box' } } });
  assert.equal(restored.isWorn('coat'), true);
  assert.deepEqual(restored.garmentSpot('jacket'), { placeId: 'bedroom', spotId: 'nightstand' });
});

test('a garment whose entry is neither worn nor a spot stays in its starting state', () => {
  const restored = World.restore(withCoat, { things: {}, garments: { coat: 'lost', jacket: 5 } });
  assert.equal(restored.isWorn('coat'), true);
  assert.deepEqual(restored.garmentSpot('jacket'), { placeId: 'bedroom', spotId: 'nightstand' });
});

test('a garment saved as worn is worn again, also when it started on a spot', () => {
  const restored = World.restore(withCoat, { things: {}, garments: { jacket: 'worn' } });
  assert.equal(restored.isWorn('jacket'), true);
});

test('a snapshot that is not a plain object gives a fresh world, without an error', () => {
  for (const nonsense of ['text', null, [], 7, undefined]) {
    const restored = World.restore(withCoat, nonsense);
    assert.deepEqual(restored.snapshot(), new World(withCoat).snapshot(), String(nonsense));
  }
});

test('a snapshot whose things or garments are not objects gives a world with nothing of that kind restored', () => {
  const restored = World.restore(withCoat, { things: 'many', garments: [] });
  assert.deepEqual(restored.snapshot(), new World(withCoat).snapshot());
});
