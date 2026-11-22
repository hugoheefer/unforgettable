// Choosing home spots. The first screen lists every thing with its home spot, so the player can change any
// thing first, change only some and leave the rest as they are; a thing that was chosen asks first for the area
// (a room or a piece of clothing) and then for the place in it, and the list is back. Pure; the plan that was
// passed in is never changed.

import { isPocket, sameLocation } from './world.js';
import { choiceNotOffered } from './errors.js';
import { named } from './names.js';
import { describeLocation, layoutLookup } from './room-view.js';

const CURRENT = '★';

export class SetupFlow {
  /** @param {{ layout: object, items: object[], plan: object, texts: object, onFinished?: () => void }} options `onFinished` is called once, when the player says they are done */
  constructor({ layout, items, plan, texts, onFinished = () => {} }) {
    this.texts = texts;
    this.onFinished = onFinished;
    this.layout = layout;
    this.items = items;
    this.chosen = { ...plan };
    this.thing = null; // the thing whose home spot is being chosen
    this.area = null; // the room or garment whose places are being listed
    this.lead = [];
    this.finished = false;
    this.selected = null;
    this.lookup = layoutLookup(layout); // there is no day yet
  }

  isFinished() {
    return this.finished;
  }

  plan() {
    return { ...this.chosen };
  }

  areas() {
    const { texts } = this;
    return [
      ...this.layout.places.map((place) => ({
        ...named(texts.rooms, place),
        places: place.spots.map((spot) => ({ spot: named(texts.spots, spot), location: { placeId: place.id, spotId: spot.id } })),
        isRoom: true,
      })),
      ...this.layout.garments.map((garment) => ({
        ...named(texts.garments, garment),
        places: garment.pockets.map((pocket) => ({ spot: named(texts.pockets, pocket), location: { garmentId: garment.id, pocketId: pocket.id } })),
        isRoom: false,
      })),
    ];
  }

  isCurrentArea(area, location) {
    return isPocket(location) ? location.garmentId === area.id : location.placeId === area.id;
  }

  /** A thing in words, and where its home spot is now. */
  describe(item) {
    const where = describeLocation(this.lookup, this.chosen[item.id], this.texts);
    return { thing: named(this.texts.things, item), where };
  }

  step() {
    const { texts } = this;
    const back = { id: 'back', label: texts.back };
    if (!this.thing) {
      const choices = this.items.map((item) => ({ id: `thing:${item.id}`, label: texts.thingHome(this.describe(item)) }));
      return { lead: this.lead, command: texts.whichThing, choices: [...choices, { id: 'done', label: texts.setupDone }], selected: this.selected };
    }
    const current = this.chosen[this.thing.id];
    if (!this.area) {
      const choices = this.areas().map((area) => {
        const entry = { id: `area:${area.id}`, label: texts.tileLabel(area) };
        return this.isCurrentArea(area, current) ? { ...entry, mark: CURRENT } : entry;
      });
      return { lead: [], command: texts.whereToKeep({ thing: this.describe(this.thing).thing }), choices: [...choices, back], selected: this.selected };
    }
    const choices = this.area.places.map(({ spot, location }) => {
      const entry = { id: `place:${spot.id}`, label: texts.tileLabel(spot) };
      return sameLocation(location, current) ? { ...entry, mark: CURRENT } : entry;
    });
    const question = this.area.isRoom ? texts.whichPlace({ room: this.area }) : texts.whichPocket({ garment: this.area });
    return { lead: [], command: question, choices: [...choices, back], selected: this.selected };
  }

  choose(choiceId) {
    if (!this.step().choices.some((entry) => entry.id === choiceId)) throw choiceNotOffered(choiceId);
    this.selected = choiceId;
  }

  next() {
    const choice = this.selected;
    if (!choice) return;
    this.selected = null;
    this.lead = [];
    if (choice === 'back') {
      if (this.area) this.area = null;
      else this.thing = null;
    } else if (choice === 'done') {
      this.finished = true;
      this.onFinished();
    } else if (choice.startsWith('thing:')) {
      this.thing = this.items.find((item) => `thing:${item.id}` === choice);
    } else if (choice.startsWith('area:')) {
      this.area = this.areas().find((area) => `area:${area.id}` === choice);
    } else {
      const picked = this.area.places.find(({ spot }) => `place:${spot.id}` === choice);
      this.chosen[this.thing.id] = picked.location;
      const { thing, where } = this.describe(this.thing);
      this.lead = [this.texts.homeSet({ thing, where })];
      this.thing = null;
      this.area = null;
    }
  }
}
