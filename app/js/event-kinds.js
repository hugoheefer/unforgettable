// What each kind of event of a day does, and what a saved event of its kind must hold. Split from day.js so the
// table of kinds (a new kind is a new row) and the checks of a saved day stand apart from the running of a day.

import { World, isPocket, sameLocation } from './world.js';
import { recordPlacement } from './habit.js';
import { CHAINS, hasStep } from './chains.js';

/** Looking where a thing lies is one step, however near. */
const LOOK_STEPS = 1;

const PAUSE_TEXTS = ['day'];

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isWholeNumber = (value) => Number.isInteger(value) && value >= 0;
const isFindStart = (note) => isObject(note) && Number.isInteger(note.shortest) && note.shortest >= 1 && typeof note.wasHome === 'boolean';

/** The step an event comes from. The events a forgotten thing adds belong to no chain (both are null). */
const isStep = (event, context) => hasStep(event.chain, event.step, context.chains);
// a tell is tied to a room only when its step says so; a check is a thought and has none
const isRoomOrNone = (event, context) => event.roomId === null || context.rooms.has(event.roomId);
const isStepOrNone = (event, context) => (event.chain === null && event.step === null) || isStep(event, context);

/**
 * What each kind of event does when it begins (`enter`), when it is over (`isDone`), and what a saved event of
 * its kind must hold (`isValid`, checked before a saved day is continued). Also what the player may do meanwhile:
 * `canWalk`, `canHandle` (put things away, coat on and off), `waitsForNext`, and `room`, the room the story
 * stands in, which the player is asked to come back to. `day.js` never switches on the kind.
 * A move is done at once: it sets the room and leaves its text for the next screen.
 */
export const EVENT_KINDS = {
  pause: {
    waitsForNext: true,
    enter() {},
    isDone: (day) => day.acknowledged,
    isValid: (event) => PAUSE_TEXTS.includes(event.text),
  },
  tell: {
    canWalk: true,
    canHandle: true,
    waitsForNext: true,
    room: (event) => event.roomId,
    enter() {},
    isDone: (day) => day.acknowledged,
    isValid: (event, context) => isRoomOrNone(event, context) && isStep(event, context),
  },
  moveTo: {
    enter(day, event) {
      day.roomId = event.roomId;
      day.arrival = { chain: event.chain, step: event.step };
    },
    isDone: () => true,
    isValid: (event, context) => context.rooms.has(event.roomId) && isStep(event, context),
  },
  goTo: {
    canWalk: true,
    canHandle: true,
    // already standing there: done at once, and the reason of the step is told on the next screen
    enter(day, event) {
      if (day.roomId === event.roomId) day.arrival = { chain: event.chain, step: event.step };
    },
    isDone: (day, event) => day.roomId === event.roomId,
    isValid: (event, context) => context.rooms.has(event.roomId) && isStep(event, context),
  },
  find: {
    canWalk: true,
    enter(day, event) {
      day.leftAt[event.thingId] = event.leftAt;
      const where = day.world.whereIs(event.thingId);
      day.findStart = where && { shortest: day.roomDistanceTo(where) + LOOK_STEPS, wasHome: sameLocation(where, day.plan[event.thingId]) };
    },
    isDone: (day, event) => day.inHand.includes(event.thingId),
    isValid: (event, context) => context.things.has(event.thingId) && context.hasLocation(event.leftAt) && isStepOrNone(event, context),
  },
  putAway: {
    canWalk: true,
    canHandle: true,
    enter() {},
    // a thing the player already put away on their own is not asked for again
    isDone: (day, event) => !day.inHand.includes(event.thingId),
    isValid: (event, context) => context.things.has(event.thingId) && isStepOrNone(event, context),
  },
  check: {
    canWalk: true,
    canHandle: true,
    enter() {},
    isDone: (day) => day.acknowledged,
    isValid: (event, context) => isRoomOrNone(event, context) && isStep(event, context),
  },
  letGo: {
    // Lays down, without a word, what is listed and still in hand where the story leaves it.
    enter(day, event) {
      for (const thingId of event.thingIds.filter((id) => day.inHand.includes(id))) {
        day.world.put(thingId, day.leftAt[thingId] ?? day.plan[thingId]);
        day.inHand = day.inHand.filter((id) => id !== thingId);
        day.habits = recordPlacement(day.habits, thingId, false);
        day.leftBehind.push(thingId);
      }
    },
    isDone: () => true,
    isValid: (event, context) => typeof event.chain === 'string' && Array.isArray(event.thingIds) && event.thingIds.every((id) => context.things.has(id)),
  },
};

/**
 * Whether a day from the save can be continued: every part is of the right kind and names things, rooms and
 * steps that exist now. A day that fails is dropped by the caller; the constructor trusts its state.
 * @param {unknown} state
 * @param {{ layout: object, things: object[], chains?: object[] }} options `things` are the chosen catalogue entries
 */
export function canContinue(state, { layout, things, chains = CHAINS }) {
  if (!isObject(state)) return false;
  const world = new World(layout);
  const context = {
    rooms: new Set(layout.places.map((place) => place.id)),
    things: new Map(things.map((thing) => [thing.id, thing])),
    chains,
    hasLocation: (location) => world.hasLocation(location),
  };
  const { number, events, index, roomId, startedIn, inHand, steps, opened, arrival, findStart, leftAt } = state;
  const validEvents = Array.isArray(events) && events.length > 0
    && events.every((event) => isObject(event) && Object.hasOwn(EVENT_KINDS, event.kind) && EVENT_KINDS[event.kind].isValid(event, context));
  const validLeftAt = isObject(leftAt) && Object.entries(leftAt).every(([id, location]) => context.things.has(id) && context.hasLocation(location));
  const current = validEvents && isWholeNumber(index) ? events[index] : undefined;
  return validEvents && isWholeNumber(number) && isWholeNumber(index) && index < events.length
    && context.rooms.has(roomId) && context.rooms.has(startedIn)
    && Array.isArray(inHand) && inHand.every((id) => context.things.has(id))
    && isWholeNumber(steps)
    && Array.isArray(opened) && opened.every((key) => typeof key === 'string')
    && validLeftAt && (current.kind !== 'find' || Object.hasOwn(leftAt, current.thingId))
    && (current.kind === 'find' ? isFindStart(findStart) : (findStart ?? null) === null)
    && (arrival === null || (isObject(arrival) && isStep(arrival, context)));
}

