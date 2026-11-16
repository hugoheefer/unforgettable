// The places of the game and where every item and garment lies. Pure: no DOM, no randomness, no clock.
//
// An item lies on a spot in a room, or in a pocket of a garment. A garment is worn, or lies on a spot, and the
// things in its pockets move with it.

/**
 * @typedef {{ placeId: string, spotId: string }} SpotLocation
 * @typedef {{ garmentId: string, pocketId: string }} PocketLocation
 * @typedef {SpotLocation | PocketLocation} Location
 * @typedef {{ id: string, name: string, icon: string }} Spot
 * @typedef {{ id: string, name: string, icon: string, spots: Spot[], exits: string[] }} Place
 * @typedef {{ id: string, name: string, icon: string, pockets: Spot[], startsWorn?: boolean,
 *             startsAt?: SpotLocation, removable?: boolean }} Garment
 */

const WORN = 'worn';

export const isPocket = (location) => 'garmentId' in location;

/** One string per location, so two locations can be compared and used as map keys. */
export const locationKey = (location) =>
  isPocket(location) ? `pocket:${location.garmentId}/${location.pocketId}` : `${location.placeId}/${location.spotId}`;

/** The opposite of locationKey: used for choices in a form, whose values are strings. */
export function parseLocationKey(key) {
  if (key.startsWith('pocket:')) {
    const [garmentId, pocketId] = key.slice('pocket:'.length).split('/');
    return { garmentId, pocketId };
  }
  const [placeId, spotId] = key.split('/');
  return { placeId, spotId };
}

export const sameLocation = (a, b) => locationKey(a) === locationKey(b);

export class World {
  /** @param {{ places: Place[], garments?: Garment[] }} layout */
  constructor(layout) {
    this.places = new Map(layout.places.map((place) => [place.id, place]));
    this.garments = new Map((layout.garments ?? []).map((garment) => [garment.id, garment]));
    this.locations = new Map(); // itemId -> Location
    this.garmentPlaces = new Map(
      [...this.garments.values()].map((garment) => [garment.id, garment.startsWorn ? WORN : garment.startsAt]),
    );
  }

  /** True for a spot in a room or a pocket of a garment that exists. */
  hasLocation(location) {
    if (typeof location !== 'object' || location === null) return false;
    if (isPocket(location)) return Boolean(this.garments.get(location.garmentId)?.pockets.some((pocket) => pocket.id === location.pocketId));
    return Boolean(this.places.get(location.placeId)?.spots.some((spot) => spot.id === location.spotId));
  }

  assertLocation(location) {
    if (!this.hasLocation(location)) throw new Error(`Unknown spot or pocket: ${locationKey(location)}`);
  }

  /** Puts an item on a spot or in a pocket; an item that lay elsewhere is moved. */
  put(itemId, location) {
    this.assertLocation(location);
    this.locations.set(itemId, { ...location });
  }

  take(itemId) {
    this.locations.delete(itemId);
  }

  /** @returns {Location | null} */
  whereIs(itemId) {
    return this.locations.get(itemId) ?? null;
  }

  itemsOn(location) {
    return [...this.locations].filter(([, at]) => sameLocation(at, location)).map(([itemId]) => itemId);
  }

  isWorn(garmentId) {
    return this.garmentPlaces.get(garmentId) === WORN;
  }

  wornGarments() {
    return [...this.garmentPlaces].filter(([, place]) => place === WORN).map(([garmentId]) => garmentId);
  }

  /** Takes a worn garment off and lays it on a spot. */
  hang(garmentId, spot) {
    this.assertLocation(spot);
    this.garmentPlaces.set(garmentId, { ...spot });
  }

  wear(garmentId) {
    this.garmentPlaces.set(garmentId, WORN);
  }

  /** The room a garment lies in, or null while it is worn. */
  garmentRoom(garmentId) {
    const place = this.garmentPlaces.get(garmentId);
    return place === WORN ? null : place.placeId;
  }

  /** The garments that lie on a spot. */
  garmentsOn(spot) {
    return [...this.garmentPlaces]
      .filter(([, place]) => place !== WORN && place && sameLocation(place, spot))
      .map(([garmentId]) => garmentId);
  }

  exitsOf(placeId) {
    return [...(this.places.get(placeId)?.exits ?? [])];
  }

  /** Number of doors to walk through; Infinity when the rooms are not connected. */
  stepsBetween(fromId, toId) {
    const seen = new Set([fromId]);
    let frontier = [fromId];
    for (let steps = 0; frontier.length > 0; steps += 1) {
      if (frontier.includes(toId)) return steps;
      frontier = frontier.flatMap((id) => this.exitsOf(id)).filter((id) => !seen.has(id) && seen.add(id));
    }
    return Infinity;
  }
}
