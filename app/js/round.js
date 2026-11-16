// One round of the game: drop the items under pressure, get distracted, then find them again. Pure:
// randomness comes in through `random`, so a round is deterministic in tests.

import { World } from './world.js';
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

const sameSpot = (a, b) => a.placeId === b.placeId && a.spotId === b.spotId;

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

  state() {
    const finding = this.phase === 'find';
    const findItem = finding ? this.toFind[0] : null;
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

  walkTo(roomId) {
    if (!this.world.exitsOf(this.roomId).includes(roomId)) throw new Error(`There is no door to ${roomId}`);
    this.roomId = roomId;
    this.notice = '';
    if (this.phase === 'find') {
      this.findCost += 1;
    } else {
      this.movesLeft -= 1;
      if (this.movesLeft === 0) this.interrupt();
    }
  }

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

  place(location, forced) {
    const itemId = this.toPlace.shift();
    this.world.put(itemId, location);
    const atHome = !forced && sameSpot(location, this.plan[itemId]);
    if (atHome) this.score += POINTS_FOR_HOME_SPOT;
    this.habits = recordPlacement(this.habits, itemId, atHome);
    Object.assign(this.outcomes.get(itemId), { atHome, forced, location });
    if (this.toPlace.length > 0) this.startPressure();
    else this.startFinding();
  }

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
    if (!this.roomOf(this.roomId).spots.some((spot) => spot.id === spotId)) throw new Error('That spot is not in this room');
    this.findCost += 1;
    this.notice = '';
    this.opened.add(spotId);
    const target = this.toFind[0];
    const found = this.world.whereIs(target) !== null && sameSpot(this.world.whereIs(target), { placeId: this.roomId, spotId });
    if (found) this.finishFinding(target);
    return { found, items: this.world.itemsOn({ placeId: this.roomId, spotId }) };
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

  /** Items the player can see on a spot: everything while dropping, only opened spots while searching. */
  seenOn(spotId) {
    if (this.phase === 'find' && !this.opened.has(spotId)) return [];
    return this.world.itemsOn({ placeId: this.roomId, spotId });
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
