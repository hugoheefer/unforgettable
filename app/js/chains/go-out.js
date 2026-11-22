// Opener: you go out for shopping and cannot leave without your keys and wallet. Needs nothing on the person.
export const goOut = {
  id: 'go-out',
  time: 'day',
  opener: true,
  steps: [
    { id: 'start', kind: 'move', roomId: 'hall' },
    { id: 'keys', kind: 'take', object: 'keys', leftAt: { placeId: 'hall', spotId: 'console' } },
    { id: 'wallet', kind: 'take', object: 'wallet', leftAt: { placeId: 'hall', spotId: 'console' } },
    { id: 'away', kind: 'tell', uses: 'keys' },
    { id: 'pay', kind: 'tell', uses: 'wallet' },
    { id: 'back', kind: 'tell' },
    { id: 'inside', kind: 'move', roomId: 'hall' },
    { id: 'bag', kind: 'tell', at: 'hall' },
    { id: 'keys-back', kind: 'putBack', object: 'keys' },
    { id: 'wallet-back', kind: 'putBack', object: 'wallet' },
    { id: 'unpack', kind: 'goTo', roomId: 'kitchen' },
    { id: 'done', kind: 'tell', at: 'kitchen' },
  ],
};
