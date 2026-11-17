// The catalogue of things the player can practise with. Data only: ids, icons and suggested home spots. How a
// thing is used lives in the chains (chains/), the sentences about it in texts/.

const spot = (placeId, spotId) => ({ placeId, spotId });

export const THINGS = Object.freeze([
  { id: 'keys', icon: '🔑', home: { garmentId: 'coat', pocketId: 'coat-right' } },
  { id: 'wallet', icon: '👛', home: { garmentId: 'coat', pocketId: 'coat-inside' } },
  { id: 'phone', icon: '📱', home: spot('kitchen', 'counter') },
  { id: 'scissors', icon: '✂️', home: spot('kitchen', 'drawer') },
]);

/** The suggested home of every thing: the plan a new player starts with. */
export const defaultPlan = (things = THINGS) => Object.fromEntries(things.map((thing) => [thing.id, thing.home]));
