// One day of the game: a list of events (see day-plan.js) run on a World. Pure: no DOM, no clock, no randomness
// of its own (the day plan gets `random` injected).
//
// The day can give its plain state back (`snapshot()`) and be built from it again, so a reload continues
// exactly where the player was. Invariant: the event at `index` has always been entered, and a move never
// stays current, because it is done the moment it is entered.
//
// A thing is in one of three places: on a spot or in a pocket of the world, nowhere, or in hand. A spot is within
// reach in its own room; a pocket when its garment is worn or hangs in this room.

import { isPocket, locationKey, sameLocation } from './world.js';
import { recordPlacement, streakOf } from './habit.js';
import { RefusedMove, optionNotOffered, unknownRoom, unknownThing } from './errors.js';
import { buildDay } from './day-plan.js';
import { CHAINS } from './chains.js';
import { EVENT_KINDS, canContinue } from './event-kinds.js';

// the table of event kinds and the check of a saved day live in event-kinds.js; day.js stays their public home
export { EVENT_KINDS, canContinue };

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
    this.leftBehind = [];
  }

  /**
   * Starts a new day. A chosen thing that lies nowhere (a new game, a thing added later) is put on its home
   * spot first, silently.
   * @param {{ yesterday?: string[], chains?: object[] }} options the ids of yesterday's chains; the chains to pick from
   */
  static start({ layout, things, world, plan, progress, random, number, yesterday = [], chains = CHAINS }) {
    for (const thing of things) if (world.whereIs(thing.id) === null) world.put(thing.id, plan[thing.id]);
    const onPerson = things.filter((thing) => isOnPerson(world, thing.id)).map((thing) => thing.id);
    const events = buildDay({ dayNumber: number, chains, things, onPerson, yesterday, random });
    const state = { number, events, index: 0, roomId: layout.startRoomId, inHand: [], steps: 0, startedIn: layout.startRoomId, opened: [], arrival: null, leftAt: {} };
    const day = new Day({ layout, things, world, plan, progress, state });
    EVENT_KINDS[events[0].kind].enter(day, events[0]);
    day.settle();
    return day;
  }

  /** Plain data of the day as it goes into the save. A copy, so later actions do not change it. */
  snapshot() {
    const { number, events, index, roomId, inHand, steps, startedIn, opened, arrival, findStart, leftAt } = this;
    return structuredClone({ number, events, index, roomId, inHand, steps, startedIn, opened, arrival, findStart: findStart ?? null, leftAt });
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
      arrival: this.arrival && { ...this.arrival },
      returnTo: this.returnTo(),
    };
  }

  /** The room the story waits in, when the player walked off from it; otherwise null. */
  returnTo() {
    const event = this.event();
    const room = event && EVENT_KINDS[event.kind].room?.(event);
    return room && room !== this.roomId ? room : null;
  }

  progress() {
    return this.habits;
  }

  /** Whether the running event lets the player put things away and handle the coat meanwhile. */
  canHandle() {
    const event = this.event();
    return event !== null && EVENT_KINDS[event.kind].canHandle === true;
  }

  /** The ids of the things that `letGo` laid down since the last call, so the caller can record them. */
  takeLeftBehind() {
    const left = this.leftBehind;
    this.leftBehind = [];
    return left;
  }

  /** Home spots chosen between two events apply from the next put-away. */
  usePlan(plan) {
    this.plan = plan;
  }

  /** The other rooms with their distance, nearest first, then in the order of the layout. */
  reachableRooms() {
    return this.layout.places
      .filter((place) => place.id !== this.roomId)
      .map((place) => ({ id: place.id, steps: this.world.stepsBetween(this.roomId, place.id) }))
      .sort((a, b) => a.steps - b.steps);
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
    this.askForMissing();
  }

  advance() {
    this.acknowledged = false;
    this.index += 1;
    this.steps = 0;
    this.opened = [];
    this.startedIn = this.roomId;
    this.findStart = null;
    const event = this.event();
    if (event) EVENT_KINDS[event.kind].enter(this, event);
  }

  /**
   * Every action clears the pending text of the last move, whether or not it is accepted. Gives the running event
   * when its kind allows the ability, otherwise refuses with the code for that kind (or 'not-now').
   * @param {'canWalk' | 'canHandle' | 'waitsForNext' | 'find' | 'check'} ability
   */
  begin(ability, whenOther = {}) {
    this.arrival = null;
    const event = this.event();
    const allowed = event && (ability === event.kind || EVENT_KINDS[event.kind][ability] === true);
    if (!allowed) throw new RefusedMove(whenOther[event?.kind] ?? 'not-now');
    return event;
  }

  /**
   * The story waits in another room: until the player walks back it does not go on. Walking and handling things
   * stay possible, because putting something away on your own can take a walk to another room.
   */
  assertPresent() {
    if (this.returnTo() !== null) throw new RefusedMove('come-back');
  }

  /** Next on a pause or a tell. */
  continue() {
    this.begin('waitsForNext');
    this.assertPresent();
    this.acknowledged = true;
    this.settle();
  }

  /**
   * A step that uses a thing is never shown while the thing is not in hand. As soon as the story stands on such a
   * step in its own room (a put-away or a walk back ends here), the thing is searched for before the step, with the
   * reason the story first gave for needing it (the latest earlier find of it in this chain); the step is shown after.
   */
  askForMissing() {
    const current = this.event();
    const [thingId] = current && this.returnTo() === null ? EVENT_KINDS[current.kind].needs?.(this, current) ?? [] : [];
    if (thingId === undefined) return;
    const earlier = this.events.slice(0, this.index).findLast((event) => event.kind === 'find' && event.chain === current.chain && event.thingId === thingId);
    const leftAt = earlier?.leftAt ?? this.leftAt[thingId] ?? this.plan[thingId];
    this.events.splice(this.index, 0, { kind: 'find', chain: current.chain, step: earlier?.step ?? current.step, thingId, leftAt });
    this.index -= 1;
    this.advance();
  }

  // ---- a choice ----

  /**
   * The player takes an option of the question that is asked. The events of the other options are removed, so the
   * stored day holds only the chosen path and a reload goes on with it.
   */
  chooseOption(optionId) {
    const event = this.begin('choose');
    this.assertPresent();
    if (!event.options.includes(optionId)) throw optionNotOffered(optionId);
    const prefix = `${event.step}/`;
    this.events = this.events.filter((other) => !(other.chain === event.chain && other.option?.startsWith(prefix) && other.option !== `${prefix}${optionId}`));
    this.acknowledged = true;
    this.settle();
  }

  /** Whether an event before the running one found this thing: an evening find of an unused thing is skipped. */
  foundEarlier(thingId) {
    return this.events.slice(0, this.index).some((event) => event.kind === 'find' && event.thingId === thingId);
  }

  // ---- the check ----

  /**
   * "Is everything back in its place?" Yes ends the check. No changes nothing and gives the ids of the chosen
   * things to pick from; the app never says whether the answer was right.
   */
  answerCheck(allBack) {
    this.begin('check');
    this.assertPresent();
    if (!allBack) return this.things.map((thing) => thing.id);
    this.acknowledged = true;
    this.settle();
    return undefined;
  }

  /** The player forgot a thing: it is searched for and put away next, whether or not it lay in its place. */
  forgot(thingId) {
    this.begin('check');
    this.assertPresent();
    if (!this.things.some((thing) => thing.id === thingId)) throw unknownThing(thingId);
    this.events.splice(this.index + 1, 0,
      { kind: 'find', chain: null, step: null, thingId, leftAt: this.plan[thingId] },
      { kind: 'putAway', chain: null, step: null, thingId });
    this.acknowledged = true;
    this.settle();
  }

  // ---- walking and clothes ----

  walkTo(roomId) {
    this.begin('canWalk');
    if (!this.roomOf(roomId)) throw unknownRoom(roomId);
    if (roomId === this.roomId) throw new RefusedMove('already-here');
    this.steps += this.world.stepsBetween(this.roomId, roomId);
    this.roomId = roomId;
    this.settle();
  }

  /** Takes a worn garment off and hangs it on a spot of this room. */
  takeOff(garmentId, spotId) {
    this.begin('canHandle');
    if (this.garmentOf(garmentId).removable === false) throw new RefusedMove('not-removable');
    if (!this.world.isWorn(garmentId)) throw new RefusedMove('not-worn');
    this.assertSpotInRoom(spotId);
    this.world.hang(garmentId, { placeId: this.roomId, spotId });
    this.steps += 1;
  }

  /** Puts on a garment that hangs in this room. */
  putOn(garmentId) {
    this.begin('canHandle');
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

  /** Puts a thing in hand on a spot of this room; without `thingId`, the thing of the put-away being asked for. */
  putDown(spotId, thingId) {
    const id = this.thingToPlace(thingId);
    this.assertSpotInRoom(spotId);
    return this.place({ placeId: this.roomId, spotId }, id);
  }

  putInPocket(garmentId, pocketId, thingId) {
    const id = this.thingToPlace(thingId);
    const location = { garmentId, pocketId };
    this.assertReach(location);
    return this.place(location, id);
  }

  /** The thing a put-away is about: the given one, or the one the event asks for. It must be in hand. */
  thingToPlace(thingId) {
    const event = this.begin('canHandle', { find: 'nothing-in-hand' });
    const id = thingId ?? (event.kind === 'putAway' ? event.thingId : undefined);
    if (!this.inHand.includes(id)) throw new RefusedMove('nothing-in-hand');
    return id;
  }

  place(location, thingId) {
    const atHome = sameLocation(location, this.plan[thingId]);
    this.habits = recordPlacement(this.habits, thingId, atHome);
    this.world.put(thingId, location);
    this.inHand = this.inHand.filter((id) => id !== thingId);
    // the steps walked so far belong to this put-away; the next one starts counting again
    const { steps } = this;
    this.steps = 0;
    this.settle();
    return { thingId, location, atHome, steps };
  }

  /** Steps from the room where the event started to the room a location is reached from; 0 for a worn garment. */
  roomDistanceTo(location) {
    if (isPocket(location) && this.world.isWorn(location.garmentId)) return 0;
    const roomId = isPocket(location) ? this.world.garmentRoom(location.garmentId) : location.placeId;
    return this.world.stepsBetween(this.startedIn, roomId);
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
    if (found && this.findStart) Object.assign(result, this.findStart);
    this.settle();
    return result;
  }
}

/** Whether a thing is on the person: in a pocket of a garment that is worn. */
function isOnPerson(world, thingId) {
  const at = world.whereIs(thingId);
  return at !== null && isPocket(at) && world.isWorn(at.garmentId);
}
