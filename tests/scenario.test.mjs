import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDay, HURRY_REASONS } from '../app/js/scenario.js';
import { createRandomSource } from '../app/js/random-source.js';
import { THINGS } from '../app/js/things.js';
import { find, moveTo, pause, putAway, rand } from './day-helper.mjs';

const home = { placeId: 'hall', spotId: 'hook' };
const thing = (id, { carry = false, uses = [{ id: `${id}-use`, roomId: 'study' }] } = {}) => ({ id, icon: '?', carry, home, uses });
const A = thing('a', { carry: true, uses: [{ id: 'a-use', roomId: 'garden' }] });
const B = thing('b', { carry: true, uses: [{ id: 'b-use', roomId: 'shed' }] });
const C = thing('c', { uses: [{ id: 'c-use', roomId: 'car' }] });
const D = thing('d', { uses: [{ id: 'd-use', roomId: 'study' }] });

const kindsOf = (events) => events.map((event) => event.kind);
const putAways = (events) => events.filter((event) => event.kind === 'putAway');
const day = (options) => buildDay({ dayNumber: 2, things: [A, B, C, D], nowhere: [], random: rand(), ...options });
/** The three events of one use of a thing. */
const useEvents = (use) => [find(use.thing, use.id), moveTo(use.room, 'after', { thingId: use.thing, useId: use.id }), putAway(use.thing)];

test('the first day starts with the day number and coming home', () => {
  const events = day({ dayNumber: 1, nowhere: ['a', 'b', 'c', 'd'] });
  assert.deepEqual(events.slice(0, 2), [pause('day'), moveTo('hall', 'arrive')]);
});

test('the first day has a put-away for every chosen thing, in shuffled order', () => {
  const events = day({ dayNumber: 1, nowhere: ['a', 'b', 'c', 'd'], random: rand({ shuffle: (list) => [...list].reverse() }) });
  assert.deepEqual(events.slice(2, 6), ['d', 'c', 'b', 'a'].map((id) => putAway(id)));
});

test('a day with one thing nowhere brings only that thing home and does not leave the house', () => {
  const events = day({ nowhere: ['c'] });
  assert.deepEqual(events.slice(0, 3), [pause('day'), moveTo('hall', 'arrive'), putAway('c')]);
  assert.equal(events.some((event) => event.text === 'morning'), false);
});

test('a later day with nothing nowhere leaves from a morning room, finding only things that go with you', () => {
  const events = day();
  assert.deepEqual(events.slice(0, 5), [pause('day'), moveTo('bedroom', 'morning'), find('a'), find('b'), pause('outForTheDay')]);
});

test('the morning room is the bedroom, the kitchen or the living room, picked at random', () => {
  const lastOfList = rand({ pick: (list) => list[list.length - 1] });
  assert.equal(day({ random: lastOfList })[1].roomId, 'living');
});

test('you come home and put away what you took, after being out for the day', () => {
  const events = day();
  assert.deepEqual(events.slice(5, 8), [moveTo('hall', 'arrive'), putAway('a'), putAway('b')]);
});

test('at most three things leave with you, however many are chosen', () => {
  const many = ['p', 'q', 'r', 's', 't'].map((id) => thing(id, { carry: true }));
  const events = buildDay({ dayNumber: 2, things: many, nowhere: [], random: rand() });
  assert.equal(events.filter((event) => event.kind === 'find' && event.useId === null).length, 3);
});

test('when no chosen thing goes with you the day has no leaving part', () => {
  const events = day({ things: [C, D] });
  assert.deepEqual(events.slice(0, 2), [pause('day'), find('c', 'c-use')]);
});

test('a day has two uses, for two different things, each a find, a move to the use room and a put-away', () => {
  const events = day({ things: [C, D] });
  assert.deepEqual(events.slice(1), [...useEvents({ thing: 'c', id: 'c-use', room: 'car' }), ...useEvents({ thing: 'd', id: 'd-use', room: 'study' })]);
});

test('with one chosen thing the day has one use, not the same thing twice', () => {
  const events = day({ things: [C] });
  assert.deepEqual(events.slice(1), useEvents({ thing: 'c', id: 'c-use', room: 'car' }));
});

test('the uses prefer things that did not leave with you in the morning', () => {
  const events = day();
  const used = events.slice(8).filter((event) => event.kind === 'find').map((event) => event.thingId);
  assert.deepEqual(used, ['c', 'd']);
});

