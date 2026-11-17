// Opener: you come home and need your keys to get in.
export const comeHome = {
  id: 'come-home',
  opener: true,
  needsOnPerson: ['keys'],
  steps: [
    { id: 'door', kind: 'move', roomId: 'garden' },
    { id: 'keys', kind: 'take', object: 'keys', leftAt: { placeId: 'hall', spotId: 'console' } },
    { id: 'inside', kind: 'move', roomId: 'hall' },
    { id: 'keys-back', kind: 'putBack', object: 'keys' },
    { id: 'shoes', kind: 'tell' },
  ],
};
