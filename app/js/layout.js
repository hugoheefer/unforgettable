// The proof-of-concept world: a house with its common rooms, a garden with a shed and a car, and the clothes
// the player wears. Data only.
//
// `kind: 'container'` marks a place that is not a room you wander off to when distracted (the car).

const spot = (id, name, icon) => ({ id, name, icon });

export const LAYOUT = Object.freeze({
  startRoomId: 'hall',
  places: [
    { id: 'hall', name: 'Hallway', icon: '🚪', exits: ['living', 'kitchen', 'toilet', 'landing', 'garden'],
      spots: [spot('hook', 'Key hook', '🪝'), spot('coat-hooks', 'Coat hooks', '🧥'), spot('console', 'Console table', '🪑'), spot('shoes', 'Shoe rack', '👟'), spot('umbrella', 'Umbrella stand', '☂️')] },
    { id: 'living', name: 'Living room', icon: '🛋️', exits: ['hall', 'dining'],
      spots: [spot('coffee-table', 'Coffee table', '☕'), spot('sofa', 'Sofa', '🛋️'), spot('tv-stand', 'TV stand', '📺'), spot('bookcase', 'Bookcase', '📚'), spot('armchair', 'Armchair', '💺')] },
    { id: 'dining', name: 'Dining room', icon: '🍽️', exits: ['living', 'kitchen'],
      spots: [spot('dining-table', 'Dining table', '🍽️'), spot('sideboard', 'Sideboard', '🗄️'), spot('dining-chair', 'Chair', '🪑')] },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', exits: ['hall', 'dining', 'garage'],
      spots: [spot('counter', 'Counter', '🔪'), spot('drawer', 'Kitchen drawer', '🗃️'), spot('fruit-bowl', 'Fruit bowl', '🍎'), spot('fridge-top', 'Fridge top', '🧊'), spot('sink', 'Sink', '🚰')] },
    { id: 'toilet', name: 'Toilet', icon: '🚽', exits: ['hall'],
      spots: [spot('cistern', 'Cistern', '🚽'), spot('magazine-rack', 'Magazine rack', '📰'), spot('toilet-sill', 'Window sill', '🪟')] },
    { id: 'landing', name: 'Landing', icon: '🪜', exits: ['hall', 'bedroom', 'bathroom', 'study'],
      spots: [spot('landing-chest', 'Chest', '🧰'), spot('landing-shelf', 'Shelf', '🖼️'), spot('stairs', 'Stair step', '🪜')] },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', exits: ['landing'],
      spots: [spot('nightstand', 'Nightstand', '🕯️'), spot('dresser', 'Dresser', '🪞'), spot('bed', 'Bed', '🛏️'), spot('wardrobe', 'Wardrobe', '🚪'), spot('bedroom-chair', 'Chair', '🪑')] },
    { id: 'bathroom', name: 'Bathroom', icon: '🛁', exits: ['landing'],
      spots: [spot('bath-sink', 'Sink', '🚰'), spot('bath-shelf', 'Shelf', '🧴'), spot('laundry', 'Laundry basket', '🧺'), spot('bath-cabinet', 'Mirror cabinet', '🪞')] },
    { id: 'study', name: 'Study', icon: '💻', exits: ['landing'],
      spots: [spot('desk', 'Desk', '🖥️'), spot('desk-drawer', 'Desk drawer', '🗃️'), spot('study-shelf', 'Shelf', '📚'), spot('printer', 'Printer', '🖨️')] },
    { id: 'garage', name: 'Garage', icon: '🏠', exits: ['kitchen', 'garden'],
      spots: [spot('workbench', 'Workbench', '🔧'), spot('toolbox', 'Toolbox', '🧰'), spot('garage-shelf', 'Shelf', '🥫')] },
    { id: 'garden', name: 'Garden', icon: '🌳', exits: ['hall', 'garage', 'shed', 'car'],
      spots: [spot('doorstep', 'Doorstep', '🚪'), spot('bench', 'Garden bench', '🪑'), spot('plant-pot', 'Plant pot', '🪴'), spot('garden-table', 'Garden table', '⛱️')] },
    { id: 'shed', name: 'Shed', icon: '🛖', exits: ['garden'],
      spots: [spot('shed-shelf', 'Shelf', '🥫'), spot('shed-bench', 'Bench', '🔨'), spot('wheelbarrow', 'Wheelbarrow', '🛒')] },
    { id: 'car', name: 'Car', icon: '🚗', kind: 'container', exits: ['garden'],
      spots: [spot('glovebox', 'Glove box', '🧤'), spot('cupholder', 'Cup holder', '🥤'), spot('seat', 'Passenger seat', '💺'), spot('door-pocket', 'Door pocket', '🚪')] },
  ],
  garments: [
    { id: 'coat', name: 'Coat', icon: '🧥', startsWorn: true, removable: true,
      pockets: [spot('coat-left', 'Left pocket', '🫳'), spot('coat-right', 'Right pocket', '🫴'), spot('coat-inside', 'Inside pocket', '🧷')] },
    { id: 'trousers', name: 'Trousers', icon: '👖', startsWorn: true, removable: false,
      pockets: [spot('trousers-front-left', 'Front pocket, left', '🫳'), spot('trousers-front-right', 'Front pocket, right', '🫴'), spot('trousers-back', 'Back pocket', '🍑')] },
  ],
});

export const ITEMS = Object.freeze([
  { id: 'keys', name: 'keys', icon: '🔑', findPrompt: 'You start the car: find your keys!' },
  { id: 'wallet', name: 'wallet', icon: '👛', findPrompt: 'You are at the till: find your wallet!' },
  { id: 'phone', name: 'phone', icon: '📱', findPrompt: 'Someone is calling: find your phone!' },
  { id: 'scissors', name: 'scissors', icon: '✂️', findPrompt: 'A parcel needs opening: find your scissors!' },
]);

export const DEFAULT_PLAN = Object.freeze({
  keys: { placeId: 'hall', spotId: 'hook' },
  wallet: { garmentId: 'coat', pocketId: 'coat-inside' },
  phone: { placeId: 'kitchen', spotId: 'counter' },
  scissors: { placeId: 'study', spotId: 'desk-drawer' },
});
