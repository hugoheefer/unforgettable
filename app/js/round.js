// One round of the game: drop the items under pressure, get distracted, then find them again. Pure:
// randomness comes in through `random`, so a round is deterministic in tests.
//
// An item can go on a spot in a room or in a pocket of a garment. A worn garment's pockets are always within
// reach; a garment that hangs in a room can be used only while you stand in that room.

import { World, isPocket, locationKey, sameLocation } from './world.js';
import { hintLevel, recordPlacement, streakOf } from './habit.js';

const DEFAULT_BUDGET = 3;
const POINTS_FOR_HOME_SPOT = 10;
const POINTS_FOR_QUICK_FIND = 10;

const PRESSURES = [
  'Your phone is ringing!',
  'The kettle is boiling over!',
  'Someone is at the door!',
  'You are late, hurry up!',
];
const DISTRACTIONS = [
  'The neighbour wants to chat. Time passes...',
  'You cook dinner and lose track of time...',
  'You answer a long phone call...',
];

export class Round {
  /**
   * @param {{ layout: object, items: object[], plan: object, random: { pick: Function, shuffle: Function },
   *           progress: { streaks: object }, budget?: number }} options
   */
  constructor({ layout, items, plan, random, progress, budget = DEFAULT_BUDGET }) {
    this.layout = layout;
    this.items = items;
    this.plan = plan;
    this.random = random;
    this.budget = budget;
    this.world = new World(layout);
    this.habits = progress;
    this.phase = 'drop';
    this.roomId = layout.startRoomId;
    this.toPlace = items.map((item) => item.id);
    this.toFind = [];
    this.outcomes = new Map(items.map((item) => [item.id, { itemId: item.id }]));
    this.notice = '';
    this.distraction = '';
    this.opened = new Set();
    this.score = 0;
    this.startPressure();
  }

  startPressure() {
    this.movesLeft = this.budget;
    this.pressure = this.random.pick(PRESSURES);
  }

  roomOf(id) {
    return this.layout.places.find((place) => place.id === id);
  }

  garmentOf(id) {
    return this.layout.garments.find((garment) => garment.id === id);
  }

  state() {
    const findItem = this.phase === 'find' ? this.toFind[0] : null;
    return {
      phase: this.phase,
      roomId: this.roomId,
      holding: this.phase === 'drop' ? this.toPlace[0] : null,
      movesLeft: this.movesLeft,
      pressure: this.pressure,
      notice: this.notice,
      distraction: this.distraction,
      findItem,
      findPrompt: findItem ? this.items.find((item) => item.id === findItem).findPrompt : '',
      score: this.score,
    };
  }

  // ---- moving and handling clothes: every one of these costs a move ----

  /** While dropping a move is one of a few you have; while searching it adds to the cost of the find. */
  spendMove() {
    this.notice = '';
    if (this.phase === 'find') {
      this.findCost += 1;
    } else {
      this.movesLeft -= 1;
      if (this.movesLeft === 0) this.interrupt();
    }
  }

  walkTo(roomId) {
    if (!this.world.exitsOf(this.roomId).includes(roomId)) throw new Error(`There is no door to ${roomId}`);
    this.roomId = roomId;
    this.spendMove();
  }

  /** Takes a worn garment off and hangs it on a spot of this room. */
  takeOff(garmentId, spotId) {
    if (this.garmentOf(garmentId).removable === false) throw new Error('That garment cannot be taken off');
    if (!this.world.isWorn(garmentId)) throw new Error('You are not wearing that garment');
    this.assertSpotInRoom(spotId);
    this.world.hang(garmentId, { placeId: this.roomId, spotId });
    this.spendMove();
  }

  /** Puts on a garment that hangs in this room. */
  putOn(garmentId) {
    if (this.world.garmentRoom(garmentId) !== this.roomId) throw new Error('That garment is not in this room');
    this.world.wear(garmentId);
    this.spendMove();
  }

