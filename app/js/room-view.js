// What the player sees of the room they stand in and of what they wear. Pure: turns the state of a round into
// plain data that the DOM code only has to draw.

import { isPocket, sameLocation } from './world.js';

const iconOf = (items, itemId) => items.find((item) => item.id === itemId).icon;

function describeInstruction(round) {
  const state = round.state();
  const item = round.items.find((candidate) => candidate.id === (state.holding ?? state.findItem));
  const label = `${item.icon} ${item.name}`;
  return state.phase === 'drop'
    ? `Put your ${label} down: tap a spot or a pocket, or walk to another room.`
    : `Find your ${label}: look at a spot or a pocket, or walk to another room.`;
}

/** The place and garment names for the hint "Your plan: Inside pocket (Coat)". */
function describeHome(round, location) {
  if (isPocket(location)) {
    const garment = round.garmentOf(location.garmentId);
    return `${garment.pockets.find((pocket) => pocket.id === location.pocketId).name} (${garment.name})`;
  }
  const place = round.roomOf(location.placeId);
  return `${place.spots.find((spot) => spot.id === location.spotId).name} (${place.name})`;
}

export function describeRoom(round) {
  const state = round.state();
  const room = round.roomOf(state.roomId);
  const dropping = state.phase === 'drop';
  const home = dropping && state.holding ? { itemId: state.holding, location: round.plan[state.holding] } : null;
  const level = home ? round.hintFor(home.itemId) : 'hidden';

  const tileFor = (entry, location) => ({
    id: entry.id,
    name: entry.name,
    icon: entry.icon,
    seen: round.seenAt(location).map((itemId) => iconOf(round.items, itemId)),
    hint: home && sameLocation(home.location, location) ? level : 'hidden',
  });

  const garmentView = (garment, extra) => ({
    id: garment.id,
    name: garment.name,
    icon: garment.icon,
    pockets: garment.pockets.map((pocket) => tileFor(pocket, { garmentId: garment.id, pocketId: pocket.id })),
    ...extra,
  });

  const garments = round.layout.garments ?? [];
  const worn = garments
    .filter((garment) => round.world.isWorn(garment.id))
    .map((garment) => garmentView(garment, { canTakeOff: dropping && garment.removable !== false }));
  const hanging = garments
    .filter((garment) => round.world.garmentRoom(garment.id) === room.id)
    .map((garment) => garmentView(garment, { canPutOn: true, onSpot: round.world.garmentPlaces.get(garment.id).spotId }));

  return {
    room: { id: room.id, name: room.name, icon: room.icon },
    spots: room.spots.map((spot) => tileFor(spot, { placeId: room.id, spotId: spot.id })),
    worn,
    hanging,
    exits: round.world.exitsOf(room.id).map((id) => {
      const exit = round.roomOf(id);
      return { id: exit.id, name: exit.name, icon: exit.icon };
    }),
    hintText: level === 'shown' ? `Your plan: ${describeHome(round, home.location)}` : '',
    instruction: describeInstruction(round),
    verb: dropping ? 'Put here' : 'Look here',
  };
}
