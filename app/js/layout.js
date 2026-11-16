// The proof-of-concept world: an apartment with a coat and a car at the door. Data only.

const spot = (id, name, icon) => ({ id, name, icon });

export const LAYOUT = Object.freeze({
  startRoomId: 'hall',
  places: [
    { id: 'hall', name: 'Hallway', icon: '🚪', exits: ['living', 'kitchen', 'coat', 'car'],
      spots: [spot('hook', 'Key hook', '🪝'), spot('shelf', 'Shelf', '🗄️'), spot('shoes', 'Shoe rack', '👟')] },
    { id: 'living', name: 'Living room', icon: '🛋️', exits: ['hall', 'bedroom'],
      spots: [spot('table', 'Coffee table', '☕'), spot('sofa', 'Sofa', '🛋️'), spot('books', 'Bookcase', '📚')] },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', exits: ['hall'],
      spots: [spot('counter', 'Counter', '🍽️'), spot('drawer', 'Drawer', '🗃️'), spot('fridge', 'Fridge top', '🧊')] },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', exits: ['living'],
      spots: [spot('nightstand', 'Nightstand', '🕯️'), spot('dresser', 'Dresser', '🪞')] },
    { id: 'coat', name: 'Coat', icon: '🧥', kind: 'container', exits: ['hall'],
      spots: [spot('left-pocket', 'Left pocket', '🫳'), spot('right-pocket', 'Right pocket', '🫴'), spot('inside-pocket', 'Inside pocket', '🧷')] },
    { id: 'car', name: 'Car', icon: '🚗', kind: 'container', exits: ['hall'],
      spots: [spot('glovebox', 'Glove box', '🧤'), spot('cupholder', 'Cup holder', '🥤'), spot('seat', 'Passenger seat', '💺')] },
  ],
});

export const ITEMS = Object.freeze([
  { id: 'keys', name: 'keys', icon: '🔑', findPrompt: 'You start the car: find your keys!' },
  { id: 'wallet', name: 'wallet', icon: '👛', findPrompt: 'You are at the till: find your wallet!' },
  { id: 'phone', name: 'phone', icon: '📱', findPrompt: 'Someone is calling: find your phone!' },
]);

export const DEFAULT_PLAN = Object.freeze({
  keys: { placeId: 'hall', spotId: 'hook' },
  wallet: { placeId: 'coat', spotId: 'inside-pocket' },
  phone: { placeId: 'kitchen', spotId: 'counter' },
});
