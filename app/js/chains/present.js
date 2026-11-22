// Wrapping a birthday present: scissors and phone are used in the dining room, far from their home spots.
export const present = {
  id: 'present',
  time: 'day',
  steps: [
    { id: 'go', kind: 'goTo', roomId: 'dining' },
    { id: 'paper', kind: 'take', object: 'wrapping-paper', leftAt: { placeId: 'dining', spotId: 'sideboard' }, at: 'dining' },
    { id: 'scissors', kind: 'take', object: 'scissors', leftAt: { placeId: 'dining', spotId: 'dining-table' } },
    { id: 'wrap', kind: 'tell', at: 'dining', uses: 'scissors' },
    { id: 'scissors-back', kind: 'putBack', object: 'scissors' },
    { id: 'phone', kind: 'take', object: 'phone', leftAt: { placeId: 'dining', spotId: 'dining-table' } },
    { id: 'call', kind: 'tell', uses: 'phone' },
    { id: 'phone-back', kind: 'putBack', object: 'phone' },
    { id: 'paper-back', kind: 'putBack', object: 'wrapping-paper', at: 'dining' },
    { id: 'hall', kind: 'goTo', roomId: 'hall' },
    { id: 'ready', kind: 'tell', at: 'hall' },
  ],
};
