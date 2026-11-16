import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT, ITEMS, DEFAULT_PLAN } from '../app/js/layout.js';
import { World } from '../app/js/world.js';

const ids = (list) => list.map((entry) => entry.id);

test('every room and every item has a unique id', () => {
  assert.equal(new Set(ids(LAYOUT.places)).size, LAYOUT.places.length);
  assert.equal(new Set(ids(ITEMS)).size, ITEMS.length);
});

test('spot ids are unique over the whole game, so a spot id names one spot', () => {
  const spotIds = LAYOUT.places.flatMap((place) => ids(place.spots));
  assert.equal(new Set(spotIds).size, spotIds.length);
});

test('every door can be walked back through', () => {
  for (const place of LAYOUT.places)
    for (const exit of place.exits) {
      const other = LAYOUT.places.find((candidate) => candidate.id === exit);
      assert.ok(other, `${place.id} has a door to unknown room ${exit}`);
      assert.ok(other.exits.includes(place.id), `${exit} has no door back to ${place.id}`);
    }
});

test('every room can be reached from the start room', () => {
  const world = new World(LAYOUT);
  for (const place of LAYOUT.places) assert.notEqual(world.stepsBetween(LAYOUT.startRoomId, place.id), Infinity, place.id);
});

test('the suggested plan gives every item one spot that exists', () => {
  const world = new World(LAYOUT);
  for (const item of ITEMS) assert.ok(world.hasLocation(DEFAULT_PLAN[item.id]), item.id);
});

test('the house has all the common rooms', () => {
  const roomIds = ids(LAYOUT.places);
  for (const room of ['hall', 'living', 'dining', 'kitchen', 'toilet', 'bathroom', 'bedroom', 'study', 'garage', 'garden'])
    assert.ok(roomIds.includes(room), room);
});

test('every place has at least three spots to leave something', () => {
  for (const place of LAYOUT.places) assert.ok(place.spots.length >= 3, place.id);
});

test('the person wears a coat that can come off and trousers that cannot, each with pockets', () => {
  const [coat, trousers] = [LAYOUT.garments.find((g) => g.id === 'coat'), LAYOUT.garments.find((g) => g.id === 'trousers')];
  assert.equal(coat.startsWorn, true);
  assert.equal(coat.removable, true);
  assert.equal(trousers.removable, false);
  assert.ok(coat.pockets.length >= 3 && trousers.pockets.length >= 2);
});

test('pocket ids are unique over the whole game, and never equal a spot id', () => {
  const spotIds = LAYOUT.places.flatMap((place) => ids(place.spots));
  const pocketIds = LAYOUT.garments.flatMap((garment) => ids(garment.pockets));
  assert.equal(new Set(pocketIds).size, pocketIds.length);
  for (const id of pocketIds) assert.equal(spotIds.includes(id), false, id);
});

test('the person starts the round at the front door, in a room', () => {
  assert.equal(LAYOUT.startRoomId, 'hall');
  assert.notEqual(LAYOUT.places.find((place) => place.id === 'hall').kind, 'container');
});

test('things like tools and scissors are part of the game', () => {
  const names = ids(ITEMS);
  for (const id of ['keys', 'wallet', 'phone', 'scissors']) assert.ok(names.includes(id), id);
});
