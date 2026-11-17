// What the player sees of the room they stand in and of what they wear. Pure: turns the state of a day into
// plain data that the flows only have to turn into screens.

import { isPocket } from './world.js';
import { named } from './names.js';

/**
 * A location in words: a spot with its room ("on the key hook in the hallway"), or by itself when the room is
 * obvious; a pocket always by itself, because its sentence already names the garment.
 */
export function describeLocation(day, location, texts, { withRoom = true } = {}) {
  if (isPocket(location)) {
    const pocket = day.garmentOf(location.garmentId).pockets.find((candidate) => candidate.id === location.pocketId);
    return texts.locationPocket({ pocket: named(texts.pockets, pocket) });
  }
  const place = day.roomOf(location.placeId);
  const spot = named(texts.spots, place.spots.find((candidate) => candidate.id === location.spotId));
  return withRoom ? texts.locationSpot({ spot, room: named(texts.rooms, place) }) : texts.locationHere({ spot });
}

/**
 * What the player sees of the room and of what they wear. It never points at a home spot: the player chooses
 * from memory.
 * @param {import('./day.js').Day} day
 * @param {object} texts
 */
export function describeRoom(day, texts) {
  const room = day.roomOf(day.state().roomId);
  const iconOf = (thingId) => day.things.find((thing) => thing.id === thingId).icon;

  const tileFor = (entry, table, location) => ({
    ...named(table, entry),
    seen: day.seenAt(location).map(iconOf),
  });

  const garmentView = (garment, extra) => ({
    ...named(texts.garments, garment),
    pockets: garment.pockets.map((pocket) => tileFor(pocket, texts.pockets, { garmentId: garment.id, pocketId: pocket.id })),
    ...extra,
  });

  const garments = day.layout.garments ?? [];
  const worn = garments
    .filter((garment) => day.world.isWorn(garment.id))
    .map((garment) => garmentView(garment, { canTakeOff: day.canHandle() && garment.removable !== false }));
  const hanging = garments
    .filter((garment) => day.world.garmentRoom(garment.id) === room.id)
    .map((garment) => garmentView(garment, { canPutOn: true, onSpot: day.world.garmentSpot(garment.id).spotId }));

  return {
    room: named(texts.rooms, room),
    spots: room.spots.map((spot) => tileFor(spot, texts.spots, { placeId: room.id, spotId: spot.id })),
    worn,
    hanging,
    rooms: day.reachableRooms().map(({ id, steps }) => ({ ...named(texts.rooms, day.roomOf(id)), steps })),
  };
}
