// What the player sees of the room they stand in. Pure: turns the state of a round into plain data that
// the DOM code only has to draw.

const iconOf = (items, itemId) => items.find((item) => item.id === itemId).icon;

function homeSpotOf(round) {
  const itemId = round.state().holding;
  return itemId ? { itemId, location: round.plan[itemId] } : null;
}

export function describeRoom(round) {
  const room = round.roomOf(round.state().roomId);
  const home = homeSpotOf(round);
  const level = home ? round.hintFor(home.itemId) : 'hidden';

  const spots = room.spots.map((spot) => {
    const isHome = home && home.location.placeId === room.id && home.location.spotId === spot.id;
    return {
      id: spot.id,
      name: spot.name,
      icon: spot.icon,
      seen: round.seenOn(spot.id).map((itemId) => iconOf(round.items, itemId)),
      hint: isHome ? level : 'hidden',
    };
  });

  const homePlace = home && round.roomOf(home.location.placeId);
  const homeSpot = homePlace?.spots.find((spot) => spot.id === home.location.spotId);
  return {
    room: { id: room.id, name: room.name, icon: room.icon },
    spots,
    exits: round.world.exitsOf(room.id).map((id) => {
      const exit = round.roomOf(id);
      return { id: exit.id, name: exit.name, icon: exit.icon };
    }),
    hintText: level === 'shown' ? `Your plan: ${homeSpot.name} (${homePlace.name})` : '',
  };
}
