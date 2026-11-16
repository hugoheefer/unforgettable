// Choosing the home spot of every item, one question per screen: first the area (a room or a piece of
// clothing), then the place in it. Pure; the plan that was passed in is never changed.

import { isPocket, sameLocation } from './world.js';
import { choiceNotOffered } from './errors.js';
import { named } from './names.js';

const CURRENT = '★';

export class SetupFlow {
  /** @param {{ layout: object, items: object[], plan: object, texts: object, onFinished?: () => void }} options `onFinished` is called once, after the last item got its home spot */
  constructor({ layout, items, plan, texts, onFinished = () => {} }) {
    this.texts = texts;
    this.onFinished = onFinished;
    this.layout = layout;
    this.items = items;
    this.chosen = { ...plan };
    this.index = 0;
    this.area = null; // the room or garment whose places are being listed
    this.selected = null;
  }

  isFinished() {
    return this.index >= this.items.length;
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

  step() {
    const { texts } = this;
    const item = this.items[this.index];
    const current = this.chosen[item.id];
    if (!this.area) {
      const choices = this.areas().map((area) => {
        const choice = { id: `area:${area.id}`, label: texts.tileLabel(area) };
        return this.isCurrentArea(area, current) ? { ...choice, mark: CURRENT } : choice;
      });
      return { lead: [], command: texts.whereToKeep({ thing: named(texts.things, item) }), choices, selected: this.selected };
    }
    const choices = this.area.places.map(({ spot, location }) => {
      const choice = { id: `place:${spot.id}`, label: texts.tileLabel(spot) };
      return sameLocation(location, current) ? { ...choice, mark: CURRENT } : choice;
    });
    const question = this.area.isRoom ? texts.whichPlace({ room: this.area }) : texts.whichPocket({ garment: this.area });
    return { lead: [], command: question, choices: [...choices, { id: 'back', label: texts.back }], selected: this.selected };
  }

  choose(choiceId) {
    if (!this.step().choices.some((choice) => choice.id === choiceId)) throw choiceNotOffered(choiceId);
    this.selected = choiceId;
  }

  next() {
    const choice = this.selected;
    if (!choice) return;
    this.selected = null;
    if (choice === 'back') {
      this.area = null;
    } else if (choice.startsWith('area:')) {
      this.area = this.areas().find((area) => `area:${area.id}` === choice);
    } else {
      const picked = this.area.places.find(({ spot }) => `place:${spot.id}` === choice);
      this.chosen[this.items[this.index].id] = picked.location;
      this.area = null;
      this.index += 1;
      if (this.isFinished()) this.onFinished();
    }
  }
}
