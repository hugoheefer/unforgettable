// One day of the game: a list of events (see scenario.js) run on a World. Pure: no DOM, no clock, no randomness
// of its own (the scenario gets `random` injected).
//
// The day can give its plain state back (`snapshot()`) and be built from it again, so a reload continues
// exactly where the player was. Invariant: the event at `index` has always been entered, and a move never
// stays current, because it is done the moment it is entered.
//
// A thing is in one of three places: on a spot or in a pocket of the world, nowhere, or in hand. Reach works as
// in the old round: a spot within its own room; a pocket when its garment is worn or hangs in this room.

import { isPocket, locationKey, sameLocation } from './world.js';
import { hintLevel, recordPlacement, streakOf } from './habit.js';
import { RefusedMove, unknownRoom } from './errors.js';
import { buildDay } from './scenario.js';

/** In a hurry only a room this many steps away can be walked to or reached. */
const HURRY_REACH = 1;

/**
 * What each kind of event does when it begins and when it is over. `day.js` never switches on the kind.
 * A move is done at once: it sets the room and leaves its text for the next screen.
 */
export const EVENT_KINDS = {
  pause: {
    enter() {},
    isDone: (day) => day.acknowledged,
  },
  moveTo: {
    enter(day, event) {
      const { kind, roomId, ...text } = event;
      day.roomId = roomId;
      day.arrival = text;
    },
    isDone: () => true,
  },
  find: {
    enter() {},
    isDone: (day, event) => day.inHand.includes(event.thingId),
  },
  putAway: {
    enter(day, event) {
      // a thing that lay nowhere arrives with you
      if (!day.inHand.includes(event.thingId)) day.inHand.push(event.thingId);
    },
    isDone: (day, event) => !day.inHand.includes(event.thingId),
  },
};

export class Day {
  /**
   * @param {{ layout: object, things: object[], world: import('./world.js').World, plan: object,
   *           progress: { streaks: object }, state: object }} options `state` is a snapshot of a day
   */
  constructor({ layout, things, world, plan, progress, state }) {
    this.layout = layout;
    this.things = things;
    this.world = world;
    this.plan = plan;
    this.habits = progress;
    const copy = structuredClone(state);
    Object.assign(this, copy);
    this.acknowledged = false;
  }

  /** Starts a new day. Every chosen thing that lies nowhere arrives with the player (the scenario sees to that). */
  static start({ layout, things, world, plan, progress, random, number }) {
    const nowhere = things.filter((thing) => world.whereIs(thing.id) === null).map((thing) => thing.id);
    const events = buildDay({ dayNumber: number, things, nowhere, random });
    const state = { number, events, index: 0, roomId: layout.startRoomId, inHand: [], steps: 0, startedIn: layout.startRoomId, opened: [], arrival: null };
    const day = new Day({ layout, things, world, plan, progress, state });
    EVENT_KINDS[events[0].kind].enter(day, events[0]);
    day.settle();
    return day;
  }

  /** Plain data of the day as it goes into the save. A copy, so later actions do not change it. */
  snapshot() {
    const { number, events, index, roomId, inHand, steps, startedIn, opened, arrival } = this;
    return structuredClone({ number, events, index, roomId, inHand, steps, startedIn, opened, arrival });
  }

  /** Everything a view needs to know about the running event. */
  state() {
    const event = this.event();
    return {
      number: this.number,
      finished: event === null,
      event: event && { ...event },
      roomId: this.roomId,
      inHand: [...this.inHand],
      steps: this.steps,
      hurry: event?.hurry ?? null,
      arrival: this.arrival && { ...this.arrival },
    };
  }

  progress() {
    return this.habits;
  }

  hintFor(thingId) {
    return hintLevel(streakOf(this.habits, thingId));
  }

  roomOf(id) {
    return this.layout.places.find((place) => place.id === id);
  }

  garmentOf(id) {
    return this.layout.garments.find((garment) => garment.id === id);
  }

  event() {
    return this.events[this.index] ?? null;
  }

  // ---- running the events ----

  settle() {
    for (let event = this.event(); event && EVENT_KINDS[event.kind].isDone(this, event); event = this.event()) this.advance();
  }

  advance() {
    this.acknowledged = false;
    this.index += 1;
    this.steps = 0;
    this.opened = [];
    this.startedIn = this.roomId;
    const event = this.event();
    if (event) EVENT_KINDS[event.kind].enter(this, event);
  }

  /** Every action clears the pending text of the last move, whether or not it is accepted. */
  begin(kind, whenOther = {}) {
    this.arrival = null;
    const event = this.event();
    if (event?.kind !== kind) throw new RefusedMove(whenOther[event?.kind] ?? 'not-now');
    return event;
  }

