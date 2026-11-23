// The catalogue of things the player can practise with. Data only: ids, icons, suggested home spots and the night spot (where a thing lies when nobody puts it away in the evening). How a
// thing is used lives in the chains (chains/), the sentences about it in texts/.

const spot = (placeId, spotId) => ({ placeId, spotId });

export const THINGS = Object.freeze([
  { id: 'keys', icon: '🔑', home: { garmentId: 'coat', pocketId: 'coat-right' }, nightSpot: spot('hall', 'console') },
  { id: 'wallet', icon: '👛', home: { garmentId: 'coat', pocketId: 'coat-inside' }, nightSpot: spot('living', 'coffee-table') },
  { id: 'phone', icon: '📱', home: spot('kitchen', 'counter'), nightSpot: spot('bedroom', 'nightstand') },
  { id: 'scissors', icon: '✂️', home: spot('kitchen', 'drawer'), nightSpot: spot('bedroom', 'dresser') },
]);

/** The suggested home of every thing: the plan a new player starts with. */
export const defaultPlan = (things = THINGS) => Object.fromEntries(things.map((thing) => [thing.id, thing.home]));
