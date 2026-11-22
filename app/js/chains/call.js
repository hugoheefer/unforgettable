// You want to call your sister: the story starts with the search for the phone, wherever the player is. The call
// ends in the garden: the phone is still in hand after the move, because the same chain puts it back there.
export const call = {
  id: 'call',
  time: 'day',
  steps: [
    { id: 'phone', kind: 'take', object: 'phone', leftAt: { placeId: 'garden', spotId: 'garden-table' } },
    { id: 'walk', kind: 'move', roomId: 'garden' },
    { id: 'phone-back', kind: 'putBack', object: 'phone' },
    { id: 'in', kind: 'goTo', roomId: 'living' },
    { id: 'sit', kind: 'tell', at: 'living' },
  ],
};
