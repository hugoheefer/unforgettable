// Opener: you come home and need your keys to get in. It also starts the game: the first day ever opens here.
export const comeHome = {
  id: 'come-home',
  opener: true,
  startsTheGame: true,
  needsOnPerson: ['keys'],
  steps: [
    { id: 'door', kind: 'move', roomId: 'garden' },
    { id: 'keys', kind: 'take', object: 'keys', leftAt: { placeId: 'hall', spotId: 'console' } },
    { id: 'inside', kind: 'move', roomId: 'hall' },
    { id: 'keys-back', kind: 'putBack', object: 'keys' },
    { id: 'shoes', kind: 'tell', at: 'hall' },
  ],
};
