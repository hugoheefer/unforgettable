// The places of the game and where every item lies. Pure: no DOM, no randomness, no clock.

/**
 * @typedef {{ placeId: string, spotId: string }} Location
 * @typedef {{ id: string, name: string, icon: string }} Spot
 * @typedef {{ id: string, name: string, icon: string, spots: Spot[], exits: string[] }} Place
 */

const key = ({ placeId, spotId }) => `${placeId}/${spotId}`;

export class World {
  /** @param {{ places: Place[] }} layout */
  constructor(layout) {
    this.places = new Map(layout.places.map((place) => [place.id, place]));
    this.locations = new Map(); // itemId -> Location
  }

  hasSpot({ placeId, spotId }) {
    return Boolean(this.places.get(placeId)?.spots.some((spot) => spot.id === spotId));
  }

  /** Puts an item on a spot; an item that lay elsewhere is moved. */
  put(itemId, location) {
    if (!this.hasSpot(location)) throw new Error(`Unknown spot: ${key(location)}`);
    this.locations.set(itemId, { placeId: location.placeId, spotId: location.spotId });
  }

  take(itemId) {
    this.locations.delete(itemId);
  }

  /** @returns {Location | null} */
  whereIs(itemId) {
    return this.locations.get(itemId) ?? null;
  }

  itemsOn(location) {
    return [...this.locations].filter(([, at]) => key(at) === key(location)).map(([itemId]) => itemId);
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
