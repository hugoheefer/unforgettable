// The test view: where every thing and garment is at this moment. For testing the game only; players never see
// it (the link appears only with `?test` in the address). Pure: turns the world into lines of text.

import { describeLocation, layoutLookup } from './room-view.js';
import { named } from './names.js';

/**
 * @param {{ layout: object, things: object[], world: import('./world.js').World, plan: object, hand: string[],
 *           roomId: string | null, texts: object }} options
 *   `hand` is what the player holds and `roomId` where they stand, during a session; outside one both are empty
 * @returns {string[]} the room line (during a session), one line per thing, then one per garment that can be taken off
 */
export function whereEverythingIs({ layout, things, world, plan, hand, roomId, texts }) {
  const lookup = layoutLookup(layout);
  const where = (location) => describeLocation(lookup, location, texts);
  const sameAs = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const thingLine = (thing) => {
    const location = world.whereIs(thing.id);
    const at = hand.includes(thing.id) ? texts.testInHand : location ? where(location) : texts.testNowhere;
    return texts.testThingLine({ thing: named(texts.things, thing), where: at, home: location !== null && sameAs(location, plan[thing.id]) });
  };
  const garmentLine = (garment) => {
    const spot = world.garmentSpot(garment.id);
    return texts.testThingLine({ thing: named(texts.garments, garment), where: spot ? where(spot) : texts.testWorn, home: false });
  };

  return [
    ...(roomId ? [texts.testYouAreIn({ room: named(texts.rooms, lookup.roomOf(roomId)) })] : []),
    ...things.map(thingLine),
    ...layout.garments.filter((garment) => garment.removable).map(garmentLine),
  ];
}