  /** Next on a pause. */
  continue() {
    this.begin('pause');
    this.acknowledged = true;
    this.settle();
  }

  // ---- walking and clothes ----

  walkTo(roomId) {
    this.arrival = null;
    const event = this.event();
    if (event?.kind !== 'find' && event?.kind !== 'putAway') throw new RefusedMove('not-now');
    if (!this.roomOf(roomId)) throw unknownRoom(roomId);
    if (roomId === this.roomId) throw new RefusedMove('already-here');
    const distance = this.world.stepsBetween(this.roomId, roomId);
    if (event.hurry && distance > HURRY_REACH) throw new RefusedMove('too-far-in-a-hurry');
    this.roomId = roomId;
    this.steps += distance;
  }

  /** Takes a worn garment off and hangs it on a spot of this room. */
  takeOff(garmentId, spotId) {
    this.begin('putAway');
    if (this.garmentOf(garmentId).removable === false) throw new RefusedMove('not-removable');
    if (!this.world.isWorn(garmentId)) throw new RefusedMove('not-worn');
    this.assertSpotInRoom(spotId);
    this.world.hang(garmentId, { placeId: this.roomId, spotId });
    this.steps += 1;
  }

  /** Puts on a garment that hangs in this room. */
  putOn(garmentId) {
    this.begin('putAway');
    if (this.world.garmentRoom(garmentId) !== this.roomId) throw new RefusedMove('garment-not-here');
    this.world.wear(garmentId);
    this.steps += 1;
  }

  // ---- reach ----

  assertSpotInRoom(spotId) {
    if (!this.roomOf(this.roomId).spots.some((spot) => spot.id === spotId)) throw new RefusedMove('spot-not-here');
  }

  canReach(location) {
    if (!isPocket(location)) return location.placeId === this.roomId;
    return this.world.isWorn(location.garmentId) || this.world.garmentRoom(location.garmentId) === this.roomId;
  }

  assertReach(location) {
    if (!this.canReach(location)) throw new RefusedMove('out-of-reach');
  }

  /** What the player sees at a location: nothing out of reach, and while searching only what was looked at. */
  seenAt(location) {
    if (!this.canReach(location)) return [];
    if (this.event()?.kind === 'find' && !this.opened.includes(locationKey(location))) return [];
    return this.world.itemsOn(location);
  }

  // ---- putting away ----

  putDown(spotId) {
    this.begin('putAway', { find: 'nothing-in-hand' });
    this.assertSpotInRoom(spotId);
    return this.place({ placeId: this.roomId, spotId });
  }

  putInPocket(garmentId, pocketId) {
    this.begin('putAway', { find: 'nothing-in-hand' });
    const location = { garmentId, pocketId };
    this.assertReach(location);
    return this.place(location);
  }

  place(location) {
    const { thingId, hurry } = this.event();
    const atHome = sameLocation(location, this.plan[thingId]);
    // a hurry excuses a stray placement only when the home spot was out of reach from where the event began
    const excused = !atHome && hurry && !this.homeWithinHurryReach(this.plan[thingId]);
    if (!excused) this.habits = recordPlacement(this.habits, thingId, atHome);
    this.world.put(thingId, location);
    this.inHand = this.inHand.filter((id) => id !== thingId);
    const { steps } = this;
    this.settle();
    return { thingId, location, atHome, steps };
  }

  homeWithinHurryReach(home) {
    if (isPocket(home) && this.world.isWorn(home.garmentId)) return true;
    const roomId = isPocket(home) ? this.world.garmentRoom(home.garmentId) : home.placeId;
    return this.world.stepsBetween(this.startedIn, roomId) <= HURRY_REACH;
  }

  // ---- finding ----

  look(spotId) {
    this.begin('find', { putAway: 'nothing-to-find' });
    this.assertSpotInRoom(spotId);
    return this.lookAt({ placeId: this.roomId, spotId });
  }

  lookInPocket(garmentId, pocketId) {
    this.begin('find', { putAway: 'nothing-to-find' });
    const location = { garmentId, pocketId };
    this.assertReach(location);
    return this.lookAt(location);
  }

  lookAt(location) {
    this.steps += 1;
    this.opened.push(locationKey(location));
    const { thingId } = this.event();
    const where = this.world.whereIs(thingId);
    const found = where !== null && sameLocation(where, location);
    if (found) {
      this.world.take(thingId);
      this.inHand.push(thingId);
    }
    const result = { found, steps: this.steps, location: { ...location }, seen: this.world.itemsOn(location) };
    this.settle();
    return result;
  }
}
