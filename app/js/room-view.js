// What the player sees of the room they stand in and of what they wear. Pure: turns the state of a day into
// plain data that the flows only have to turn into screens.

import { isPocket, sameLocation } from './world.js';
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

/** The room a player has to go to for a home spot: its own room, or where the garment of the pocket hangs. */
const homeRoomOf = (day, home) => (isPocket(home) ? day.world.garmentRoom(home.garmentId) : home.placeId);

export function describeRoom(day, texts) {
  const { event } = day.state();
  const room = day.roomOf(day.state().roomId);
  const putting = event?.kind === 'putAway';
  const home = putting ? { thingId: event.thingId, location: day.plan[event.thingId] } : null;
  const level = home ? day.hintFor(home.thingId) : 'hidden';
  const iconOf = (thingId) => day.things.find((thing) => thing.id === thingId).icon;

  const tileFor = (entry, table, location) => ({
    ...named(table, entry),
    seen: day.seenAt(location).map(iconOf),
    hint: home && sameLocation(home.location, location) ? level : 'hidden',
  });

  const garmentView = (garment, extra) => ({
    ...named(texts.garments, garment),
    pockets: garment.pockets.map((pocket) => tileFor(pocket, texts.pockets, { garmentId: garment.id, pocketId: pocket.id })),
    ...extra,
  });

  const garments = day.layout.garments ?? [];
  const worn = garments
    .filter((garment) => day.world.isWorn(garment.id))
    .map((garment) => garmentView(garment, { canTakeOff: putting && garment.removable !== false }));
  const hanging = garments
    .filter((garment) => day.world.garmentRoom(garment.id) === room.id)
    .map((garment) => garmentView(garment, { canPutOn: true, onSpot: day.world.garmentSpot(garment.id).spotId }));
  const homeRoomId = home ? homeRoomOf(day, home.location) : null;

  return {
    room: named(texts.rooms, room),
    spots: room.spots.map((spot) => tileFor(spot, texts.spots, { placeId: room.id, spotId: spot.id })),
    worn,
    hanging,
    rooms: day.reachableRooms().map(({ id, steps }) => ({
      ...named(texts.rooms, day.roomOf(id)),
      steps,
      hint: id === homeRoomId ? level : 'hidden',
    })),
    hintText: level === 'shown' ? texts.planHint({ location: describeLocation(day, home.location, texts) }) : '',
  };
}