test('when too few other things exist, a use falls back on a thing that left with you', () => {
  const events = day({ things: [A, B, C] });
  assert.deepEqual(events.slice(8).filter((event) => event.kind === 'find').map((event) => event.thingId), ['c', 'a']);
});

test('the use of a thing is picked at random from its uses', () => {
  const twoUses = thing('c', { uses: [{ id: 'first', roomId: 'car' }, { id: 'second', roomId: 'shed' }] });
  const events = buildDay({ dayNumber: 2, things: [twoUses], nowhere: [], random: rand({ pick: (list) => list[list.length - 1] }) });
  assert.deepEqual(events.slice(1), useEvents({ thing: 'c', id: 'second', room: 'shed' }));
});

test('with luck one put-away of the day is hurried, for a known reason', () => {
  const events = day({ random: rand({ chance: () => true }) });
  const hurried = putAways(events).filter((event) => event.hurry !== null);
  assert.equal(hurried.length, 1);
  assert.ok(HURRY_REASONS.some((reason) => reason.id === hurried[0].hurry));
});

test('without luck no put-away is hurried', () => {
  assert.equal(putAways(day()).every((event) => event.hurry === null), true);
});

test('the first day is never hurried, even with luck', () => {
  const events = day({ dayNumber: 1, nowhere: ['a', 'b', 'c', 'd'], random: rand({ chance: () => true }) });
  assert.equal(putAways(events).every((event) => event.hurry === null), true);
});

test('the events are plain data that survive a JSON round trip unchanged', () => {
  const events = day({ random: rand({ chance: () => true }) });
  assert.deepEqual(JSON.parse(JSON.stringify(events)), events);
});

/** Plays the events on paper: a find needs the thing to be in the world, a put-away puts it back. */
function assertEveryFindHasSomethingToFind(events, chosen, nowhere) {
  const inWorld = new Set(chosen.filter((id) => !nowhere.includes(id)));
  const inHand = new Set();
  for (const event of events) {
    if (event.kind === 'find') {
      assert.ok(inWorld.has(event.thingId), `${event.thingId} is not anywhere when it has to be found`);
      inWorld.delete(event.thingId);
      inHand.add(event.thingId);
    } else if (event.kind === 'putAway') {
      assert.ok(inHand.has(event.thingId) || nowhere.includes(event.thingId), `${event.thingId} is not in hand`);
      inHand.delete(event.thingId);
      inWorld.add(event.thingId);
    }
  }
  assert.deepEqual([...inWorld].sort(), [...chosen].sort());
}

test('every find of every kind of day is for a thing that is somewhere at that moment', () => {
  let seed = 7;
  const next = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const random = createRandomSource(next);
  for (let round = 0; round < 80; round += 1) {
    const nowhere = THINGS.filter(() => next() < 0.3).map((chosen) => chosen.id);
    const events = buildDay({ dayNumber: 1 + (round % 3), things: THINGS, nowhere, random });
    assertEveryFindHasSomethingToFind(events, THINGS.map((chosen) => chosen.id), nowhere);
  }
});

test('the day only holds events for the chosen things, and uses that exist in the catalogue', () => {
  const events = day({ things: [A, C] });
  const chosen = new Set(['a', 'c']);
  for (const event of events.filter((entry) => entry.thingId)) assert.ok(chosen.has(event.thingId), event.thingId);
  const useIds = events.filter((event) => event.useId).map((event) => event.useId);
  assert.ok(useIds.every((id) => ['a-use', 'c-use'].includes(id)));
});

const wantsPhone = (list) => (list.includes('phone') ? 'phone' : list[0]);

test('the phone that rings in another room is never the reason to hurry with the phone itself', () => {
  const phone = thing('phone', { uses: [{ id: 'call', roomId: 'garden' }] });
  const events = buildDay({ dayNumber: 2, things: [phone], nowhere: ['phone'], random: rand({ chance: () => true, pick: wantsPhone }) });
  assert.notEqual(putAways(events)[0].hurry, 'phone');
  assert.notEqual(putAways(events)[0].hurry, null);
});

test('the phone that rings in another room is a reason to hurry with any other thing', () => {
  const events = buildDay({ dayNumber: 2, things: [C], nowhere: ['c'], random: rand({ chance: () => true, pick: wantsPhone }) });
  assert.equal(putAways(events)[0].hurry, 'phone');
});
