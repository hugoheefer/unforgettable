// A pot of filter coffee: the scissors open the pack. The pack and the tin are props; the tin already says where
// it stays, so making it a thing needs no change here.
export const coffee = {
  id: 'coffee',
  steps: [
    { id: 'go', kind: 'goTo', roomId: 'kitchen' },
    { id: 'pack', kind: 'take', object: 'coffee-pack' },
    { id: 'scissors', kind: 'take', object: 'scissors', leftAt: { placeId: 'kitchen', spotId: 'counter' } },
    { id: 'open', kind: 'tell' },
    { id: 'scissors-back', kind: 'putBack', object: 'scissors' },
    { id: 'tin', kind: 'take', object: 'coffee-tin', leftAt: { placeId: 'kitchen', spotId: 'counter' } },
    { id: 'fill', kind: 'tell' },
    { id: 'tin-back', kind: 'putBack', object: 'coffee-tin' },
    { id: 'sit', kind: 'goTo', roomId: 'living' },
    { id: 'drink', kind: 'check' },
  ],
};
