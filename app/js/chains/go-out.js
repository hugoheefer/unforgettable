// Opener: you go out for shopping and cannot leave without your keys. Needs nothing on the person.
export const goOut = {
  id: 'go-out',
  opener: true,
  steps: [
    { id: 'start', kind: 'move', roomId: 'hall' },
    { id: 'plan', kind: 'tell' },
    { id: 'keys', kind: 'take', object: 'keys', leftAt: { placeId: 'hall', spotId: 'console' } },
    { id: 'away', kind: 'tell' },
    { id: 'inside', kind: 'move', roomId: 'hall' },
    { id: 'bag', kind: 'tell', at: 'hall' },
    { id: 'keys-back', kind: 'putBack', object: 'keys' },
    { id: 'unpack', kind: 'goTo', roomId: 'kitchen' },
    { id: 'done', kind: 'tell', at: 'kitchen' },
  ],
};
