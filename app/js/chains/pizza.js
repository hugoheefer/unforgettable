// The pizza is at the door and has to be paid with the wallet.
export const pizza = {
  id: 'pizza',
  steps: [
    { id: 'bell', kind: 'tell' },
    { id: 'go', kind: 'goTo', roomId: 'hall' },
    { id: 'wallet', kind: 'take', object: 'wallet', leftAt: { placeId: 'hall', spotId: 'console' } },
    { id: 'pay', kind: 'tell', at: 'hall' },
    { id: 'wallet-back', kind: 'putBack', object: 'wallet' },
    { id: 'table', kind: 'goTo', roomId: 'dining' },
    { id: 'eat', kind: 'tell', at: 'dining' },
  ],
};
