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
  for (const item of ITEMS) assert.ok(world.hasSpot(DEFAULT_PLAN[item.id]), item.id);
});

test('every item knows what to say when it has to be found', () => {
  for (const item of ITEMS) assert.ok(item.findPrompt.length > 0, item.id);
});