  assertSpotInRoom(spotId) {
    if (!this.roomOf(this.roomId).spots.some((spot) => spot.id === spotId)) throw new Error('That spot is not in this room');
  }

  /** A spot is within reach in its own room; a pocket when its garment is worn or hangs in this room. */
  canReach(location) {
    if (!isPocket(location)) return location.placeId === this.roomId;
    return this.world.isWorn(location.garmentId) || this.world.garmentRoom(location.garmentId) === this.roomId;
  }

  assertReach(location) {
    if (!this.canReach(location)) throw new Error('That pocket is out of reach');
  }

  // ---- dropping ----

  /** Out of time: the item goes down on the first spot of the room you stand in, not where you planned. */
  interrupt() {
    const spot = this.roomOf(this.roomId).spots[0];
    const itemName = this.items.find((item) => item.id === this.toPlace[0]).name;
    this.place({ placeId: this.roomId, spotId: spot.id }, true);
    this.notice = `You were interrupted and left the ${itemName} on the ${spot.name}.`;
  }

  putDown(spotId) {
    this.place({ placeId: this.roomId, spotId }, false);
  }

  putInPocket(garmentId, pocketId) {
    const location = { garmentId, pocketId };
    this.assertReach(location);
    this.place(location, false);
  }

  place(location, forced) {
    const itemId = this.toPlace.shift();
    this.world.put(itemId, location);
    const atHome = !forced && sameLocation(location, this.plan[itemId]);
    if (atHome) this.score += POINTS_FOR_HOME_SPOT;
    this.habits = recordPlacement(this.habits, itemId, atHome);
    Object.assign(this.outcomes.get(itemId), { atHome, forced, location });
    if (this.toPlace.length > 0) this.startPressure();
    else this.startFinding();
  }

  // ---- finding ----

  startFinding() {
    this.phase = 'find';
    this.distraction = this.random.pick(DISTRACTIONS);
    const otherRooms = this.layout.places.filter((place) => place.id !== this.roomId && place.kind !== 'container');
    this.roomId = this.random.pick(otherRooms).id;
    this.toFind = this.random.shuffle(this.items.map((item) => item.id));
    this.beginSearch();
  }

  beginSearch() {
    this.findCost = 0;
    this.opened = new Set();
  }

  open(spotId) {
    this.assertSpotInRoom(spotId);
    return this.lookAt({ placeId: this.roomId, spotId });
  }

  openPocket(garmentId, pocketId) {
    const location = { garmentId, pocketId };
    this.assertReach(location);
    return this.lookAt(location);
  }

  lookAt(location) {
    this.findCost += 1;
    this.notice = '';
    this.opened.add(locationKey(location));
    const target = this.toFind[0];
    const where = this.world.whereIs(target);
    const found = where !== null && sameLocation(where, location);
    if (found) this.finishFinding(target);
    return { found, items: this.world.itemsOn(location) };
  }

  finishFinding(itemId) {
    const findPoints = Math.max(0, POINTS_FOR_QUICK_FIND - this.findCost);
    this.score += findPoints;
    Object.assign(this.outcomes.get(itemId), { findCost: this.findCost, findPoints });
    this.world.take(itemId);
    this.toFind.shift();
    if (this.toFind.length === 0) this.phase = 'done';
    else this.beginSearch();
  }

  /** Items the player can see at a location: nothing out of reach, and while searching only what was opened. */
  seenAt(location) {
    if (!this.canReach(location)) return [];
    if (this.phase === 'find' && !this.opened.has(locationKey(location))) return [];
    return this.world.itemsOn(location);
  }

  seenOn(spotId) {
    return this.seenAt({ placeId: this.roomId, spotId });
  }

  hintFor(itemId) {
    return hintLevel(streakOf(this.habits, itemId));
  }

  results() {
    return [...this.outcomes.values()];
  }

  progress() {
    return this.habits;
  }
}
