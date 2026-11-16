// Shared building blocks of the day tests: event factories, a day built from plain state, and a bot that plays
// a whole day. Not a test file itself (the runner only takes *.test.mjs).

import { Day, EVENT_KINDS } from '../app/js/day.js';
import { LAYOUT } from '../app/js/layout.js';
import { RefusedMove, REFUSALS } from '../app/js/errors.js';
import { THINGS, defaultPlan } from '../app/js/things.js';
import { World, isPocket } from '../app/js/world.js';

/** Always the first choice, the order as given, and no luck: every scenario is deterministic. */
export const rand = (overrides = {}) => ({ pick: (list) => list[0], shuffle: (list) => [...list], chance: () => false, ...overrides });

export const pause = (text = 'day') => ({ kind: 'pause', text });
export const moveTo = (roomId, text = 'arrive', extra = {}) => ({ kind: 'moveTo', roomId, text, ...extra });
export const find = (thingId, useId = null) => ({ kind: 'find', thingId, useId });
export const putAway = (thingId, hurry = null) => ({ kind: 'putAway', thingId, hurry });

/** The saved state of a day that stands at `index`, in the hallway, with empty hands. */
export const dayState = (events, overrides = {}) => ({
  number: 2, events, index: 0, roomId: 'hall', inHand: [], steps: 0, startedIn: 'hall', opened: [], arrival: null, ...overrides,
});

export const spot = (placeId, spotId) => ({ placeId, spotId });
export const pocket = (garmentId, pocketId) => ({ garmentId, pocketId });

/** A world with things placed: `{ keys: spot('living', 'sofa') }`, and coats hung: `hang: { coat: spot(...) }`. */
export function worldWith(things = {}, hang = {}) {
  const world = new World(LAYOUT);
  for (const [id, at] of Object.entries(things)) world.put(id, at);
  for (const [garmentId, at] of Object.entries(hang)) world.hang(garmentId, at);
  return world;
}

/** A day made from plain state; `state` overrides the fields of `dayState`. */
export function makeDay(events, { state = {}, world = new World(LAYOUT), plan = defaultPlan(), streaks = {}, DayClass = Day } = {}) {
  return new DayClass({ layout: LAYOUT, things: THINGS, world, plan, progress: { streaks }, state: dayState(events, state) });
}

/** A day that is putting one thing away, starting in `roomId`, the thing already in hand. */
export const putAwayDay = (thingId, { roomId = 'hall', hurry = null, ...options } = {}) =>
  makeDay([putAway(thingId, hurry)], { ...options, state: { roomId, startedIn: roomId, inHand: [thingId], ...options.state } });

/**
 * A day that is looking for one thing; the world decides where it lies. The find is entered, as the day does it
 * when an event begins, so the day has noted what the find should cost.
 */
export function findDay(thingId, { roomId = 'hall', ...options } = {}) {
  const day = makeDay([find(thingId)], { ...options, state: { roomId, startedIn: roomId, ...options.state } });
  EVENT_KINDS.find.enter(day, day.event());
  return day;
}

/** The refusal code of an action, or undefined when nothing was refused. */
export function refusalOf(action) {
  try {
    action();
  } catch (error) {
    if (!(error instanceof RefusedMove)) throw error;
    if (typeof REFUSALS[error.code] !== 'string') throw new Error(`refusal code without a message: ${error.code}`);
    return error.code;
  }
  return undefined;
}

/** Plays a whole day: every put-away goes on the sofa, every find walks straight to the thing. */
export function playOut(day) {
  for (let guard = 0; !day.state().finished; guard += 1) {
    if (guard > 500) throw new Error('the bot is stuck');
    const { event, roomId } = day.state();
    if (event.kind === 'pause') day.continue();
    else if (event.kind === 'putAway') {
      if (roomId !== 'living') day.walkTo('living');
      day.putDown('sofa');
    } else {
      const at = day.world.whereIs(event.thingId);
      const room = isPocket(at) ? day.world.garmentRoom(at.garmentId) : at.placeId;
      if (room && room !== roomId) day.walkTo(room);
      if (isPocket(at)) day.lookInPocket(at.garmentId, at.pocketId);
      else day.look(at.spotId);
    }
  }
  return day;
}
