// The catalogue of things the player can practise with. Data only: ids, icons and rooms. The sentences about a
// thing and its uses live in texts/.
//
// `carry` says whether the thing goes with you when you leave the house; `home` is the suggested home spot;
// each use names the room where the thing is needed.

const spot = (placeId, spotId) => ({ placeId, spotId });
const use = (id, roomId) => ({ id, roomId });

export const THINGS = Object.freeze([
  { id: 'keys', icon: '🔑', carry: true, home: spot('hall', 'hook'), uses: [use('shed', 'shed'), use('car', 'car')] },
  { id: 'wallet', icon: '👛', carry: true, home: { garmentId: 'coat', pocketId: 'coat-inside' }, uses: [use('door', 'hall'), use('order', 'study')] },
  { id: 'phone', icon: '📱', carry: true, home: spot('kitchen', 'counter'), uses: [use('call', 'garden'), use('alarm', 'bedroom'), use('recipe', 'kitchen')] },
  { id: 'scissors', icon: '✂️', carry: false, home: spot('study', 'desk-drawer'), uses: [use('present', 'living'), use('flowers', 'garden'), use('package', 'kitchen')] },
]);

/** The suggested home of every thing: the plan a new player starts with. */
export const defaultPlan = (things = THINGS) => Object.fromEntries(things.map((thing) => [thing.id, thing.home]));
