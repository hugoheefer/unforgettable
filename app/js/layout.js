// The proof-of-concept world: a house with its common rooms, a garden with a shed and a car, and the clothes
// the player wears. Data only: ids, icons and structure. Names and sentences live in texts/.
//
// `kind: 'container'` marks a place that is not a room you wander off to when distracted (the car).

const spot = (id, icon) => ({ id, icon });

export const LAYOUT = Object.freeze({
  startRoomId: 'hall',
  places: [
    { id: 'hall', icon: '🚪', exits: ['living', 'kitchen', 'toilet', 'landing', 'garden'],
      spots: [spot('hook', '🪝'), spot('coat-hooks', '🧥'), spot('console', '🪑'), spot('shoes', '👟'), spot('umbrella', '☂️')] },
    { id: 'living', icon: '🛋️', exits: ['hall', 'dining'],
      spots: [spot('coffee-table', '☕'), spot('sofa', '🛋️'), spot('tv-stand', '📺'), spot('bookcase', '📚'), spot('armchair', '💺')] },
    { id: 'dining', icon: '🍽️', exits: ['living', 'kitchen'],
      spots: [spot('dining-table', '🍽️'), spot('sideboard', '🗄️'), spot('dining-chair', '🪑')] },
    { id: 'kitchen', icon: '🍳', exits: ['hall', 'dining', 'garage'],
      spots: [spot('counter', '🔪'), spot('drawer', '🗃️'), spot('fruit-bowl', '🍎'), spot('fridge-top', '🧊'), spot('sink', '🚰')] },
    { id: 'toilet', icon: '🚽', exits: ['hall'],
      spots: [spot('cistern', '🚽'), spot('magazine-rack', '📰'), spot('toilet-sill', '🪟')] },
    { id: 'landing', icon: '🪜', exits: ['hall', 'bedroom', 'bathroom', 'study'],
      spots: [spot('landing-chest', '🧰'), spot('landing-shelf', '🖼️'), spot('stairs', '🪜')] },
    { id: 'bedroom', icon: '🛏️', exits: ['landing'],
      spots: [spot('nightstand', '🕯️'), spot('dresser', '🪞'), spot('bed', '🛏️'), spot('wardrobe', '🚪'), spot('bedroom-chair', '🪑')] },
    { id: 'bathroom', icon: '🛁', exits: ['landing'],
      spots: [spot('bath-sink', '🚰'), spot('bath-shelf', '🧴'), spot('laundry', '🧺'), spot('bath-cabinet', '🪞')] },
    { id: 'study', icon: '💻', exits: ['landing'],
      spots: [spot('desk', '🖥️'), spot('desk-drawer', '🗃️'), spot('study-shelf', '📚'), spot('printer', '🖨️')] },
    { id: 'garage', icon: '🏠', exits: ['kitchen', 'garden'],
      spots: [spot('workbench', '🔧'), spot('toolbox', '🧰'), spot('garage-shelf', '🥫')] },
    { id: 'garden', icon: '🌳', exits: ['hall', 'garage', 'shed', 'car'],
      spots: [spot('doorstep', '🚪'), spot('bench', '🪑'), spot('plant-pot', '🪴'), spot('garden-table', '⛱️')] },
    { id: 'shed', icon: '🛖', exits: ['garden'],
      spots: [spot('shed-shelf', '🥫'), spot('shed-bench', '🔨'), spot('wheelbarrow', '🛒')] },
    { id: 'car', icon: '🚗', kind: 'container', exits: ['garden'],
      spots: [spot('glovebox', '🧤'), spot('cupholder', '🥤'), spot('seat', '💺'), spot('door-pocket', '🚪')] },
  ],
  garments: [
    { id: 'coat', icon: '🧥', startsWorn: true, removable: true,
      pockets: [spot('coat-left', '🫳'), spot('coat-right', '🫴'), spot('coat-inside', '🧷')] },
    { id: 'trousers', icon: '👖', startsWorn: true, removable: false,
      pockets: [spot('trousers-front-left', '🫳'), spot('trousers-front-right', '🫴'), spot('trousers-back', '🍑')] },
  ],
});
