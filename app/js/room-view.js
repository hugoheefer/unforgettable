// What the player sees of the room they stand in and of what they wear. Pure: turns the state of a round into
// plain data that the DOM code only has to draw.

import { isPocket, sameLocation } from './world.js';
import { named } from './names.js';

const iconOf = (items, itemId) => items.find((item) => item.id === itemId).icon;

function describeInstruction(round, texts) {
  const state = round.state();
  const item = round.items.find((candidate) => candidate.id === (state.holding ?? state.findItem));
  const thing = named(texts.things, item);
  return state.phase === 'drop' ? texts.instructionDrop({ thing }) : texts.instructionFind({ thing });
}

/** The place and garment names for the hint "Your plan: Inside pocket (Coat)". */
export function describeLocation(round, location, texts) {
  if (isPocket(location)) {
    const garment = round.garmentOf(location.garmentId);
    const pocket = garment.pockets.find((candidate) => candidate.id === location.pocketId);
    return texts.locationPocket({ pocket: named(texts.pockets, pocket), garment: named(texts.garments, garment) });
  }
  const place = round.roomOf(location.placeId);
  const spot = place.spots.find((candidate) => candidate.id === location.spotId);
  return texts.locationSpot({ spot: named(texts.spots, spot), room: named(texts.rooms, place) });
}

export function describeRoom(round, texts) {
  const state = round.state();
  const room = round.roomOf(state.roomId);
  const dropping = state.phase === 'drop';
  const home = dropping && state.holding ? { itemId: state.holding, location: round.plan[state.holding] } : null;
  const level = home ? round.hintFor(home.itemId) : 'hidden';

  const tileFor = (entry, table, location) => ({
    ...named(table, entry),
    seen: round.seenAt(location).map((itemId) => iconOf(round.items, itemId)),
    hint: home && sameLocation(home.location, location) ? level : 'hidden',
  });

  const garmentView = (garment, extra) => ({
    ...named(texts.garments, garment),
    pockets: garment.pockets.map((pocket) => tileFor(pocket, texts.pockets, { garmentId: garment.id, pocketId: pocket.id })),
    ...extra,
  });

  const garments = round.layout.garments ?? [];
  const worn = garments
    .filter((garment) => round.world.isWorn(garment.id))
    .map((garment) => garmentView(garment, { canTakeOff: dropping && garment.removable !== false }));
  const hanging = garments
    .filter((garment) => round.world.garmentRoom(garment.id) === room.id)
    .map((garment) => garmentView(garment, { canPutOn: true, onSpot: round.world.garmentSpot(garment.id).spotId }));

  return {
    room: named(texts.rooms, room),
    spots: room.spots.map((spot) => tileFor(spot, texts.spots, { placeId: room.id, spotId: spot.id })),
    worn,
    hanging,
    exits: round.world.exitsOf(room.id).map((id) => named(texts.rooms, round.roomOf(id))),
    hintText: level === 'shown' ? texts.planHint({ location: describeLocation(round, home.location, texts) }) : '',
    instruction: describeInstruction(round, texts),
    verb: dropping ? texts.verbDrop : texts.verbFind,
  };
}
