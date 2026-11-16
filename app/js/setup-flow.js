// Choosing the home spot of every item, one question per screen: first the area (a room or a piece of
// clothing), then the place in it. Pure; the plan that was passed in is never changed.

import { isPocket, sameLocation } from './world.js';

const CURRENT = '★';
const BACK = { id: 'back', label: '↩ Choose something else' };

export class SetupFlow {
  /** @param {{ layout: object, items: object[], plan: object, onFinished?: () => void }} options `onFinished` is called once, after the last item got its home spot */
  constructor({ layout, items, plan, onFinished = () => {} }) {
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
    return [
      ...this.layout.places.map((place) => ({ ...place, places: place.spots.map((spot) => ({ spot, location: { placeId: place.id, spotId: spot.id } })), isRoom: true })),
      ...this.layout.garments.map((garment) => ({ ...garment, places: garment.pockets.map((pocket) => ({ spot: pocket, location: { garmentId: garment.id, pocketId: pocket.id } })), isRoom: false })),
    ];
  }

  isCurrentArea(area, location) {
    return isPocket(location) ? location.garmentId === area.id : location.placeId === area.id;
  }

  step() {
    const item = this.items[this.index];
    const current = this.chosen[item.id];
    if (!this.area) {
      const choices = this.areas().map((area) => {
        const choice = { id: `area:${area.id}`, label: `${area.icon} ${area.name}` };
        return this.isCurrentArea(area, current) ? { ...choice, mark: CURRENT } : choice;
      });
      return { lead: [], command: `Where do you want to always keep your ${item.icon} ${item.name}?`, choices, selected: this.selected };
    }
    const choices = this.area.places.map(({ spot, location }) => {
      const choice = { id: `place:${spot.id}`, label: `${spot.icon} ${spot.name}` };
      return sameLocation(location, current) ? { ...choice, mark: CURRENT } : choice;
    });
    const question = this.area.isRoom ? `Which place in the ${this.area.name}?` : `Which pocket of the ${this.area.name.toLowerCase()}?`;
    return { lead: [], command: question, choices: [...choices, BACK], selected: this.selected };
  }

  choose(choiceId) {
    if (!this.step().choices.some((choice) => choice.id === choiceId)) throw new Error(`Choice not offered: ${choiceId}`);
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
